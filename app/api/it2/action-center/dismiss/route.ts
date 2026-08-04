// app/api/it2/action-center/dismiss/route.ts
// action-center-inbox-v1 (2026-08-04): dismiss CTA for the response strip.
// kind='response' → public.fn_owner_response_dismiss (sets dismissed_at);
// kind='ticket'   → cockpit_tickets.status='archived' (tickets are backend-only
// now; archiving is the owner saying "seen, no action needed"). Both decrement
// live counts on the next refetch — no full reload (scope item 2).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { kind?: string; id?: number };
    const id = Number(body.id);
    if (!id || !['response', 'ticket'].includes(body.kind ?? '')) {
      return NextResponse.json({ ok: false, error: 'kind (response|ticket) + id required' }, { status: 400 });
    }
    const sb = getSupabaseAdmin();
    if (body.kind === 'response') {
      const { data, error } = await (sb as any).rpc('fn_owner_response_dismiss', { p_id: id });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, result: data });
    }
    const { error } = await (sb as any)
      .from('cockpit_tickets')
      .update({ status: 'archived' })
      .eq('id', id)
      .eq('status', 'awaits_user');
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'dismiss failed' }, { status: 500 });
  }
}
