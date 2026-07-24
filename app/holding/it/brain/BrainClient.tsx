'use client';

// app/holding/it/brain/BrainClient.tsx
// BRAIN v1 · client console: pipeline tiles · human review queue · ask window.
// Data via /api/brain/review (GET tiles+queue, POST confirm) and /api/brain/ask.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Container, KpiTile } from '@/app/(cockpit)/_design';
import { BRAIN_DOC_KINDS, BRAIN_TIERS } from '@/lib/brain/taxonomy';
import AskFeedback from '@/components/brain/AskFeedback';

const DOC_KINDS: string[] = [...BRAIN_DOC_KINDS];
const TIERS: string[] = [...BRAIN_TIERS];

type PipelineStatus = {
  total_docs: number; extract_pending: number; extracted: number; ocr_needed: number;
  extract_failed: number; skipped: number; classified: number; needs_human: number;
  human_confirmed: number; excluded: number; chunks_total: number; chunks_embedded: number;
  docs_chunked: number;
};

type QueueRow = {
  doc_id: string; filename: string | null; title: string | null; dms_doc_type: string | null;
  extract_snippet: string | null; guess_doc_kind: string | null; guess_sensitivity: string | null;
  confidence: number | null; summary: string | null; created_at: string;
};

type Source = { doc_id: string; title: string; link: string };

/** minimal md → react: [title](link) links + line breaks + bullets. No deps. */
function renderAnswer(md: string) {
  const lines = md.split('\n');
  return lines.map((line, i) => {
    const parts: Array<string | JSX.Element> = [];
    let rest = line;
    let k = 0;
    while (rest.length > 0) {
      const m = rest.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (!m || m.index === undefined) { parts.push(rest); break; }
      if (m.index > 0) parts.push(rest.slice(0, m.index));
      parts.push(
        <a key={`${i}-${k++}`} href={m[2]} target="_blank" rel="noreferrer"
           style={{ color: 'var(--tbl-fg, #8ab4f8)', textDecoration: 'underline' }}>
          {m[1]}
        </a>
      );
      rest = rest.slice(m.index + m[0].length);
    }
    return <div key={i} style={{ minHeight: line.trim() ? undefined : 8 }}>{parts}</div>;
  });
}

