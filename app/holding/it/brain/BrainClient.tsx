'use client';

// app/holding/it/brain/BrainClient.tsx
// BRAIN v1 · client console: pipeline tiles · human review queue · ask window.
// Data via /api/brain/review (GET tiles+queue, POST confirm).
// Central Chat round 3 (brief central-chat-v1 §0.B.1): the inline
// /api/brain/ask window is replaced by the one CentralChat, scoped brain —
// the brain stays a context source consulted by Felix via the chat route.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Container, KpiTile } from '@/app/(cockpit)/_design';
import { BRAIN_DOC_KINDS, BRAIN_TIERS } from '@/lib/brain/taxonomy';
import CentralChat from '@/components/chat/CentralChat';

const DOC_KINDS: string[] = [...BRAIN_DOC_KINDS];
const TIERS: string[] = [...BRAIN_TIERS];

type PipelineStatus = {
  total_docs: number; extract_pending: number; extracted: number; ocr_needed: number;
  extract_failed: number; skipped: number; classified: number; needs_human: number;
  human_confirmed: number; excluded: number; chunks_total: number; chunks_embedded: number;
  docs_chunked: number;
};

type MissingSummary = {
  no_source: number; storage_object_missing: number; empty_file: number;
  ocr_terminal_failed: number; unsupported_format: number; total_missing: number;
};

type BatteryRun = {
  run_id: number; ran_at: string; trigger: string; total: number;
  passed: number; pass_rate: number; ok: boolean;
};

type QueueRow = {
  doc_id: string; filename: string | null; title: string | null; dms_doc_type: string | null;
  extract_snippet: string | null; guess_doc_kind: string | null; guess_sensitivity: string | null;
  confidence: number | null; summary: string | null; created_at: string;
};

export default function BrainClient() {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [missing, setMissing] = useState<MissingSummary | null>(null);
  const [battery, setBattery] = useState<BatteryRun[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [edits, setEdits] = useState<Record<string, { doc_kind: string; sensitivity: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

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
      setMissing((j.missing ?? null) as MissingSummary | null);
      setBattery((j.battery ?? []) as BatteryRun[]);
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

  const tiles = useMemo(() => status ? [
    { label: 'Extract pending', value: status.extract_pending, footnote: 'files awaiting MD shadow' },
    { label: 'Extracted', value: status.extracted, footnote: 'MD shadow written' },
    { label: 'OCR needed', value: status.ocr_needed, footnote: 'scanned PDFs, deferred' },
    { label: 'Failed / skipped', value: status.extract_failed + status.skipped, footnote: `${status.extract_failed} failed · ${status.skipped} skipped` },
    { label: 'Classified', value: status.classified + status.human_confirmed, footnote: `${status.human_confirmed} human-confirmed` },
    { label: 'Needs human', value: status.needs_human, footnote: 'review below' },
    { label: 'Excluded (HR etc.)', value: status.excluded, footnote: 'never retrievable' },
    { label: 'Chunks', value: status.chunks_total, footnote: `${status.chunks_embedded} embedded · ${status.docs_chunked} docs` },
    // BRAIN v5 · D4b missing-file stripe + D7 battery tile
    ...(missing ? [{
      label: 'Missing file', value: missing.total_missing,
      footnote: `${missing.no_source} no source · ${missing.storage_object_missing} object gone · ${missing.ocr_terminal_failed} OCR-dead`,
    }] : []),
    ...(battery.length > 0 ? [{
      label: 'Battery (nightly)', value: `${battery[0].pass_rate}%`,
      footnote: `${battery[0].ok ? 'green' : 'RED'} · ${battery[0].passed}/${battery[0].total} · ${new Date(battery[0].ran_at).toISOString().slice(0, 10)}`,
    }] : [{ label: 'Battery (nightly)', value: '—', footnote: 'no scheduled run recorded yet' }]),
  ] : [], [status, missing, battery]);

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

      {missing && missing.total_missing > 0 ? (
        <div style={{ fontSize: 12, opacity: 0.8, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span>
            {missing.total_missing} registry rows have no readable file (never deleted — registry honesty).
          </span>
          <a href="/api/brain/missing-files" download
             style={{ textDecoration: 'underline', color: 'var(--tbl-fg, #8ab4f8)' }}>
            Download missing-file CSV
          </a>
        </div>
      ) : null}

      <Container title="Ask the company brain" subtitle="One channel — Felix answers with brain context (HR/payroll stays excluded from retrieval)">
        <CentralChat mode="second-brain" moduleScope="brain" />
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