// app/api/sales/leads/[id]/route.ts
// PBS 2026-07-14 (Sales CRM upgrade) — replaces the 2026-05-09 inline PATCH.
//   GET     → { lead, timeline }
//   PATCH   → public.fn_lead_upsert(p jsonb with id set)
//   DELETE  → public.fn_lead_delete(p_lead_id) (soft: status='deleted')
// Keeps ?include=timeline as opt-in default.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  try {
    const sb = getSupabaseAdmin();
    const url = new URL(req.url);
    const wantTimeline = url.searchParams.get('include') !== 'lead';

    const leadReq = sb.from('v_leads_full').select('*').eq('id', id).maybeSingle();
    const tlReq = wantTimeline
      ? sb.from('v_lead_timeline').select('*').eq('lead_id', id).order('at', { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null });
    const [{ data: lead, error: leadErr }, { data: timeline, error: tlErr }] = await Promise.all([leadReq, tlReq]);
    if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });
    if (!lead) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (tlErr) return NextResponse.json({ lead, timeline: [] });
    return NextResponse.json({ lead, timeline: timeline ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  body.id = id;
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_lead_upsert', { p: body });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_lead_delete', { p_lead_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