export default function BrainClient() {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [edits, setEdits] = useState<Record<string, { doc_kind: string; sensitivity: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [usedHr, setUsedHr] = useState(false);

  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesVersion, setRulesVersion] = useState<number | null>(null);
  const [rulesText, setRulesText] = useState('');
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rulesMsg, setRulesMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/brain/review', { cache: 'no-store' });
      const j = await res.json();
      if (!j.ok) { setLoadErr(j.error ?? 'load failed'); return; }
      setStatus(j.status as PipelineStatus);
      setQueue((j.queue ?? []) as QueueRow[]);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'load failed');
    }
  }, []);

  useEffect(() => { void load(); const t = setInterval(() => void load(), 60_000); return () => clearInterval(t); }, [load]);

  const confirm = useCallback(async (row: QueueRow) => {
    const e = edits[row.doc_id] ?? {
      doc_kind: row.guess_doc_kind && DOC_KINDS.includes(row.guess_doc_kind) ? row.guess_doc_kind : 'other',
      sensitivity: row.guess_sensitivity && TIERS.includes(row.guess_sensitivity) ? row.guess_sensitivity : 'owner_only',
    };
    setBusy(row.doc_id);
    try {
      const res = await fetch('/api/brain/review', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ doc_id: row.doc_id, doc_kind: e.doc_kind, sensitivity: e.sensitivity, note: 'confirmed via brain console' }),
      });
      const j = await res.json();
      if (j.ok) { setQueue(q => q.filter(r => r.doc_id !== row.doc_id)); void load(); }
      else alert('Confirm failed: ' + (j.error ?? '?'));
    } finally { setBusy(null); }
  }, [edits, load]);

  const openRules = useCallback(async () => {
    setRulesOpen(o => !o);
    if (rulesText) return; // already loaded
    try {
      const res = await fetch('/api/brain/rules', { cache: 'no-store' });
      const j = await res.json();
      if (j.ok) { setRulesText(j.content_md as string); setRulesVersion(j.version as number); }
      else setRulesMsg('Load failed: ' + (j.error ?? '?'));
    } catch (e) {
      setRulesMsg('Load failed: ' + (e instanceof Error ? e.message : '?'));
    }
  }, [rulesText]);

  const saveRules = useCallback(async () => {
    if (rulesSaving || rulesText.trim().length < 500) return;
    setRulesSaving(true); setRulesMsg(null);
    try {
      const res = await fetch('/api/brain/rules', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content_md: rulesText }),
      });
      const j = await res.json();
      if (j.ok) { setRulesVersion(j.version as number); setRulesMsg(`Saved as version ${j.version}. Applies to every future classification — no redeploy needed.`); }
      else setRulesMsg('Save failed: ' + (j.error ?? '?'));
    } catch (e) {
      setRulesMsg('Save failed: ' + (e instanceof Error ? e.message : '?'));
    } finally { setRulesSaving(false); }
  }, [rulesSaving, rulesText]);

  const ask = useCallback(async () => {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true); setAnswer(null); setSources([]);
    try {
      const res = await fetch('/api/brain/ask', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const j = await res.json();
      if (j.ok) { setAnswer(j.answer as string); setSources((j.sources ?? []) as Source[]); setUsedHr(!!j.used_hr); }
      else setAnswer('Error: ' + (j.error ?? 'ask failed'));
    } catch (e) {
      setAnswer('Error: ' + (e instanceof Error ? e.message : 'ask failed'));
    } finally { setAsking(false); }
  }, [question, asking]);

  const tiles = useMemo(() => status ? [
    { label: 'Extract pending', value: status.extract_pending, footnote: 'files awaiting MD shadow' },
    { label: 'Extracted', value: status.extracted, footnote: 'MD shadow written' },
    { label: 'OCR needed', value: status.ocr_needed, footnote: 'scanned PDFs, deferred' },
    { label: 'Failed / skipped', value: status.extract_failed + status.skipped, footnote: `${status.extract_failed} failed · ${status.skipped} skipped` },
    { label: 'Classified', value: status.classified + status.human_confirmed, footnote: `${status.human_confirmed} human-confirmed` },
    { label: 'Needs human', value: status.needs_human, footnote: 'review below' },
    { label: 'Excluded (HR etc.)', value: status.excluded, footnote: 'never retrievable' },
    { label: 'Chunks', value: status.chunks_total, footnote: `${status.chunks_embedded} embedded · ${status.docs_chunked} docs` },
  ] : [], [status]);

  const selStyle: React.CSSProperties = {
    background: 'var(--tbl-bg-elev, #1c1c1e)', color: 'var(--tbl-fg, #eee)',
    border: '1px solid var(--tbl-border, #333)', borderRadius: 6, padding: '4px 6px', fontSize: 12,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Company Brain</h1>
        <p style={{ fontSize: 13, opacity: 0.7, margin: '4px 0 0' }}>
          Document pipeline · human review · ask window. HR/payroll is excluded from retrieval by policy.
        </p>
      </div>

      {loadErr ? <div style={{ color: '#f66', fontSize: 13 }}>Load error: {loadErr}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
        {tiles.map(t => (
          <KpiTile key={t.label} label={t.label} value={t.value} size="sm" footnote={t.footnote} />
        ))}
      </div>

      <Container title="Ask the company brain" subtitle="Owner view · answers only from classified documents, with citations">
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void ask(); }}
            placeholder="e.g. What commission do we pay EXO Travel?"
            style={{ flex: 1, ...selStyle, padding: '8px 10px', fontSize: 13 }}
          />
          <button onClick={() => void ask()} disabled={asking || !question.trim()}
            style={{ ...selStyle, cursor: 'pointer', padding: '8px 14px', opacity: asking ? 0.5 : 1 }}>
            {asking ? 'Thinking…' : 'Ask'}
          </button>
        </div>
        {answer ? (
          <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.55 }}>
            {renderAnswer(answer)}
            {sources.length > 0 ? (
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                Sources: {sources.map((s, i) => (
                  <span key={s.doc_id}>
                    {i > 0 ? ' · ' : ''}
                    <a href={s.link} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>{s.title}</a>
                  </span>
                ))}
              </div>
            ) : null}
            {!answer.startsWith('Error:') && !usedHr ? (
              <AskFeedback question={question} answer={answer} sources={sources} />
            ) : null}
            {usedHr ? (
              <div style={{ marginTop: 8, fontSize: 11.5, opacity: 0.6 }}>
                Contains live HR data (owner surface) — not preservable, refetched fresh on every ask.
              </div>
            ) : null}
          </div>
        ) : null}
      </Container>

      <Container
        title={`Classifier rules${rulesVersion != null ? ` (v${rulesVersion})` : ''}`}
        subtitle="The knowledge pack every classification is grounded in — companies, taxonomy, sensitivity defaults. Edit + save = new version, old versions kept."
      >
        <button onClick={() => void openRules()} style={{ ...selStyle, cursor: 'pointer', padding: '6px 12px' }}>
          {rulesOpen ? 'Hide rules' : 'View / edit rules'}
        </button>
        {rulesOpen ? (
          <div style={{ marginTop: 10 }}>
            <textarea
              value={rulesText}
              onChange={e => setRulesText(e.target.value)}
              rows={24}
              spellCheck={false}
              style={{ ...selStyle, width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: 11.5, lineHeight: 1.5, padding: 10 }}
            />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
              <button onClick={() => void saveRules()} disabled={rulesSaving || rulesText.trim().length < 500}
                style={{ ...selStyle, cursor: 'pointer', padding: '6px 14px', opacity: rulesSaving ? 0.5 : 1 }}>
                {rulesSaving ? 'Saving…' : 'Save as new version'}
              </button>
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                Live property-settings digest (identity, certifications, retreats, activities, facilities) is appended automatically — not edited here.
              </span>
            </div>
            {rulesMsg ? <div style={{ marginTop: 6, fontSize: 12 }}>{rulesMsg}</div> : null}
          </div>
        ) : null}
      </Container>

      <Container title={`Review queue (${queue.length})`} subtitle="Docs the agent couldn't confidently classify — pick kind + sensitivity, confirm">
        {queue.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.6, padding: 8 }}>Queue is empty — the agent is confident about everything so far.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', opacity: 0.6 }}>
                  <th style={{ padding: 6 }}>Document</th>
                  <th style={{ padding: 6 }}>Agent guess</th>
                  <th style={{ padding: 6 }}>Snippet</th>
                  <th style={{ padding: 6 }}>Kind</th>
                  <th style={{ padding: 6 }}>Sensitivity</th>
                  <th style={{ padding: 6 }} />
                </tr>
              </thead>
              <tbody>
                {queue.map(row => {
                  const e = edits[row.doc_id] ?? {
                    doc_kind: row.guess_doc_kind && DOC_KINDS.includes(row.guess_doc_kind) ? row.guess_doc_kind : 'other',
                    sensitivity: row.guess_sensitivity && TIERS.includes(row.guess_sensitivity) ? row.guess_sensitivity : 'owner_only',
                  };
                  return (
                    <tr key={row.doc_id} style={{ borderTop: '1px solid var(--tbl-border, #2a2a2c)', verticalAlign: 'top' }}>
                      <td style={{ padding: 6, maxWidth: 220 }}>
                        <div style={{ fontWeight: 600 }}>{row.filename ?? row.title ?? row.doc_id.slice(0, 8)}</div>
                        <a href={`/api/legal/docs/file/${row.doc_id}?mode=preview`} target="_blank" rel="noreferrer"
                           style={{ fontSize: 11, opacity: 0.7, textDecoration: 'underline' }}>open file</a>
                      </td>
                      <td style={{ padding: 6, maxWidth: 160 }}>
                        <div>{row.guess_doc_kind ?? '—'}</div>
                        <div style={{ opacity: 0.6 }}>conf {row.confidence != null ? Math.round(Number(row.confidence) * 100) + '%' : '—'}</div>
                      </td>
                      <td style={{ padding: 6, maxWidth: 320, opacity: 0.8 }}>
                        {(row.summary || row.extract_snippet || '').slice(0, 220)}
                      </td>
                      <td style={{ padding: 6 }}>
                        <select style={selStyle} value={e.doc_kind}
                          onChange={ev => setEdits(s => ({ ...s, [row.doc_id]: { ...e, doc_kind: ev.target.value } }))}>
                          {DOC_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: 6 }}>
                        <select style={selStyle} value={e.sensitivity}
                          onChange={ev => setEdits(s => ({ ...s, [row.doc_id]: { ...e, sensitivity: ev.target.value } }))}>
                          {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: 6 }}>
                        <button onClick={() => void confirm(row)} disabled={busy === row.doc_id}
                          style={{ ...selStyle, cursor: 'pointer', opacity: busy === row.doc_id ? 0.5 : 1 }}>
                          {busy === row.doc_id ? '…' : 'Confirm'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Container>
    </div>
  );
}
