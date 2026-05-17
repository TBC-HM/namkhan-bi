// app/api/cockpit/dispatch-queue/route.ts
//
// AUTOWORKER for the agent ticket queue.
//
// Drains cockpit_tickets where `status='triaged'`, `processed_at IS NULL`,
// `metadata.allow_autodispatch=true` and `metadata.assigned_role` is set.
// For each, loads the persona prompt from `cockpit_agent_prompts`, calls
// Anthropic with the persona as system + the ticket body as the user
// message, captures the output, inserts a new `agent_delivery` ticket into
// the requesting HoD's inbox, and marks the original ticket processed.
//
// Opt-in by design (claude_md §0.6 stays in spirit — autonomy only on
// tickets explicitly marked `allow_autodispatch=true`).
//
// Trigger: `POST /api/cockpit/dispatch-queue?role=<role>&limit=<N>`
// Auth:    `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
// Cron:    can be wired via pg_cron + pg_net later.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
// Vercel default is 300s on all plans (2026); we cap at 120s so a single
// autoworker call comfortably fits a long Anthropic response without
// stalling the function instance for the full window.
export const maxDuration = 120;
export const runtime = 'nodejs';

// ─── Config ──────────────────────────────────────────────────────────────
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = 'claude-sonnet-4-5'; // safe default; bump to 4-7 when GA stable
const MAX_TICKETS_PER_CALL = 5;
// Cap at 4000 so even verbose personas (Sherlock 16k-char prompt) finish
// generation within Vercel's function window. Larger memos can be regenerated
// with explicit follow-ups via the reply button.
const MAX_TOKENS = 4000;

// Property → HoD role that receives auto-dispatch responses.
const HOD_BY_PROPERTY: Record<number, string> = {
  1000001: 'finance_hod_donna', // Donna → Cifra
  260955:  'finance_hod',        // Namkhan → Intel
};

const NAME_BY_ROLE: Record<string, { name: string; emoji: string }> = {
  legal_specialist_donna: { name: 'Carla',    emoji: '⚖️' },
  legal_local_donna:      { name: 'Vera',     emoji: '⚖'  },
  forensic_detective:     { name: 'Sherlock', emoji: '🔍' },
  finance_hod_donna:      { name: 'Cifra',    emoji: '$'  },
  finance_hod:            { name: 'Intel',    emoji: '$'  },
  lead:                   { name: 'Felix',    emoji: '🏛' },
  it_manager:             { name: 'Kit',      emoji: '⌬'  },
};

interface QueuedTicket {
  id: number;
  intent: string;
  email_subject: string | null;
  parsed_summary: string | null;
  metadata: Record<string, unknown> | null;
}

