// app/api/marketing/director/approve-slot/route.ts
// PBS 2026-07-22 (Newsletter Engine v2): approve a director slot → guest.campaigns row.
// POST { slot_id: number, schedule?: boolean, scheduled_at?: string }
// If schedule=true and no scheduled_at given, we schedule at slot_date + 10:00.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { slot_id?: number; schedule?: boolean; scheduled_at?: string };
    const slotId = Number(body.slot_id);
    if (!slotId) return NextResponse.json({ error: 'slot_id required' }, { status: 400 });

    const sb = getSupabaseAdmin();

    let scheduledAt: string | null = null;
    if (body.schedule) {
      if (body.scheduled_at) {
        scheduledAt = body.scheduled_at;
      } else {
        const s = await sb.from('v_director_calendar').select('slot_date').eq('id', slotId).maybeSingle();
        const d = s.data?.slot_date as string | undefined;
        scheduledAt = d ? `${d}T10:00:00+07:00` : null;
      }
    }

    const { data, error } = await sb.rpc('fn_director_slot_approve', {
      p_slot_id: slotId,
      p_scheduled_at: scheduledAt,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, campaign_id: data, scheduled_at: scheduledAt });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
