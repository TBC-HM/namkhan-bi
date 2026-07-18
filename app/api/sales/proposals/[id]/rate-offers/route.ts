// app/api/sales/proposals/[id]/rate-offers/route.ts
// PBS 2026-07-16 — Multi-rate offers (Feature A).
// Sides-by-side offer cards emitted into the proposal email.
//
// GET    → list offers for proposal (ordered by position, then created_at)
// POST   → insert a new offer (position auto-assigned as max+1, capped at 3)
//          body: { rate_plan_id, label, payment_terms, cancellation_terms,
//                  unit_price_lak?, total_lak? }
// PATCH  → update offer by ?id=<uuid>  body: partial patch
// DELETE → delete offer by ?id=<uuid>
//
// Writes go through sb.schema('sales') because service role bypasses PostgREST
// schema exposure rules for direct client calls (per handover pattern).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx { params: { id: string } }

const MAX_OFFERS = 3;

export async function GET(_req: Request, { params }: Ctx) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .schema('sales')
    .from('proposal_rate_offers')
    .select('*')
    .eq('proposal_id', params.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(req: Request, { params }: Ctx) {
  const sb = getSupabaseAdmin();
  const body = await req.json().catch(() => ({}));
  const rate_plan_id: string | null = body?.rate_plan_id ?? null;
  if (!rate_plan_id) {
    return NextResponse.json({ error: 'rate_plan_id_required' }, { status: 400 });
  }

  // Count existing offers → auto position; hard cap at 3.
  const { data: existing } = await sb
    .schema('sales')
    .from('proposal_rate_offers')
    .select('position')
    .eq('proposal_id', params.id);
  const rows = (existing ?? []) as Array<{ position: number | null }>;
  if (rows.length >= MAX_OFFERS) {
    return NextResponse.json({ error: 'max_offers_reached', max: MAX_OFFERS }, { status: 409 });
  }
  const nextPos = rows.length === 0
    ? 1
    : Math.min(MAX_OFFERS, Math.max(...rows.map(r => Number(r.position ?? 0))) + 1);

  const insert = {
    proposal_id: params.id,
    rate_plan_id,
    room_type_id: body?.room_type_id ?? null,
    position: nextPos,
    label: body?.label ?? null,
    payment_terms: body?.payment_terms ?? null,
    cancellation_terms: body?.cancellation_terms ?? null,
    unit_price_lak: body?.unit_price_lak ?? null,
    total_lak: body?.total_lak ?? null,
  };

  const { data, error } = await sb
    .schema('sales')
    .from('proposal_rate_offers')
    .insert(insert)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  for (const k of ['rate_plan_id', 'room_type_id', 'label', 'payment_terms', 'cancellation_terms', 'unit_price_lak', 'total_lak', 'position']) {
    if (k in (body ?? {})) patch[k] = body[k];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing_to_patch' }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .schema('sales')
    .from('proposal_rate_offers')
    .update(patch)
    .eq('id', id)
    .eq('proposal_id', params.id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .schema('sales')
    .from('proposal_rate_offers')
    .delete()
    .eq('id', id)
    .eq('proposal_id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
