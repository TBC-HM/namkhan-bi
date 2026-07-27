// app/holding/it/cockpit/questions/page.tsx
// PBS 2026-07-27 — the Questions Inbox: every open_question from briefs AND bugs
// in ONE walkthrough, one card at a time, multiple choice. No hunting through
// huge brief texts to find what the machine is asking.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS } from '../_components/tokens';
import QuestionWalkthrough, { type OpenQ } from './QuestionWalkthrough';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RawQ = { question?: string; options?: { label: string; consequence: string; recommended?: boolean }[]; asked_by?: string };

export default async function QuestionsPage() {
  const sb = getSupabaseAdmin();
  const [{ data: briefs }, { data: bugs }] = await Promise.all([
    (sb as any).from('v_build_briefs_index')
      .select('slug, title, status, open_question')
      .eq('status', 'needs_input')
      .not('open_question', 'is', null),
    (sb as any).from('cockpit_bugs')
      .select('id, body, status, open_question')
      .not('open_question', 'is', null)
      .in('status', ['new', 'acked', 'processing']),
  ]);

  const questions: OpenQ[] = [];
  for (const b of (briefs ?? [])) {
    const q = b.open_question as RawQ;
    if (!q?.question || !q?.options?.length) continue;
    questions.push({
      kind: 'brief', ref: b.slug, title: b.title ?? b.slug,
      question: q.question, options: q.options, asked_by: q.asked_by,
      link: `/holding/it/cockpit/briefs/${b.slug}`,
    });
  }
  for (const bug of (bugs ?? [])) {
    const q = bug.open_question as RawQ;
    if (!q?.question || !q?.options?.length) continue;
    questions.push({
      kind: 'bug', ref: String(bug.id), title: (bug.body ?? '').split('\n')[0].slice(0, 80),
      question: q.question, options: q.options, asked_by: q.asked_by,
      link: `/holding/bugs`,
    });
  }

  return (
    <div style={{ padding: '24px', color: TOKENS.ink }}>
      <div style={{ maxWidth: 680, margin: '0 auto 18px' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>❓ Questions</h1>
        <p style={{ fontSize: 12, color: TOKENS.text2, margin: '4px 0 0' }}>
          Everything the machine is waiting on YOU for — one decision at a time, click an option, the loop re-releases itself.
        </p>
      </div>
      <QuestionWalkthrough questions={questions} />
    </div>
  );
}
