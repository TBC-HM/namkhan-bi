// app/api/marketing/email/refine-block/route.ts
// PBS 2026-07-22 EOD — restored + upgraded endpoint the Refine drawer calls.
// Uses shared lib/emailWritingRules.ts so the voice matches the proposer.
// Accepts { kind: 'newsletter_campaign' | 'sequence_step', id, instruction }.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { buildEmailSystemPrompt, normaliseKind, type EmailKind } from '@/lib/emailWritingRules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  kind?: 'newsletter_campaign' | 'sequence_step';
  id?: string;
  instruction?: string;
};

async function callAnthropic(system: string, userPrompt: string): Promise<{ subject?: string; body_md?: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-7',
      max_tokens: 1800,
      system,
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
  const wrapper = body.kind ?? 'newsletter_campaign';
  const id = String(body.id ?? '').trim();
  const instruction = String(body.instruction ?? '').trim().slice(0, 800);

  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  if (!instruction) return NextResponse.json({ ok: false, error: 'instruction required' }, { status: 400 });
  if (wrapper !== 'newsletter_campaign') {
    return NextResponse.json({ ok: false, error: `unsupported kind: ${wrapper}` }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data: camp, error: campErr } = await sb.schema('guest').from('campaigns')
    .select('campaign_id, subject, body_md, campaign_kind, group_slug, template_key, relative_kind, relative_days, from_name')
    .eq('campaign_id', id).maybeSingle();
  if (campErr) return NextResponse.json({ ok: false, error: `load_campaign_failed: ${campErr.message}` }, { status: 500 });
  if (!camp) return NextResponse.json({ ok: false, error: 'campaign_not_found' }, { status: 404 });

  // Derive email kind: lifecycle → relative_kind; else broadcast
  const emailKind: EmailKind = (camp.campaign_kind === 'lifecycle' && camp.relative_kind)
    ? normaliseKind(camp.relative_kind)
    : 'broadcast';

  // Load per-group policy (plain-text / no-links overlay for OTA Traveller etc.)
  let policy: { force_plain_text?: boolean | null; block_links?: boolean | null; block_images?: boolean | null } | null = null;
  let policyNote = '';
  if (camp.group_slug) {
    const { data: pol } = await sb.from('v_group_email_policy').select('*').eq('group_slug', camp.group_slug).maybeSingle();
    if (pol) {
      policy = pol as typeof policy;
      const bits: string[] = [];
      if (policy?.force_plain_text) bits.push('force_plain_text=TRUE');
      if (policy?.block_links) bits.push('block_links=TRUE');
      if (policy?.block_images) bits.push('block_images=TRUE');
      if (bits.length) policyNote = `\nGROUP POLICY (${camp.group_slug}): ${bits.join(' · ')}`;
    }
  }

  const system = buildEmailSystemPrompt(emailKind, policy);

  const userPrompt = [
    `CAMPAIGN kind=${camp.campaign_kind ?? 'broadcast'}, template_key=${camp.template_key ?? '(none)'}, group=${camp.group_slug ?? '(real-guest)'}, from=${camp.from_name ?? 'The Namkhan'}`,
    policyNote,
    '',
    'CURRENT SUBJECT:',
    camp.subject ?? '(empty)',
    '',
    'CURRENT BODY_MD:',
    camp.body_md ?? '(empty)',
    '',
    'OPERATOR INSTRUCTION (apply this — do not just echo the current text):',
    instruction,
    '',
    'Now return the revised JSON per the OUTPUT rules in the system prompt.',
  ].join('\n');

  try {
    const proposal = await callAnthropic(system, userPrompt);
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
