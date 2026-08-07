// app/holding/it2/questions/page.tsx
// PBS 2026-07-27 — the Questions Inbox: every open_question from briefs AND bugs
// in ONE walkthrough, one card at a time, multiple choice.
//
// PBS 2026-07-27 (v2) — DECISION INBOX. His words: "i need one cockpit where i
// have all ctas i cannot dig around in 3 pages to find whatever to approve."
// This page is now the ONE place with every pending owner action:
//   1. Questions the machine is waiting on (briefs + bugs + law proposals walkthrough)
//   2. Sign-offs ready (brief shipped, module awaiting PBS freeze — one click here)
//   3. PRs awaiting merge (agent runs that opened a PR the loop could not auto-merge)

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, MONO } from '@/components/cockpit/tokens';
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
  revalidatePath('/holding/it2/questions');
}

export default async function QuestionsPage() {
  const sb = getSupabaseAdmin();
  const [{ data: ownerQs }, { data: answeredQs }, { data: queue }, { data: statuses }, { data: agentRuns }, { data: lawProps }] = await Promise.all([
    // owner-answer-path-consolidation-v1: the inbox reads THE one contract
    // (governance.owner_questions via its L5 bridge) instead of scraping
    // brief/bug mirrors. Every asker kind — brief, bug, finding, comment —
    // lands here in one shape, answered through one route.
    (sb as any).from('v_owner_questions_open')
      .select('id, asker_kind, ref_id, question, options, deep_link, asked_by, asked_at')
      .order('asked_at', { ascending: true }),
    (sb as any).from('v_owner_questions_answered')
      .select('id, asker_kind, ref_id, question, answer, answered_at, deep_link')
      .order('answered_at', { ascending: false })
      .limit(10),
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
    // laws-page-v1 (2026-08-04): law change/retire proposals are question
    // contracts too — they surface here and are decided via /api/cockpit/laws/answer.
    (sb as any).from('v_law_change_proposals')
      .select('id, law_id, kind, question, law_excerpt')
      .eq('status', 'open'),
  ]);

  // ---- Section 1: open questions (walkthrough) — ONE contract, all kinds ----
  const KIND_LINK: Record<string, (ref: string) => string> = {
    brief: (ref) => `/holding/it2/modules/briefs/${ref}`,
    bug: () => `/holding/bugs`,
    finding: () => `/holding/it2/modules/status`,
    comment: () => `/holding/it2/modules/status`,
  };
  const questions: OpenQ[] = [];
  for (const oq of (ownerQs ?? [])) {
    if (!oq?.question) continue;
    const kind = oq.asker_kind as OpenQ['kind'];
    const opts = Array.isArray(oq.options) ? oq.options : [];
    questions.push({
      kind, ref: String(oq.ref_id), qid: oq.id,
      title: kind === 'brief' ? String(oq.ref_id) : `${kind} ${oq.ref_id}`,
      question: oq.question, options: opts, asked_by: oq.asked_by,
      link: oq.deep_link ?? KIND_LINK[kind]?.(String(oq.ref_id)) ?? '/holding/it2/questions',
    });
  }
  for (const p of (lawProps ?? [])) {
    const q = p.question as RawQ;
    if (!q?.question || !q?.options?.length) continue;
    questions.push({
      kind: 'law', ref: String(p.id),
      title: `Law #${p.law_id} · ${p.kind === 'retire' ? 'retire?' : 'change wording?'} — ${(p.law_excerpt ?? '').slice(0, 60)}`,
      question: q.question, options: q.options, asked_by: q.asked_by,
      link: `/holding/it2/system/laws?law=${p.law_id}`,
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
  // PBS 2026-07-27: "shows merge on github but both merged already" — the DB
  // cannot see GitHub merge state. Verify each candidate LIVE against the
  // GitHub API (this runs on Vercel where api.github.com is reachable) and
  // list only PRs that are still actually open.
  const candidates = (agentRuns ?? []).filter((r: any) => !(r.log_tail ?? '').includes('auto-merged'));
  let prsAwaiting: any[] = [];
  if (candidates.length > 0) {
    try {
      const { data: tok } = await (sb as any).rpc('fn_get_secret', { p_name: 'github_token' });
      if (typeof tok === 'string' && tok.length > 20) {
        const checked = await Promise.all(candidates.slice(0, 10).map(async (r: any) => {
          const m = String(r.pr_url ?? '').match(/\/pull\/(\d+)/);
          if (!m) return null;
          try {
            const resp = await fetch(`https://api.github.com/repos/TBC-HM/namkhan-bi/pulls/${m[1]}`, {
              headers: { Authorization: `Bearer ${tok}`, Accept: 'application/vnd.github+json', 'User-Agent': 'namkhan-bi' },
              cache: 'no-store',
            });
            if (!resp.ok) return r; // can't verify → keep visible (honest default)
            const pr = await resp.json() as { state: string };
            return pr.state === 'open' ? r : null;
          } catch { return r; }
        }));
        prsAwaiting = checked.filter(Boolean);
      } else {
        prsAwaiting = candidates;
      }
    } catch {
      prsAwaiting = candidates;
    }
  }

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
                <a href={`/holding/it2/modules/briefs/${q.brief_slug}`} style={{
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

      {/* 4 · Answered history — owner-answer-path-consolidation-v1: what you
          already answered and where the agent took it (one contract, one list) */}
      <div style={{ maxWidth: 680, margin: '26px auto 0' }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: TOKENS.text2, margin: '0 0 8px' }}>
          4 · ANSWERED — LAST 10
        </h2>
        {(answeredQs ?? []).length === 0 ? (
          <div style={{ fontSize: 12, color: TOKENS.text3, padding: '10px 0' }}>Nothing answered yet.</div>
        ) : (answeredQs ?? []).map((a: any) => {
          const ans = a.answer ?? {};
          const answerText = ans.free_text ?? ans.choice ?? ans.label ?? '—';
          return (
            <div key={a.id} style={{
              background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8,
              padding: '10px 16px', marginBottom: 6,
            }}>
              <div style={{ fontSize: 10, fontFamily: MONO, color: TOKENS.text2, marginBottom: 2 }}>
                {a.asker_kind} {a.ref_id}
                {a.answered_at ? ` · ${new Date(a.answered_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}` : ''}
              </div>
              <div style={{ fontSize: 12, color: TOKENS.ink, marginBottom: 2 }}>{a.question}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--status-green)' }}>
                ✓ {String(answerText).slice(0, 140)}
                {a.deep_link && (
                  <a href={a.deep_link} style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: TOKENS.text2 }}>
                    what the agent did →
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
