// app/api/it2/needs-you-count/route.ts
// Feeds the "IT2 ●N" nav badge in TopDeptStrip.
// action-center-inbox-v1 (2026-08-04, scope 2): counts derive ONLY from LIVE
// sources — briefs.open_question (unanswered), bugs.open_question, tickets
// awaits_user < 7 days. v_module_completion_queue.open_questions TEXT is
// DEPRECATED as a count source (it lagged reality: answered questions kept
// counting; PBS: "after answer must go down to 0").

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const [briefsRes, bugsRes, ticketsRes] = await Promise.all([
      (sb as any).from('v_build_briefs_index')
        .select('slug, open_question')
        .in('status', ['needs_input', 'verifying'])
        .not('open_question', 'is', null),
      (sb as any).from('cockpit_bugs')
        .select('id', { count: 'exact', head: true })
        .not('open_question', 'is', null)
        .in('status', ['new', 'acked', 'processing']),
      (sb as any).from('cockpit_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'awaits_user')
        .gte('updated_at', sevenDaysAgo),
    ]);
    // Answered brief questions (answer_key present) are the verifier's move,
    // not the owner's — they must NOT count (PBS mandate: answered → 0).
    const briefCount = ((briefsRes?.data ?? []) as { open_question?: any }[])
      .filter((b) => !(b.open_question ?? {}).answer_key).length;
    const count = briefCount + (bugsRes?.count ?? 0) + (ticketsRes?.count ?? 0);
    return NextResponse.json({ count });
  } catch {
    // Honest degradation: no number beats a wrong number. Badge hides on error.
    return NextResponse.json({ count: null }, { status: 200 });
  }
}
