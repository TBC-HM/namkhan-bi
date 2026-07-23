// app/api/marketing/newsletter/propose-one/route.ts
// PBS 2026-07-23 · Thin HTTP wrapper. The whole writer chain (composer envelope →
// deep grounding → Saya → Veda → assemble → persist) lives in ./engine.ts
// (proposeOne) so the background worker /api/cron/write-pending-drafts can run the
// SAME code path without an HTTP self-call. PUT (save-as-draft) unchanged.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { proposeOne, type ProposeBody } from './engine';

export const runtime  = 'nodejs';
export const dynamic  = 'force-dynamic';
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  let body: ProposeBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }); }
  return proposeOne(body);
}

type SaveBody = {
  property_id?: number;
  kind?: 'broadcast' | 'lifecycle';
  subject?: string;
  body_md?: string;
  target_date?: string;
  audience_type?: 'b2c' | 'b2b';
  goal_tag?: string | null;
  name?: string;
  hero_asset_id?: string | null;
};

function normalizeKind(k: unknown): 'broadcast' | 'lifecycle' {
  return k === 'lifecycle' ? 'lifecycle' : 'broadcast';
}

// PUT · save proposal as guest.campaigns draft (carries hero_asset_id when provided)
export async function PUT(req: NextRequest) {
  let body: SaveBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  const property_id = Number(body.property_id);
  if (!Number.isFinite(property_id) || property_id <= 0) {
    return NextResponse.json({ ok: false, error: 'property_id_required' }, { status: 400 });
  }
  const subject = String(body.subject ?? '').trim();
  const body_md = String(body.body_md ?? '').trim();
  if (!subject || !body_md) {
    return NextResponse.json({ ok: false, error: 'subject_and_body_required' }, { status: 400 });
  }
  const kind = normalizeKind(body.kind);
  const name = String(body.name || subject).slice(0, 200);
  const planned_date = body.target_date ? String(body.target_date).slice(0, 10) : null;
  const hero_asset_id = body.hero_asset_id ? String(body.hero_asset_id) : null;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.schema('guest').from('campaigns').insert({
    property_id,
    name,
    subject,
    body_md,
    campaign_kind: kind,
    status: 'draft',
    schedule_kind: 'once',
    planned_date,
    hero_asset_id,
    audience_type: body.audience_type ?? 'b2c',
    goal_tag: body.goal_tag ?? null,
    created_by: 'propose-newsletter-ai',
  }).select('campaign_id').maybeSingle();

  if (error || !data?.campaign_id) {
    return NextResponse.json({ ok: false, error: error?.message || 'insert_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, campaign_id: data.campaign_id });
}
