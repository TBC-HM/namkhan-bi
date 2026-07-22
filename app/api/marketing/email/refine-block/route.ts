// app/api/marketing/email/refine-block/route.ts
// PBS 2026-07-22 EOD — restore missing endpoint the Refine drawer calls.
// Accepts { kind: 'newsletter_campaign' | 'sequence_step', id, instruction }.
// Loads current subject+body_md, asks Claude to apply the instruction,
// returns { ok:true, proposal: { campaign_id, subject, body_md } } which
// CampaignEditor merges into state (user still hits Save to persist).

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  kind?: 'newsletter_campaign' | 'sequence_step';
  id?: string;
  instruction?: string;
};

const SYSTEM = [
  'You are the marketing writer for The Namkhan, a 30-key riverside boutique retreat outside Luang Prabang, Laos.',
  'Voice: calm, understated, warm, never salesy. Repeat travellers who value quiet, nature, and craft.',
  'Return STRICT JSON with keys: subject (string, <= 65 chars, no exclamation marks), body_md (Markdown, greet with "Hi {{first_name}},").',
  'No emojis. No fabricated offers. Preserve the greeting placeholder {{first_name}} verbatim.',
].join(' ');

async function callAnthropic(userPrompt: string): Promise<{ subject?: string; body_md?: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-7',
      max_tokens: 1600,
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const errTxt = await res.text().catch(() => '');
    throw new Error(`anthropic_${res.status}: ${errTxt.slice(0, 200)}`);
  }
  const j = await res.json();
  const text = j?.content?.[0]?.text ?? '{}';
  const m = text.match(/\{[\s\S]*\}/);
  const raw = m ? m[0] : '{}';
  try { return JSON.parse(raw); } catch { return {}; }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const kind = body.kind ?? 'newsletter_campaign';
  const id = String(body.id ?? '').trim();
  const instruction = String(body.instruction ?? '').trim().slice(0, 800);

  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  if (!instruction) return NextResponse.json({ ok: false, error: 'instruction required' }, { status: 400 });
  if (kind !== 'newsletter_campaign') {
    return NextResponse.json({ ok: false, error: `unsupported kind: ${kind}` }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data: camp, error: campErr } = await sb.schema('guest').from('campaigns')
    .select('campaign_id, subject, body_md, campaign_kind, group_slug, template_key')
    .eq('campaign_id', id).maybeSingle();
  if (campErr) return NextResponse.json({ ok: false, error: `load_campaign_failed: ${campErr.message}` }, { status: 500 });
  if (!camp) return NextResponse.json({ ok: false, error: 'campaign_not_found' }, { status: 404 });

  // Load per-group policy so plain-text/no-links rules propagate to refine as well
  let policyNote = '';
  if (camp.group_slug) {
    const { data: pol } = await sb.from('v_group_email_policy').select('*').eq('group_slug', camp.group_slug).maybeSingle();
    if (pol) {
      const bits: string[] = [];
      if ((pol as any).force_plain_text) bits.push('OUTPUT MUST BE PLAIN TEXT (no Markdown formatting, no bold, no bullets, no lists)');
      if ((pol as any).block_links) bits.push('NO URLS OR LINKS anywhere in the body');
      if ((pol as any).block_images) bits.push('NO IMAGES anywhere in the body');
      if (bits.length) policyNote = `\n\nGROUP POLICY (group_slug=${camp.group_slug}):\n- ${bits.join('\n- ')}`;
    }
  }

  const userPrompt = [
    `Campaign kind: ${camp.campaign_kind ?? 'broadcast'} · template_key: ${camp.template_key ?? '(none)'}`,
    policyNote,
    '\nCURRENT SUBJECT:',
    camp.subject ?? '',
    '\nCURRENT BODY_MD:',
    camp.body_md ?? '',
    '\nINSTRUCTION FROM OPERATOR:',
    instruction,
    '\nReturn revised JSON: { "subject": "...", "body_md": "..." }.',
  ].join('\n');

  try {
    const proposal = await callAnthropic(userPrompt);
    return NextResponse.json({
      ok: true,
      proposal: {
        campaign_id: camp.campaign_id,
        subject: typeof proposal.subject === 'string' ? proposal.subject : (camp.subject ?? null),
        body_md: typeof proposal.body_md === 'string' ? proposal.body_md : (camp.body_md ?? null),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
