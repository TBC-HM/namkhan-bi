// app/api/cron/director-autocompose/route.ts
// PBS 2026-07-22 · AI Director Studio · Phase 4 autopilot.
//
// Daily cron (Vercel · 22:00 UTC = 05:00 Vientiane) — walks proposed slots
// scheduled within the next 7 days that still carry placeholder body_md,
// calls Claude via the internal /api/marketing/newsletter/propose-one route
// to compose subject + body_md, then persists the result via
// fn_director_slot_refine so the slot becomes ready for PBS review in the
// "Needs review" queue on the Director page.
//
// Safe to re-run: only touches slots whose body_md contains the placeholder
// prefix, so accepted or human-refined slots are left alone.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const NAMKHAN_ID = 260955;
const HORIZON_DAYS = 7;
const PLACEHOLDER_MARK = 'Placeholder body';
const MAX_PER_RUN = 20; // cap Anthropic calls per fire

type SlotRow = {
  id: number;
  slot_date: string;
  audience_type: 'b2c' | 'b2b';
  campaign_kind: string;
  goal_tag: string;
  title: string;
  body_md: string | null;
  status: string;
  group_slug: string | null;
};

async function handle(req: Request) {
  const url = new URL(req.url);
  const dry = url.searchParams.get('dry') === '1';
  const origin = new URL(req.url).origin;

  const sb = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + HORIZON_DAYS * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const { data, error } = await sb
    .from('v_director_calendar')
    .select('id, slot_date, audience_type, campaign_kind, goal_tag, title, body_md, status, group_slug')
    .eq('property_id', NAMKHAN_ID)
    .gte('slot_date', today)
    .lte('slot_date', horizon)
    .in('status', ['proposed', 'refined'])
    .limit(200);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const slots = ((data as SlotRow[] | null) ?? []).filter(s =>
    !s.body_md || s.body_md.startsWith(PLACEHOLDER_MARK)
  ).slice(0, MAX_PER_RUN);

  if (dry) {
    return NextResponse.json({ ok: true, dry: true, would_compose: slots.length, sample: slots.slice(0, 3) });
  }

  const results: Array<{ slot_id: number; ok: boolean; error?: string; subject?: string }> = [];

  for (const s of slots) {
    try {
      const seed_text = [
        `Newsletter target date: ${s.slot_date}`,
        s.group_slug ? `Audience group: ${s.group_slug}` : null,
        s.title ? `Working title: ${s.title}` : null,
        s.goal_tag ? `Editorial goal: ${s.goal_tag}` : null,
      ].filter(Boolean).join('\n');

      const r = await fetch(`${origin}/api/marketing/newsletter/propose-one`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          property_id: NAMKHAN_ID,
          kind: 'broadcast',
          seed_text,
          target_date: s.slot_date,
          audience_type: s.audience_type,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.proposal?.subject || !j?.proposal?.body_md) {
        results.push({ slot_id: s.id, ok: false, error: j?.error ?? String(r.status) });
        continue;
      }

      const { error: refineErr } = await sb.rpc('fn_director_slot_refine', {
        p_slot_id: s.id,
        p_title: s.title,
        p_subject: j.proposal.subject,
        p_body_md: j.proposal.body_md,
        p_hero_asset_id: null,
        p_ctas: [],
        p_ai_notes: 'auto-composed by director-autocompose cron',
      });
      if (refineErr) {
        results.push({ slot_id: s.id, ok: false, error: refineErr.message });
        continue;
      }
      results.push({ slot_id: s.id, ok: true, subject: j.proposal.subject });
    } catch (e: unknown) {
      results.push({ slot_id: s.id, ok: false, error: e instanceof Error ? e.message : 'exception' });
    }
  }

  const composed = results.filter(r => r.ok).length;
  const errors   = results.filter(r => !r.ok).length;
  return NextResponse.json({
    ok: errors === 0,
    horizon_days: HORIZON_DAYS,
    considered: slots.length,
    composed,
    errors,
    results,
    ran_at: new Date().toISOString(),
  });
}

export async function GET(req: Request)  { return handle(req); }
export async function POST(req: Request) { return handle(req); }
