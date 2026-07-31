'use client';

// ScratchSheet — "Sheet from scratch" (brief §10.3).
// A blank value grid the user creates, edits and saves. Snapshot-on-save
// into reports.workbooks (type=custom_scratch) — registered like any
// workbook, owned by the creator, versioned by refresh timestamps.
// Plain values only: no formulas, no metric writes, never a truth source.

import { useCallback, useEffect, useState } from 'react';
import { Container } from '@/app/(cockpit)/_design';
import type { StudioScratchSnapshot, StudioWorkbookRow } from '@/lib/studio/types';
import { UI, fmtTs } from './studioUi';

interface Props {
  scope: 'holding' | 'property';
  propertyId: number | null;
}

const BLANK_COLS = ['A', 'B', 'C'];
const BLANK_ROWS = 8;

function blankGrid(): { cols: string[]; rows: string[][] } {
  return {
    cols: [...BLANK_COLS],
    rows: Array.from({ length: BLANK_ROWS }, () => BLANK_COLS.map(() => '')),
  };
}

export default function ScratchSheet({ scope, propertyId }: Props) {
  const [workbookId, setWorkbookId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [cols, setCols] = useState<string[]>(blankGrid().cols);
  const [rows, setRows] = useState<string[][]>(blankGrid().rows);
  const [saved, setSaved] = useState<StudioWorkbookRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    try {
      const qs = scope === 'holding' ? 'scope=holding' : `property_id=${propertyId}`;
      const res = await fetch(`/api/reports/studio/scratch?${qs}`);
      const json = (await res.json()) as { workbooks?: StudioWorkbookRow[] };
      setSaved((json.workbooks ?? []).filter((w) => w.type === 'custom_scratch'));
    } catch {
      // list is non-critical; editing still works
    }
  }, [scope, propertyId]);

  useEffect(() => { void refreshList(); }, [refreshList]);

  const newBlank = useCallback(() => {
    const g = blankGrid();
    setWorkbookId(null);
    setName('');
    setCols(g.cols);
    setRows(g.rows);
    setSavedAt(null);
    setError(null);
  }, []);

  const load = useCallback(async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/studio/scratch?id=${id}`);
      const json = (await res.json()) as {
        workbook?: { id: string; snapshot: StudioScratchSnapshot; last_refresh: string | null };
        error?: string;
      };
      if (!res.ok || json.error || !json.workbook) throw new Error(json.error ?? 'load failed');
      const snap = json.workbook.snapshot;
      setWorkbookId(json.workbook.id);
      setName(snap.name ?? '');
      setCols(snap.cols?.length ? snap.cols : blankGrid().cols);
      setRows(snap.rows ?? []);
      setSavedAt(json.workbook.last_refresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed');
    } finally {
      setBusy(false);
    }
  }, []);

  const save = useCallback(async () => {
    if (!name.trim()) { setError('Name the sheet before saving.'); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/reports/studio/scratch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workbook_id: workbookId,
          scope,
          property_id: propertyId,
          snapshot: { name: name.trim(), cols, rows },
        }),
      });
      const json = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? 'save failed');
      if (json.id) setWorkbookId(json.id);
      setSavedAt(new Date().toISOString());
      await refreshList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'save failed');
    } finally {
      setBusy(false);
    }
  }, [name, cols, rows, workbookId, scope, propertyId, refreshList]);

  return (
    <Container
      title="Sheet from scratch"
      subtitle="Blank working grid — registered as a workbook, snapshot saved to the platform on every save"
      action={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={UI.btnGhost} onClick={newBlank}>New blank sheet</button>
          <button type="button" style={UI.btn} disabled={busy} onClick={() => void save()}>
            {busy ? '…' : workbookId ? 'Save' : 'Save as workbook'}
          </button>
        </div>
      }
    >
      <div style={UI.row}>
        <span style={UI.label}>Name</span>
        <input
          style={{ ...UI.input, minWidth: 220 }}
          value={name}
          placeholder="e.g. Vendor shortlist March"
          onChange={(e) => setName(e.target.value)}
        />
        {savedAt && <span style={UI.note}>saved {fmtTs(savedAt)}</span>}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={UI.th}>#</th>
              {cols.map((c, ci) => (
                <th key={ci} style={UI.th}>
                  <input
                    style={{ ...UI.cell, fontWeight: 600 }}
                    value={c}
                    onChange={(e) => setCols(cols.map((x, j) => (j === ci ? e.target.value : x)))}
                  />
                </th>
              ))}
              <th style={UI.th}>
                <button
                  type="button"
                  style={UI.chip}
                  disabled={cols.length >= 40}
                  onClick={() => {
                    setCols([...cols, `Col ${cols.length + 1}`]);
                    setRows(rows.map((r) => [...r, '']));
                  }}
                >
                  + col
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                <td style={UI.td}>{ri + 1}</td>
                {cols.map((_, ci) => (
                  <td key={ci} style={{ padding: 2 }}>
                    <input
                      style={UI.cell}
                      value={r[ci] ?? ''}
                      onChange={(e) =>
                        setRows(rows.map((row, j) =>
                          j === ri ? row.map((cell, k) => (k === ci ? e.target.value : cell)) : row,
                        ))
                      }
                    />
                  </td>
                ))}
                <td style={{ padding: 2 }}>
                  <button type="button" style={UI.chip} onClick={() => setRows(rows.filter((_, j) => j !== ri))}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={UI.row}>
        <button
          type="button"
          style={UI.btnGhost}
          disabled={rows.length >= 500}
          onClick={() => setRows([...rows, cols.map(() => '')])}
        >
          + row
        </button>
        <span style={UI.note}>Plain values only — canon numbers stay in the Builder over gold views.</span>
      </div>
      {error && <div style={UI.err}>{error}</div>}

      {saved.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={UI.label}>Saved scratch sheets</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {saved.map((w) => (
              <button
                key={w.id}
                type="button"
                style={w.id === workbookId ? UI.chipOn : UI.chip}
                onClick={() => void load(w.id)}
              >
                {w.display_name ?? `${w.id.slice(0, 8)}…`} · {fmtTs(w.last_refresh ?? w.created_at)}
              </button>
            ))}
          </div>
        </div>
      )}
    </Container>
  );
}
