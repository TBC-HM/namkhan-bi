'use client';

// app/holding/it/cockpit/specs/new/UploadMdClient.tsx
// md-intake-v1: "Upload MD" tab of the Spec Builder. Upload an owner .md →
// POST /api/specs/md-intake → verbatim source persisted (dms.documents) →
// deterministic evaluation checklist → distilled brief (build_briefs) + queue
// row (module_completion_queue) → result panel: brief, queue position,
// owner-class open questions. Dry-run evaluates + dedups, writes nothing.

import { useRef, useState } from 'react';
import { TOKENS, MONO } from '@/app/holding/it/cockpit/_components/tokens';
import type { GoalOption } from './SpecBuilderClient';

interface Check { id: string; law: string; result: 'pass' | 'note' | 'question'; detail: string }
interface IntakeResult {
  ok: boolean;
  dry_run: boolean;
  source: { external_id: string; doc_id: string | null; sha256: string; file_name: string; already_existed: boolean; matches_existing: boolean | null; repo_path: string; repo_pushed: boolean; repo_push_error: string | null };
  evaluation: { checks: Check[]; decisions: string[]; questions: { q: string }[]; evaluator: string };
  brief: { slug: string; status: string; priority: number; already_existed: boolean; inserted: boolean; content_md: string };
  queue: { module_doc_type: string; display_name: string; priority: number; position: number; active_rows: number; entry_url: string | null; expected_delivery: string; already_existed: boolean; inserted: boolean };
}

const RESULT_COLOR: Record<Check['result'], string> = {
  pass: TOKENS.forest,
  note: TOKENS.sand,
  question: TOKENS.terracotta,
};

