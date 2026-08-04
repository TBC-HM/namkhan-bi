// app/api/cockpit/laws/answer/route.ts
// laws-page-v1 — decide a law change/retire proposal from the Decision Inbox.
// Calls fn_law_proposal_decide(id, choice): Approve runs update-forward
// (change → new law row + old archived pointing to it) or supersede/archive
// (retire), and appends an ADR to cockpit.exec_decisions. Reject just closes.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<NextResponse> {
  const { proposal_id, choice } = await req.json() as { proposal_id: number; choice: string };
  if (!proposal_id || !choice) return NextResponse.json({ error: 'proposal_id and choice required' }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_law_proposal_decide', {
    p_id: proposal_id,
    p_choice: choice,
    p_note: null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (data && (data as any).ok === false) {
    return NextResponse.json({ error: String((data as any).error ?? 'decision refused') }, { status: 409 });
  }
  return NextResponse.json({ ok: true, data });
}
