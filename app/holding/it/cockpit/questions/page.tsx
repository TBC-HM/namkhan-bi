// app/holding/it/cockpit/questions/page.tsx
// PBS 2026-07-27 — the Questions Inbox: every open_question from briefs AND bugs
// in ONE walkthrough, one card at a time, multiple choice.
//
// PBS 2026-07-27 (v2) — DECISION INBOX. His words: "i need one cockpit where i
// have all ctas i cannot dig around in 3 pages to find whatever to approve."
// This page is now the ONE place with every pending owner action:
//   1. Questions the machine is waiting on (briefs + bugs walkthrough)
//   2. Sign-offs ready (brief shipped, module awaiting PBS freeze — one click here)
//   3. PRs awaiting merge (agent runs that opened a PR the loop could not auto-merge)

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, MONO } from '../_components/tokens';
import QuestionWalkthrough, { type OpenQ } from './QuestionWalkthrough';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RawQ = { question?: string; options?: { label: string; consequence: string; recommended?: boolean }[]; asked_by?: string };

async function signOffAction(formData: FormData) {
  'use server';
  const docType = String(formData.get('doc_type') ?? '');
  if (!docType) return;
  const sb = getSupabaseAdmin();
  await (sb as any).rpc('fn_module_sign_off', { p_doc_type: docType, p_actor: 'PBS' });
  revalidatePath('/holding/it/cockpit/questions');
}

