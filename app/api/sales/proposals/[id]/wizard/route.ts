// app/api/sales/proposals/[id]/wizard/route.ts
// Entry-wizard back-end for the proposal composer.
//
// POST { step: 'query',  date_in, date_out, adults, children, rooms }
//   -> calls public.fn_available_rate_plans(property_id, dates, pax, rooms)
//   -> returns { plans: [...] }
//
// POST { step: 'commit', date_in, date_out, adults, children, rooms,
//        selected_rate_plan_id, selected_room_type_id }
//   -> updates sales.proposals snapshot cols + wizard_completed_at
//   -> returns { ok: true }
//
// Service-role bypasses RLS (mirrors lib/sales.ts).
// property_id is looked up from sales.proposals — never trust the client for it.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface QueryBody {
  step: 'query';
  date_in: string;
  date_out: string;
  adults: number;
  children: number;
  rooms: number;
}

interface CommitBody {
  step: 'commit';
  date_in: string;
  date_out: string;
  adults: number;
  children: number;
  rooms: number;
  selected_rate_plan_id: string;
  selected_room_type_id: string;
}

type Body = QueryBody | CommitBody;

function isIsoDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

async function getPropertyId(sb: ReturnType<typeof getSupabaseAdmin>, proposalId: string): Promise<number | null> {
  const { data, error } = await sb
    .schema('sales')
    .from('proposals')
    .select('property_id')
    .eq('id', proposalId)
    .maybeSingle();
  if (error) {
    console.error('[wizard.getPropertyId]', error);
    return null;
  }
  return (data as { property_id: number } | null)?.property_id ?? null;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const proposalId = params.id;
  if (!proposalId) {
    return NextResponse.json({ error: 'missing_proposal_id' }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const propertyId = await getPropertyId(sb, proposalId);
  if (!propertyId) {
    return NextResponse.json({ error: 'proposal_not_found' }, { status: 404 });
  }

  if (body.step === 'query') {
    if (!isIsoDate(body.date_in) || !isIsoDate(body.date_out)) {
      return NextResponse.json({ error: 'invalid_dates' }, { status: 400 });
    }
    if (!(body.date_out > body.date_in)) {
      return NextResponse.json({ error: 'date_out_must_be_after_date_in' }, { status: 400 });
    }
    const adults = Math.max(1, Math.min(24, Number(body.adults) || 0));
    const children = Math.max(0, Math.min(12, Number(body.children) || 0));
    const rooms = Math.max(1, Math.min(24, Number(body.rooms) || 0));

    const { data, error } = await sb.rpc('fn_available_rate_plans', {
      p_property_id: propertyId,
      p_date_in: body.date_in,
      p_date_out: body.date_out,
      p_adults: adults,
      p_children: children,
      p_rooms: rooms,
    });
    if (error) {
      console.error('[wizard.query.rpc]', error);
      return NextResponse.json(
        { error: 'rpc_failed', detail: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ plans: Array.isArray(data) ? data : [] });
  }

  if (body.step === 'commit') {
    if (!isIsoDate(body.date_in) || !isIsoDate(body.date_out)) {
      return NextResponse.json({ error: 'invalid_dates' }, { status: 400 });
    }
    if (!body.selected_rate_plan_id || !body.selected_room_type_id) {
      return NextResponse.json({ error: 'missing_selection' }, { status: 400 });
    }
    const adults = Math.max(1, Math.min(24, Number(body.adults) || 0));
    const children = Math.max(0, Math.min(12, Number(body.children) || 0));
    const rooms = Math.max(1, Math.min(24, Number(body.rooms) || 0));

    const { error } = await sb
      .schema('sales')
      .from('proposals')
      .update({
        date_in_snapshot: body.date_in,
        date_out_snapshot: body.date_out,
        adults_snapshot: adults,
        children_snapshot: children,
        rooms_snapshot: rooms,
        selected_rate_plan_id: body.selected_rate_plan_id,
        selected_room_type_id: body.selected_room_type_id,
        wizard_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId);
    if (error) {
      console.error('[wizard.commit.update]', error);
      return NextResponse.json(
        { error: 'update_failed', detail: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown_step' }, { status: 400 });
}
