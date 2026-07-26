// app/api/marketing/newsletter-v2/learnings/route.ts
// Newsletter Writer Team v1 · Mira (learner) — Layer 4 plumbing (A6).
// POST logs an owner edit of an AI draft into marketing.email_learnings;
// GET lists recent learnings. The read-side feed (last 10 active learnings →
// LEARNED PREFERENCES block in every Saya call) lives in the shared engine's
// refreshLiveContext — logging here is enough for the rule to reach the writer
// on the very next call. A11 rewire: RefineNewsletterButton auto-logs accepted
// refines here; property_id may be omitted when campaign_id is given (derived
// server-side from the campaign row — URL LAW: no hardcoded ids in client code).

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

type LearnBody = {
  property_id?: number;
  campaign_id?: string | null;
  source?: string;
  field?: string;
  before_text?: string | null;
  after_text?: string | null;
  edit_summary?: string | null;
  learned_rule?: string | null;
  created_by?: string | null;
};

export async function POST(req: NextRequest) {
  let body: LearnBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  let pid = Number(body.property_id);
  if ((!Number.isFinite(pid) || pid <= 0) && body.campaign_id) {
    // Derive from the campaign row (client components must not hardcode ids).
    const { data: camp } = await getSupabaseAdmin().schema('guest').from('campaigns')
      .select('property_id').eq('campaign_id', String(body.campaign_id)).maybeSingle();
    pid = Number(camp?.property_id);
  }
  if (!Number.isFinite(pid) || pid <= 0) {
    return NextResponse.json({ ok: false, error: 'property_id_required' }, { status: 400 });
  }
  const field = String(body.field ?? '').trim();
  if (!field) return NextResponse.json({ ok: false, error: 'field_required' }, { status: 400 });

  const edit_summary = String(body.edit_summary ?? '').trim() || null;
  const learned_rule = String(body.learned_rule ?? '').trim() || null;
  const before_text = body.before_text != null ? String(body.before_text).slice(0, 8000) : null;
  const after_text = body.after_text != null ? String(body.after_text).slice(0, 8000) : null;
  if (!edit_summary && !learned_rule && !(before_text && after_text)) {
    return NextResponse.json({ ok: false, error: 'nothing_to_learn: provide learned_rule, edit_summary, or before+after' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.schema('marketing').from('email_learnings').insert({
    property_id: pid,
    campaign_id: body.campaign_id ? String(body.campaign_id) : null,
    source: String(body.source ?? 'owner_edit').slice(0, 40),
    field: field.slice(0, 80),
    before_text,
    after_text,
    edit_summary,
    learned_rule,
    created_by: body.created_by ? String(body.created_by).slice(0, 120) : 'newsletter-v2',
  }).select('learning_id').maybeSingle();

  if (error || !data?.learning_id) {
    return NextResponse.json({ ok: false, error: error?.message || 'insert_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, learning_id: data.learning_id });
}

export async function GET(req: NextRequest) {
  const pid = Number(req.nextUrl.searchParams.get('property_id'));
  if (!Number.isFinite(pid) || pid <= 0) {
    return NextResponse.json({ ok: false, error: 'property_id_required' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('v_email_learnings')
    .select('learning_id, campaign_id, source, field, edit_summary, learned_rule, active, created_at')
    .eq('property_id', pid)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, learnings: data ?? [] });
}
