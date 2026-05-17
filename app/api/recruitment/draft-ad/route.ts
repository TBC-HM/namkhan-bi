// POST /api/recruitment/draft-ad
// Body: { propertyId, positionTitle, salaryBand, standards, channels[], language }
// → calls Claude Sonnet with the recruiter agent's prompt for the property,
//   returns { ad_markdown, agent_role, cost_usd_milli, tokens_in, tokens_out }

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'claude-sonnet-4-6';
// Sonnet 4.6 pricing (USD per 1M tokens): $3 input, $15 output.
const COST_IN_USD_PER_M = 3.0;
const COST_OUT_USD_PER_M = 15.0;

interface Body {
  propertyId: number;
  positionTitle: string;
  salaryBand: {
    currency: 'LAK' | 'EUR' | 'USD';
    avg_native: number;
    min_native: number;
    max_native: number;
    sample_size: number;
    falls_back_to: string;
  };
  standards: string;
  channels: string[];
  language: 'en' | 'lo' | 'th' | 'es' | 'de' | 'ca';
}

const LANG_NAME: Record<string, string> = {
  en: 'English', lo: 'Lao (ລາວ)', th: 'Thai (ไทย)', es: 'Spanish (Español)', de: 'German (Deutsch)', ca: 'Catalan (Català)',
};

function fmt(n: number, ccy: string): string {
  const sym = ccy === 'EUR' ? '€' : ccy === 'LAK' ? '₭' : '$';
  if (ccy === 'LAK') {
    if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${sym}${Math.round(n / 1_000)}k`;
    return `${sym}${Math.round(n)}`;
  }
  return `${sym}${Math.round(n).toLocaleString('en-US')}`;
}

function recruiterRole(propertyId: number): string {
  if (propertyId === 260955)  return 'recruiter_namkhan';
  if (propertyId === 1000001) return 'recruiter_donna';
  return 'recruiter_namkhan';
}

export async function POST(req: Request) {
  const t0 = Date.now();
  try {
    const body = (await req.json()) as Body;
    const propertyId = Number(body.propertyId);
    const position = String(body.positionTitle ?? '').trim();
    const language = String(body.language ?? 'en');
    const channels = Array.isArray(body.channels) ? body.channels : [];
    const standards = String(body.standards ?? '');
    const band = body.salaryBand;

    if (!Number.isFinite(propertyId) || !position || !band) {
      return NextResponse.json({ error: 'invalid input' }, { status: 400 });
    }

    const role = recruiterRole(propertyId);

    // Load the agent's system prompt via a SECURITY DEFINER RPC in public schema
    // (PostgREST doesn't expose cockpit.* tables directly, but cross-schema
    // RPC routing works fine — same pattern as ops.fn_position_salary_band).
    const { data: promptRow, error: promptErr } = await supabase
      .rpc('fn_get_active_prompt', { p_role: role });

    const systemPrompt = (promptRow as { prompt?: string } | null)?.prompt;
    if (promptErr || !systemPrompt) {
      return NextResponse.json({ error: `prompt missing for role ${role} · ${promptErr?.message ?? 'no row'}` }, { status: 500 });
    }

    const userPrompt = [
      `Draft a recruitment ad in **${LANG_NAME[language] ?? language}**.`,
      `Position: ${position}`,
      `Salary band (native ${band.currency}): avg ${fmt(band.avg_native, band.currency)} · min ${fmt(band.min_native, band.currency)} · max ${fmt(band.max_native, band.currency)} · source: ${band.falls_back_to} (${band.sample_size} on roster).`,
      `Standards / regulatory: ${standards}`,
      `Best channels (rank-ordered): ${channels.join(' · ')}`,
      ``,
      `Constraints:`,
      `- 200-250 words.`,
      `- Hook → role → who we want → what we offer (incl. native-currency salary band) → how to apply (email + WhatsApp placeholder if no number known).`,
      `- Native currency only (no USD conversion).`,
      `- Match the agent's standard ad structure as defined in your system prompt.`,
      `- Output: plain markdown, no preamble.`,
    ].join('\n');

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Graceful stub for local dev.
      const stub = `# Hiring · ${position}\n\nWe are looking for a **${position}** to join the team.\n\n_(LLM stub — set ANTHROPIC_API_KEY to draft for real.)_\n\n- Salary band: ${fmt(band.avg_native, band.currency)} (range ${fmt(band.min_native, band.currency)}–${fmt(band.max_native, band.currency)})\n- Standards: ${standards}\n- Apply: hello@example.com or WhatsApp +000`;
      return NextResponse.json({ ad_markdown: stub, agent_role: role, cost_usd_milli: 0, tokens_in: 0, tokens_out: 0, stub: true });
    }

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return NextResponse.json({ error: `anthropic ${resp.status}: ${txt.slice(0, 200)}` }, { status: 502 });
    }

    const json = await resp.json();
    const text: string = (json.content?.[0]?.text ?? '').trim();
    const tokensIn = Number(json.usage?.input_tokens ?? 0);
    const tokensOut = Number(json.usage?.output_tokens ?? 0);
    const costUsd = (tokensIn * COST_IN_USD_PER_M + tokensOut * COST_OUT_USD_PER_M) / 1_000_000;
    const costMilli = Math.round(costUsd * 1000);

    // Best-effort audit log via RPC (cockpit.cap_skill_calls isn't exposed
    // to PostgREST directly). Failure must never block the operator.
    try {
      await supabase.rpc('fn_log_skill_call', {
        p_role: role,
        p_skill: 'draft_recruitment_ad',
        p_status: 'succeeded',
        p_duration_ms: Date.now() - t0,
        p_cost_milli: costMilli,
        p_input: { propertyId, position, language, channels, standards, band },
        p_output: { ad_markdown: text },
      });
    } catch {
      /* ignore */
    }

    return NextResponse.json({
      ad_markdown: text,
      agent_role: role,
      cost_usd_milli: costMilli,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