const S = {
  label: { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: TOKENS.inkSoft, display: 'block', marginBottom: 5 },
  input: { fontSize: 13, padding: '8px 10px', border: `1px solid ${TOKENS.border}`, borderRadius: 4, background: TOKENS.bgRaised, color: TOKENS.ink, width: '100%', boxSizing: 'border-box' as const },
  btn: { fontSize: 13, fontWeight: 700, padding: '10px 28px', borderRadius: 4, background: TOKENS.forest, color: '#FFFFFF', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' } as React.CSSProperties,
  card: { border: `1px solid ${TOKENS.border}`, borderRadius: 6, background: TOKENS.bgRaised, padding: '14px 16px', marginBottom: 14 } as React.CSSProperties,
  cardTitle: { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: TOKENS.inkSoft, marginBottom: 8 },
  mono: { fontFamily: MONO, fontSize: 11 } as React.CSSProperties,
};

export default function UploadMdClient({ goals }: { goals: GoalOption[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [goalId, setGoalId] = useState('');
  const [dryRun, setDryRun] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [showBrief, setShowBrief] = useState(false);

  async function submit() {
    if (!file) { setErr('Choose a .md file first.'); return; }
    if (!goalId) { setErr('Select a goal — every brief must link a governance goal (ADR-165).'); return; }
    setErr(null); setBusy(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('goal_id', goalId);
      if (dryRun) fd.append('dry_run', '1');
      const res = await fetch('/api/specs/md-intake', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) { setErr(json.error ?? `Intake failed (HTTP ${res.status})`); return; }
      setResult(json as IntakeResult);
    } catch (e: any) {
      setErr(e?.message ?? 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, padding: '24px 0' }}>
      <div style={{ fontSize: 13, color: TOKENS.inkSoft, lineHeight: 1.6, marginBottom: 20 }}>
        Upload an owner MD instead of filling the 8-section form. The file is stored <strong style={{ color: TOKENS.ink }}>verbatim</strong> as
        canon (dms.documents + repo docs/brief-sources/), evaluated against platform law by a deterministic
        checklist, and registered: distilled brief + module row in the completion queue. The source always
        overrides derivatives. Registration is table-driven — no nav changes, no pages scaffolded. Build ships
        via the normal PR → PBS merge gate.
      </div>

      {/* File */}
      <div style={{ marginBottom: 18 }}>
        <label style={S.label}>Source file (.md · .markdown · .txt · .sql)</label>
        <input ref={fileRef} type="file" accept=".md,.markdown,.txt,.sql,text/markdown,text/plain" style={{ display: 'none' }}
          onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
        <button type="button" onClick={() => fileRef.current?.click()}
          style={{ width: '100%', padding: file ? '14px 16px' : '28px 16px', border: `1px dashed ${file ? TOKENS.forest : TOKENS.border}`, borderRadius: 6, background: TOKENS.bgRaised, color: file ? TOKENS.ink : TOKENS.inkSoft, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
          {file
            ? <span><span style={{ fontWeight: 700 }}>{file.name}</span> <span style={{ color: TOKENS.text3 }}>· {(file.size / 1024).toFixed(1)} KB · click to replace</span></span>
            : 'Click to choose the MD file (stored untouched — the system never rewrites your source)'}
        </button>
        <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 4 }}>
          .docx / .xlsx extraction is a later iteration — export to .md first.
        </div>
      </div>

      {/* Goal */}
      <div style={{ marginBottom: 18 }}>
        <label style={S.label}>Goal (governance link) *</label>
        <select style={{ ...S.input, appearance: 'auto' as const }} value={goalId} onChange={e => setGoalId(e.target.value)}>
          <option value="">— Select the goal this module serves —</option>
          {goals.map(g => (
            <option key={g.goal_id} value={String(g.goal_id)}>
              {' '.repeat(Math.max(0, (g.level - 2) * 2))}{g.title} ({g.slug})
            </option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 4 }}>
          Every brief must link a governance goal (ADR-165). Orphan briefs are rejected at intake.
        </div>
      </div>

      {/* Dry run */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: TOKENS.inkSoft, marginBottom: 20, cursor: 'pointer' }}>
        <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
        Dry run — evaluate + dedup only, write nothing (acceptance check for already-persisted sources)
      </label>

      {err && <div style={{ fontSize: 12, color: TOKENS.terracotta, padding: '8px 12px', border: `1px solid ${TOKENS.terracotta}`, borderRadius: 4, marginBottom: 16 }}>{err}</div>}

      <button type="button" disabled={busy} onClick={submit} style={{ ...S.btn, opacity: busy ? 0.6 : 1, marginBottom: 24 }}>
        {busy ? 'Evaluating…' : dryRun ? 'Evaluate (dry run)' : 'Upload → evaluate → register'}
      </button>

      {/* ── Result ─────────────────────────────────────────────────────── */}
      {result && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: result.evaluation.questions.length ? TOKENS.terracotta : TOKENS.forest, marginBottom: 12 }}>
            {result.dry_run ? 'DRY RUN — nothing written. ' : ''}
            {result.brief.already_existed
              ? `Brief ${result.brief.slug} already exists (status ${result.brief.status}) — no duplicate created.`
              : result.dry_run
                ? `Would create brief ${result.brief.slug} as ${result.evaluation.questions.length ? 'NEEDS_INPUT' : 'READY'}.`
                : `Brief created: ${result.brief.slug} · status ${result.brief.status.toUpperCase()}.`}
          </div>

          {/* Source */}
          <div style={S.card}>
            <div style={S.cardTitle}>Source (verbatim canon)</div>
            <div style={{ ...S.mono, color: TOKENS.ink, lineHeight: 1.7 }}>
              {result.source.external_id} · sha256 {result.source.sha256.slice(0, 16)}…<br />
              {result.source.already_existed
                ? <span style={{ color: TOKENS.sand }}>Source already persisted — reused, not re-inserted{result.source.matches_existing === false ? ' · CONTENT DIFFERS from stored canon (stored version wins; upload under a new filename to supersede)' : result.source.matches_existing ? ' · content matches stored canon' : ''}.</span>
                : result.dry_run ? 'Would insert into dms.documents (doc_subtype brief_source).' : `Stored in dms.documents${result.source.doc_id ? ` · doc_id ${result.source.doc_id}` : ''}.`}
              <br />
              Repo mirror {result.source.repo_path}: {result.source.repo_pushed ? 'pushed via fn_gh_push_file' : result.source.already_existed || result.dry_run ? 'skipped' : `failed (${result.source.repo_push_error ?? 'unknown'}) — dms row is canonical`}
            </div>
          </div>

          {/* Queue */}
          <div style={S.card}>
            <div style={S.cardTitle}>Completion queue</div>
            <div style={{ fontSize: 13, color: TOKENS.ink, lineHeight: 1.7 }}>
              <strong>{result.queue.display_name}</strong> <span style={{ ...S.mono, color: TOKENS.text3 }}>({result.queue.module_doc_type})</span><br />
              Queue position <strong>#{result.queue.position}</strong> of {result.queue.active_rows} active · priority {result.queue.priority} (lowest picked first)<br />
              entry_url: <span style={S.mono}>{result.queue.entry_url ?? '(builder proposes in PR)'}</span> · expected delivery {result.queue.expected_delivery}
              {result.queue.already_existed && <><br /><span style={{ color: TOKENS.sand }}>Queue row already existed — kept untouched (audit-first, never overwrite).</span></>}
            </div>
          </div>

          {/* Owner questions */}
          <div style={S.card}>
            <div style={S.cardTitle}>Owner-class open questions</div>
            {result.evaluation.questions.length ? (
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: TOKENS.terracotta, lineHeight: 1.7 }}>
                {result.evaluation.questions.map((q, i) => <li key={i}>{q.q}</li>)}
              </ol>
            ) : (
              <div style={{ fontSize: 13, color: TOKENS.forest }}>None — technical gaps were decided and logged by the evaluator. Brief is READY.</div>
            )}
            {result.evaluation.questions.length > 0 && (
              <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 6 }}>
                Written to build_briefs.open_question — the brief stays NEEDS_INPUT until answered.
              </div>
            )}
          </div>

          {/* Checklist */}
          <div style={S.card}>
            <div style={S.cardTitle}>Evaluation checklist ({result.evaluation.evaluator})</div>
            {result.evaluation.checks.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: `1px solid ${TOKENS.border}`, alignItems: 'baseline' }}>
                <span style={{ ...S.mono, fontWeight: 700, color: RESULT_COLOR[c.result], minWidth: 72, textTransform: 'uppercase' }}>{c.result}</span>
                <div style={{ fontSize: 12, color: TOKENS.ink, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 700 }}>{c.law}</span><br />
                  <span style={{ color: TOKENS.inkSoft }}>{c.detail}</span>
                </div>
              </div>
            ))}
            {result.evaluation.decisions.length > 0 && (
              <div style={{ fontSize: 11, color: TOKENS.inkSoft, marginTop: 8, lineHeight: 1.6 }}>
                <strong>Technical decisions logged (not escalated):</strong>
                <ol style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {result.evaluation.decisions.map((d, i) => <li key={i}>{d}</li>)}
                </ol>
              </div>
            )}
          </div>

          {/* Brief preview */}
          <button type="button" onClick={() => setShowBrief(v => !v)}
            style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 4, background: TOKENS.bg, color: TOKENS.ink, border: `1px solid ${TOKENS.border}`, cursor: 'pointer', marginBottom: showBrief ? 12 : 0 }}>
            {showBrief ? '▼ Hide distilled brief' : '▶ Show distilled brief (derived — source overrides)'}
          </button>
          {showBrief && (
            <pre style={{ ...S.mono, lineHeight: 1.6, background: TOKENS.bg, border: `1px solid ${TOKENS.border}`, borderRadius: 4, padding: '14px 16px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: TOKENS.ink, maxHeight: 480 }}>
              {result.brief.content_md}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