export async function POST(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'missing_env', present: { SUPABASE_URL: !!SUPABASE_URL, SR: !!SUPABASE_SERVICE_ROLE_KEY, ANT: !!ANTHROPIC_API_KEY } },
      { status: 500 },
    );
  }

  const auth = request.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (token !== SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const role = (searchParams.get('role') ?? '').trim();
  const limit = Math.min(
    Number(searchParams.get('limit') ?? MAX_TICKETS_PER_CALL),
    MAX_TICKETS_PER_CALL,
  );

  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── 1. pick the queue ─────────────────────────────────────────────────
  let q = supa
    .from('cockpit_tickets')
    .select('id, intent, email_subject, parsed_summary, metadata')
    .eq('status', 'triaged')
    .is('processed_at', null)
    .eq('metadata->>allow_autodispatch', 'true')
    .not('metadata->>assigned_role', 'is', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (role && role !== 'all') {
    q = q.eq('metadata->>assigned_role', role);
  }

  const { data: tickets, error: tErr } = await q;
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!tickets || tickets.length === 0) {
    return NextResponse.json({ dispatched: 0, note: 'No opt-in queued tickets matching filters.' });
  }

  const results: Array<Record<string, unknown>> = [];

  // ── 2. drain ──────────────────────────────────────────────────────────
  for (const raw of tickets as QueuedTicket[]) {
    const t = raw;
    const meta = (t.metadata ?? {}) as Record<string, unknown>;
    const assignedRole = String(meta.assigned_role ?? '');
    const propertyId   = Number(meta.property_id ?? 0);
    const caseRef      = (meta.case_ref as string | undefined) ?? null;
    const personaInfo  = NAME_BY_ROLE[assignedRole];
    const fromAgent    = personaInfo?.name ?? assignedRole;
    const fromEmoji    = personaInfo?.emoji ?? '🤖';

    // 2a. persona prompt
    const { data: persona, error: pErr } = await supa
      .from('cockpit_agent_prompts')
      .select('id, role, prompt, version')
      .eq('role', assignedRole)
      .eq('active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pErr || !persona) {
      results.push({ ticket_id: t.id, role: assignedRole, error: 'no_persona_prompt' });
      continue;
    }

    const userMsg = [
      `OPERATOR IDENTITY (hard rule, do NOT invent a different name):`,
      `  Address the recipient of this memo as "PBS" (Paul Bauer · operator of The Beyond Circle holding).`,
      `  NEVER address PBS as "Felix" or "Felix Scholz" or any other name.`,
      `  "Felix" is a SEPARATE AGENT in this system (the lead architect persona).`,
      `  Do not greet by first name in the memo header — use "PBS" or "Cifra" (the receiving HoD).`,
      ``,
      `You have been dispatched ticket #${t.id}.`,
      ``,
      `Subject: ${t.email_subject ?? '(no subject)'}`,
      `Intent: ${t.intent}`,
      `Case ref: ${caseRef ?? '(none)'}`,
      ``,
      `--- BODY ---`,
      t.parsed_summary ?? '',
      `--- END BODY ---`,
      ``,
      `Produce your deliverable per the output format spec in your persona prompt.`,
      `Sign as ${fromAgent}. Reference the parent ticket #${t.id}.`,
      `Output the memo body only — no preamble, no apology.`,
    ].join('\n');

    let outputText = '';
    let usage: { input_tokens?: number; output_tokens?: number } | null = null;
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: (persona as { prompt: string }).prompt,
          messages: [{ role: 'user', content: userMsg }],
        }),
      });
      if (!resp.ok) {
        const errBody = await resp.text();
        results.push({ ticket_id: t.id, role: assignedRole, error: `anthropic_http_${resp.status}: ${errBody.slice(0, 300)}` });
        continue;
      }
      const j = (await resp.json()) as {
        content: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      usage = j.usage ?? null;
      outputText = (j.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('\n\n');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ ticket_id: t.id, role: assignedRole, error: `anthropic_failed: ${msg}` });
      continue;
    }

    // 2b. who receives the response?
    const toHodRole =
      HOD_BY_PROPERTY[propertyId] ??
      (typeof meta.requested_by_role === 'string' && meta.requested_by_role !== 'lead'
        ? (meta.requested_by_role as string)
        : 'finance_hod_donna');
    const toHodName = NAME_BY_ROLE[toHodRole]?.name ?? toHodRole;

    // 2c. insert agent_delivery
    const { data: ins, error: insErr } = await supa
      .from('cockpit_tickets')
      .insert({
        source: 'agent_delivery',
        arm: 'agent_work',
        intent: 'memo_delivery',
        status: 'awaits_user',
        email_subject: `${fromEmoji} ${fromAgent} · auto-dispatch · ticket #${t.id}`,
        parsed_summary: outputText,
        metadata: {
          property_id: propertyId,
          from_agent: fromAgent,
          to_hod: toHodName,
          assigned_role: toHodRole,
          requested_by_role: (meta.requested_by_role as string) ?? 'lead',
          memo_type: 'Auto-dispatch response',
          priority: (meta.priority as string) ?? 'normal',
          case_ref: caseRef,
          parent_ticket_id: t.id,
          dispatched_by: 'autoworker',
          model: MODEL,
          tokens_in: usage?.input_tokens ?? null,
          tokens_out: usage?.output_tokens ?? null,
        },
      })
      .select('id')
      .single();

    if (insErr || !ins) {
      results.push({ ticket_id: t.id, role: assignedRole, error: `insert_failed: ${insErr?.message ?? 'unknown'}` });
      continue;
    }

    // 2d. mark original processed
    await supa
      .from('cockpit_tickets')
      .update({
        processed_at: new Date().toISOString(),
        metadata: {
          ...(meta ?? {}),
          response_ticket_id: ins.id,
          dispatched_at: new Date().toISOString(),
        },
      })
      .eq('id', t.id);

    results.push({
      ticket_id: t.id,
      role: assignedRole,
      response_ticket_id: ins.id,
      tokens_in: usage?.input_tokens,
      tokens_out: usage?.output_tokens,
    });
  }

  return NextResponse.json({ dispatched: results.length, results });
}

// GET: drainable as well, easier for cron/curl smoke
export async function GET(request: NextRequest) {
  return POST(request);
}
