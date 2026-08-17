// app/api/newsletter/patch-campaign/route.ts
// Saves a refine result (subject + body_md) back to a draft campaign.
// 2026-08-17 fix: now persists veda_score and logs before/after to
// marketing.email_learnings so the Rewrite path feeds the same learning loop
// as the full Propose path (previously silently discarded both).
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  const { campaign_id, property_id, subject, body_md, instruction, veda_score, veda_issues } = await req.json().catch(() => ({}));
  if (!campaign_id || !subject || !body_md) return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  const sb = getSupabaseAdmin();

  const { data: before } = await sb.schema('guest').from('campaigns')
    .select('subject, body_md')
    .eq('campaign_id', campaign_id).eq('property_id', property_id).maybeSingle();

  const updatePayload: Record<string, unknown> = { subject, body_md, updated_at: new Date().toISOString() };
  if (typeof veda_score === 'number') updatePayload.veda_score = veda_score;

  const { error } = await sb.schema('guest').from('campaigns')
    .update(updatePayload)
    .eq('campaign_id', campaign_id)
    .eq('property_id', property_id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Best-effort learning log — mirrors what Mira writes from the full Propose
  // loop. Never blocks the save if this insert fails.
  try {
    await sb.schema('marketing').from('email_learnings').insert({
      property_id,
      campaign_id,
      source: 'rewrite_button',
      field: 'body_md',
      before_text: before?.body_md ?? null,
      after_text: body_md,
      edit_summary: typeof instruction === 'string' ? instruction.slice(0, 800) : null,
      learned_rule: Array.isArray(veda_issues) && veda_issues.length ? veda_issues.slice(0, 5).join(' · ') : null,
      active: true,
      created_by: 'rewrite_button',
    });
  } catch { /* learning log is best-effort, never blocks save */ }

  return NextResponse.json({ ok: true, veda_score: typeof veda_score === 'number' ? veda_score : null });
}
