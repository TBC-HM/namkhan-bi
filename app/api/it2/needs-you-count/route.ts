// app/api/it2/needs-you-count/route.ts
// it-area-reorg-v1 gap 6 (2026-07-30): feeds the "IT2 ●N" nav badge in
// TopDeptStrip. Returns the same union the Action Center Zone 1 renders:
//   briefs with a parked owner question (needs_input OR verifying — gap 1)
// + open bugs with a parked question
// + module-queue rows with open_questions text
// + tickets awaiting the owner.
// Read-only, cheap counts; the strip fetches once per holding-page mount.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const [briefsRes, bugsRes, mcqRes, ticketsRes] = await Promise.all([
      (sb as any).from('v_build_briefs_index')
        .select('slug', { count: 'exact', head: true })
        .in('status', ['needs_input', 'verifying'])
        .not('open_question', 'is', null),
      (sb as any).from('cockpit_bugs')
        .select('id', { count: 'exact', head: true })
        .not('open_question', 'is', null)
        .in('status', ['new', 'acked', 'processing']),
      (sb as any).from('v_module_completion_queue')
        .select('open_questions'),
      (sb as any).from('cockpit_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'awaits_user'),
    ]);
    const mcqCount = ((mcqRes?.data ?? []) as { open_questions?: string | null }[])
      .filter((m) => (m.open_questions ?? '').trim().length > 0).length;
    const count =
      (briefsRes?.count ?? 0) + (bugsRes?.count ?? 0) + mcqCount + (ticketsRes?.count ?? 0);
    return NextResponse.json({ count });
  } catch {
    // Honest degradation: no number beats a wrong number. Badge hides on error.
    return NextResponse.json({ count: null }, { status: 200 });
  }
}