export default async function QuestionsPage() {
  const sb = getSupabaseAdmin();
  const [{ data: briefs }, { data: bugs }, { data: queue }, { data: statuses }, { data: agentRuns }] = await Promise.all([
    (sb as any).from('v_build_briefs_index')
      .select('slug, title, status, open_question')
      .eq('status', 'needs_input')
      .not('open_question', 'is', null),
    (sb as any).from('cockpit_bugs')
      .select('id, body, status, open_question')
      .not('open_question', 'is', null)
      .in('status', ['new', 'acked', 'processing']),
    (sb as any).from('v_module_completion_queue')
      .select('module_doc_type, display_name, status, completion_estimate, brief_slug, gap_list'),
    (sb as any).from('v_module_status')
      .select('doc_type, signed_off_at'),
    (sb as any).from('v_bug_agent_runs_latest')
      .select('bug_id, phase, pr_url, log_tail, started_at')
      .not('pr_url', 'is', null)
      .eq('phase', 'done')
      .gte('started_at', new Date(Date.now() - 7 * 86400_000).toISOString())
      .order('started_at', { ascending: false }),
  ]);

  // ---- Section 1: open questions (walkthrough) ----
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

  // ---- Section 2: sign-offs ready (brief shipped, module not yet frozen) ----
  const signedOff = new Set((statuses ?? []).filter((s: any) => s.signed_off_at).map((s: any) => s.doc_type));
  // Which briefs are shipped? Re-query index for shipped status of queue briefs.
  const briefSlugs = (queue ?? []).map((q: any) => q.brief_slug).filter(Boolean);
  const { data: shippedBriefs } = briefSlugs.length
    ? await (sb as any).from('v_build_briefs_index').select('slug, status').in('slug', briefSlugs).eq('status', 'shipped')
    : { data: [] as { slug: string }[] };
  const shippedSet = new Set((shippedBriefs ?? []).map((b: any) => b.slug));
  const signOffReady = (queue ?? []).filter((q: any) =>
    q.brief_slug && shippedSet.has(q.brief_slug) && !signedOff.has(q.module_doc_type) && q.status !== 'completed');

  // ---- Section 3: agent PRs awaiting merge (loop couldn't auto-merge) ----
  const prsAwaiting = (agentRuns ?? []).filter((r: any) => !(r.log_tail ?? '').includes('auto-merged'));

  const totalActions = questions.length + signOffReady.length + prsAwaiting.length;

  return (
    <div style={{ padding: '24px', color: TOKENS.ink }}>
      <div style={{ maxWidth: 680, margin: '0 auto 18px' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
          ✅ Decisions {totalActions > 0 ? `(${totalActions})` : ''}
        </h1>
        <p style={{ fontSize: 12, color: TOKENS.text2, margin: '4px 0 0' }}>
          THE one page with everything waiting on YOU — questions, sign-offs, merges. Empty page = machine is running on its own.
        </p>
      </div>

      {/* 1 · Questions walkthrough */}
      <div style={{ maxWidth: 680, margin: '0 auto 26px' }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: TOKENS.text2, margin: '0 0 8px' }}>
          1 · QUESTIONS ({questions.length})
        </h2>
        <QuestionWalkthrough questions={questions} />
      </div>

      {/* 2 · Sign-offs ready */}
      <div style={{ maxWidth: 680, margin: '0 auto 26px' }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: TOKENS.text2, margin: '0 0 8px' }}>
          2 · SIGN-OFFS READY ({signOffReady.length})
        </h2>
        {signOffReady.length === 0 ? (
          <div style={{ fontSize: 12, color: TOKENS.text3, padding: '10px 0' }}>Nothing shipped is waiting for your freeze.</div>
        ) : signOffReady.map((q: any) => {
          const gaps = Array.isArray(q.gap_list) ? q.gap_list.length : 0;
          return (
            <div key={q.module_doc_type} style={{
              background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8,
              padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{q.display_name ?? q.module_doc_type}</div>
                <div style={{ fontSize: 11, color: TOKENS.text2, fontFamily: MONO }}>
                  {q.completion_estimate != null ? `${q.completion_estimate}% audited` : 'no audit'}
                  {gaps > 0 ? ` · ${gaps} open gap${gaps > 1 ? 's' : ''} — sign-off will be refused until they close` : ' · gap-free'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={`/holding/it/cockpit/briefs/${q.brief_slug}`} style={{
                  fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 5, textDecoration: 'none',
                  border: `1px solid ${TOKENS.border}`, color: TOKENS.ink,
                }}>Review →</a>
                <form action={signOffAction} style={{ margin: 0 }}>
                  <input type="hidden" name="doc_type" value={q.module_doc_type} />
                  <button type="submit" style={{
                    fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 5, border: 'none',
                    cursor: 'pointer', background: gaps > 0 ? TOKENS.bg : 'var(--status-green)',
                    color: gaps > 0 ? TOKENS.text2 : '#fff',
                  }}>Sign off → FROZEN</button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3 · PRs awaiting your merge */}
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: TOKENS.text2, margin: '0 0 8px' }}>
          3 · PULL REQUESTS AWAITING MERGE ({prsAwaiting.length})
        </h2>
        <p style={{ fontSize: 10.5, color: TOKENS.text3, margin: '0 0 8px' }}>
          Agent-opened PRs from the last 7 days the loop could not merge itself (protected paths, oversize, or auto-merge off). One click each on GitHub.
        </p>
        {prsAwaiting.length === 0 ? (
          <div style={{ fontSize: 12, color: TOKENS.text3, padding: '10px 0' }}>No PRs waiting.</div>
        ) : prsAwaiting.map((r: any) => (
          <div key={r.pr_url} style={{
            background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8,
            padding: '10px 16px', marginBottom: 6, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 12,
          }}>
            <div style={{ fontSize: 12 }}>
              <span style={{ fontFamily: MONO, fontWeight: 700 }}>bug #{r.bug_id}</span>
              <span style={{ color: TOKENS.text2, marginLeft: 8, fontSize: 11 }}>
                {new Date(r.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            <a href={r.pr_url} target="_blank" rel="noreferrer" style={{
              fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 5, textDecoration: 'none',
              background: TOKENS.forest, color: '#fff',
            }}>Merge on GitHub ↗</a>
          </div>
        ))}
      </div>
    </div>
  );
}
