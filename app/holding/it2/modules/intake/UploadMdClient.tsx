'use client';

// app/holding/it2/modules/intake/UploadMdClient.tsx — MD Intake v1
// Upload an owner MD instead of filling the 8-section form. The server
// persists it verbatim (dms + repo docs/brief-sources/), evaluates it against
// platform law, and registers brief + module queue row. Dry-run toggle runs
// the full evaluation with zero writes and reports matches vs existing rows.

import { useRef, useState } from 'react';
import type { GoalOption } from './SpecBuilderClient';

interface OwnerQuestion {
  question: string;
  options: { label: string; consequence: string }[];
  recommended: string;
}

interface IntakeResult {
  dry_run: boolean;
  source: { external_id: string; doc_id: string | null; action: string; version: number; repo_path: string; repo_pushed: boolean };
  evaluation: { module_doc_type: string; display_name: string; entry_url: string | null; summary: string; distilled_brief_md: string; owner_questions: OwnerQuestion[]; technical_decisions: string[]; law_conflicts: string[] };
  brief: { slug: string; status: string; priority: number; action: string; matches_existing: boolean | null };
  queue: { module_doc_type: string; action: string; matches_existing: boolean | null };
  notes: string[];
}

const S = {
  label: { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: '#5A5A5A', display: 'block', marginBottom: 5 },
  input: { fontSize: 13, padding: '8px 10px', border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B', width: '100%', boxSizing: 'border-box' as const },
  btn: { fontSize: 13, fontWeight: 700, padding: '10px 28px', borderRadius: 4, background: '#1F3A2E', color: '#FFFFFF', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' },
  card: { border: '1px solid #E6DFCC', borderRadius: 6, padding: '14px 16px', background: '#FFFFFF', marginBottom: 12 } as React.CSSProperties,
  mono: { fontSize: 11, fontFamily: 'ui-monospace, monospace', background: '#F4EFE2', padding: '2px 6px', borderRadius: 3 } as React.CSSProperties,
};

function ActionBadge({ action }: { action: string }) {
  const created = action === 'created' || action === 'would_create' || action === 'version_bumped' || action === 'would_bump';
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 99, background: created ? '#1F3A2E' : '#E6DFCC', color: created ? '#FFFFFF' : '#5A5A5A' }}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

export default function UploadMdClient({ goals }: { goals: GoalOption[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [goalId, setGoalId] = useState('');
  const [dryRun, setDryRun] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [showBrief, setShowBrief] = useState(false);

  async function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setErr('Choose a file first.'); return; }
    if (!goalId) { setErr('Select a goal — every brief must link a governance goal (ADR-165).'); return; }
    setErr(null); setResult(null); setBusy(true);
    setPhase(dryRun ? 'Evaluating (dry-run — no writes)…' : 'Persisting source + evaluating against platform law…');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('goal_id', goalId);
      if (dryRun) fd.append('dry_run', '1');
      const res = await fetch('/api/specs/upload-md', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json.error ?? `Upload failed (${res.status})`); return; }
      setResult(json as IntakeResult);
    } catch {
      setErr('Network error — the evaluation may take up to 2 minutes; try again.');
    } finally {
      setBusy(false); setPhase('');
    }
  }

  return (
    <div style={{ maxWidth: 760, padding: '24px 0' }}>
      <div style={{ fontSize: 13, color: '#5A5A5A', marginBottom: 20, lineHeight: 1.6 }}>
        Upload an owner document (.md / .txt / .sql verbatim · .docx / .xlsx converted to an md extract).
        It is stored untouched as canon (dms + repo), evaluated against platform law, and turned into a
        build brief + module queue row. Real gaps come back as owner questions; technical choices are
        decided by the evaluator and logged in the brief.
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={S.label}>Document *</label>
        <input ref={fileRef} type="file" accept=".md,.txt,.sql,.docx,.xlsx" style={{ display: 'none' }}
          onChange={e => setFileName(e.target.files?.[0]?.name ?? null)} />
        <button type="button" onClick={() => fileRef.current?.click()}
          style={{ ...S.input, textAlign: 'left', cursor: 'pointer', color: fileName ? '#1B1B1B' : '#8A8A8A' }}>
          {fileName ?? '📄 Choose file (.md · .txt · .sql · .docx · .xlsx)'}
        </button>
      </div>

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
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#5A5A5A', marginBottom: 20, cursor: 'pointer' }}>
        <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
        Dry-run — evaluate + compare against existing rows, write nothing
      </label>

      {err && <div style={{ fontSize: 12, color: '#B8542A', padding: '8px 12px', background: '#F7E2DC', borderRadius: 3, marginBottom: 16 }}>{err}</div>}
      {busy && <div style={{ fontSize: 12, color: '#5A5A5A', marginBottom: 16 }}>⏳ {phase}</div>}

      <button type="button" onClick={submit} disabled={busy} style={{ ...S.btn, opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Working…' : dryRun ? 'Evaluate (dry-run)' : 'Upload → evaluate → register'}
      </button>

      {result && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: result.dry_run ? '#5A5A5A' : '#2E7D32', marginBottom: 12 }}>
            {result.dry_run ? '🔍 Dry-run result (nothing written)' : '✓ Intake complete'}
          </div>

          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={S.label}>Source (verbatim canon)</span>
              <ActionBadge action={result.source.action} />
            </div>
            <div style={{ fontSize: 12, color: '#1B1B1B', lineHeight: 1.7 }}>
              <span style={S.mono}>{result.source.external_id}</span> · v{result.source.version}
              {result.source.doc_id && <> · dms <span style={S.mono}>{result.source.doc_id.slice(0, 8)}…</span></>}
              <br />repo: <span style={S.mono}>{result.source.repo_path}</span>{!result.dry_run && (result.source.repo_pushed ? ' · pushed ✓' : ' · push pending/failed — check ledger')}
            </div>
          </div>

          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={S.label}>Build brief</span>
              <ActionBadge action={result.brief.action} />
            </div>
            <div style={{ fontSize: 12, color: '#1B1B1B', lineHeight: 1.7 }}>
              <span style={S.mono}>{result.brief.slug}</span> · status <strong>{result.brief.status}</strong> · priority {result.brief.priority}
              {result.brief.matches_existing !== null && <> · existing brief found: {result.brief.matches_existing ? 'YES (no duplicate)' : 'no'}</>}
            </div>
          </div>

          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={S.label}>Module queue row</span>
              <ActionBadge action={result.queue.action} />
            </div>
            <div style={{ fontSize: 12, color: '#1B1B1B', lineHeight: 1.7 }}>
              <span style={S.mono}>{result.queue.module_doc_type}</span> · {result.evaluation.display_name}
              {result.evaluation.entry_url && <> · entry <span style={S.mono}>{result.evaluation.entry_url}</span></>}
              {result.queue.matches_existing !== null && <> · existing row found: {result.queue.matches_existing ? 'YES (no duplicate)' : 'no'}</>}
            </div>
          </div>

          {result.evaluation.owner_questions.length > 0 && (
            <div style={{ ...S.card, borderColor: '#B8542A' }}>
              <span style={{ ...S.label, color: '#B8542A' }}>Owner questions (answer before build)</span>
              {result.evaluation.owner_questions.map((q, i) => (
                <div key={i} style={{ fontSize: 12, color: '#1B1B1B', marginBottom: 10, lineHeight: 1.6 }}>
                  <strong>{i + 1}. {q.question}</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {q.options.map((o, j) => (
                      <li key={j}>{o.label} — {o.consequence}{o.label === q.recommended ? ' ← recommended' : ''}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {result.evaluation.technical_decisions.length > 0 && (
            <div style={S.card}>
              <span style={S.label}>Technical decisions (decided + logged)</span>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12, color: '#1B1B1B', lineHeight: 1.6 }}>
                {result.evaluation.technical_decisions.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          )}

          {result.notes.length > 0 && (
            <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 12 }}>
              {result.notes.map((n, i) => <div key={i}>• {n}</div>)}
            </div>
          )}

          <button type="button" onClick={() => setShowBrief(v => !v)}
            style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 4, background: '#FAFAF7', color: '#1B1B1B', border: '1px solid #E6DFCC', cursor: 'pointer', marginBottom: showBrief ? 10 : 0 }}>
            {showBrief ? '▼ Hide distilled brief' : '▶ Show distilled brief'}
          </button>
          {showBrief && (
            <pre style={{ fontSize: 11, lineHeight: 1.6, background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 4, padding: '14px 16px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#1B1B1B', maxHeight: 480 }}>
              {result.evaluation.distilled_brief_md}
            </pre>
          )}

          {!result.dry_run && (
            <div style={{ marginTop: 16, fontSize: 12 }}>
              <a href="/holding/it2/modules/briefs" style={{ color: '#1F3A2E', fontWeight: 600 }}>→ View in Briefs</a>
              <span style={{ color: '#8A8A8A', margin: '0 8px' }}>·</span>
              <a href="/holding/it2/modules/status" style={{ color: '#1F3A2E', fontWeight: 600 }}>→ Module status</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
