'use client';

// app/holding/it/cockpit/memory/DocBrowser.tsx
// A1: per-doc_type version timeline (every snapshot since the 2026-07-27
// baseline) + pick any two versions -> side-by-side line diff.
// Snapshot bodies come on demand from fn_get_doc_version via the module API;
// diffing is the in-house LCS util (no npm dependency — §0.R R2).

import { useMemo, useState } from 'react';
import { Container } from '@/app/(cockpit)/_design';
import { diffLines, diffStats, type DiffOp } from './diff';
import type { DocVersionRow } from './MemoryView';

const MONO = 'JetBrains Mono, ui-monospace, monospace';

type Snapshot = { hist_id: number; content_md: string };

export function DocBrowser({
  versions, focusDocType,
}: {
  versions: DocVersionRow[]; focusDocType: string | null;
}) {
  const byType = useMemo(() => {
    const m = new Map<string, DocVersionRow[]>();
    for (const v of versions) {
      const arr = m.get(v.doc_type) ?? [];
      arr.push(v);
      m.set(v.doc_type, arr);
    }
    // newest first inside each type (page already orders desc, keep stable)
    return m;
  }, [versions]);

  const types = useMemo(() => Array.from(byType.keys()).sort(), [byType]);
  const [active, setActive] = useState<string>(focusDocType && byType.has(focusDocType) ? focusDocType : types[0] ?? '');
  const [selected, setSelected] = useState<number[]>([]); // hist_ids, max 2
  const [cache, setCache] = useState<Record<number, Snapshot>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // honor a search deep link arriving after mount
  const [lastFocus, setLastFocus] = useState<string | null>(null);
  if (focusDocType && focusDocType !== lastFocus && byType.has(focusDocType)) {
    setLastFocus(focusDocType);
    setActive(focusDocType);
    setSelected([]);
  }

  const rows = byType.get(active) ?? [];

  function toggle(histId: number) {
    setSelected((prev) => {
      if (prev.includes(histId)) return prev.filter((h) => h !== histId);
      if (prev.length >= 2) return [prev[1], histId];
      return [...prev, histId];
    });
  }

  async function fetchSnapshot(histId: number): Promise<Snapshot> {
    if (cache[histId]) return cache[histId];
    const r = await fetch('/api/holding/it/cockpit/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'doc_version', hist_id: histId }),
    });
    const j = (await r.json()) as { snapshot?: { content_md?: string }; error?: string };
    if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
    const snap: Snapshot = { hist_id: histId, content_md: j.snapshot?.content_md ?? '' };
    setCache((c) => ({ ...c, [histId]: snap }));
    return snap;
  }

  const [diff, setDiff] = useState<{ a: DocVersionRow; b: DocVersionRow; ops: DiffOp[] } | null>(null);

  async function runDiff() {
    if (selected.length !== 2 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const rowA = rows.find((r) => r.hist_id === selected[0])!;
      const rowB = rows.find((r) => r.hist_id === selected[1])!;
      // older first
      const [oldRow, newRow] = rowA.version <= rowB.version ? [rowA, rowB] : [rowB, rowA];
      const [oldSnap, newSnap] = await Promise.all([fetchSnapshot(oldRow.hist_id), fetchSnapshot(newRow.hist_id)]);
      setDiff({ a: oldRow, b: newRow, ops: diffLines(oldSnap.content_md, newSnap.content_md) });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Container
        title="Doc version timelines"
        subtitle={`${types.length} doc_types · ${versions.length} snapshots since the 2026-07-27 history baseline`}
      >
        <div style={{ display: 'flex', gap: 16 }}>
          {/* doc_type list */}
          <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {types.map((t) => (
              <button
                key={t}
                onClick={() => { setActive(t); setSelected([]); setDiff(null); }}
                style={{
                  textAlign: 'left', appearance: 'none', cursor: 'pointer',
                  padding: '7px 10px', borderRadius: 7, border: 'none',
                  fontSize: 12.5, fontFamily: MONO,
                  background: t === active ? 'rgba(31,58,46,0.10)' : 'transparent',
                  color: t === active ? 'var(--primary)' : 'var(--ink)',
                  fontWeight: t === active ? 700 : 500,
                }}
              >
                {t}
                <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}> · {(byType.get(t) ?? []).length}</span>
              </button>
            ))}
          </div>

          {/* timeline for the active doc_type */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10 }}>
              Select two snapshots, then Compare. Timeline shows every history row for <b>{active}</b>.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rows.map((r) => {
                const sel = selected.includes(r.hist_id);
                return (
                  <button
                    key={r.hist_id}
                    onClick={() => toggle(r.hist_id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                      appearance: 'none', cursor: 'pointer', padding: '8px 12px',
                      borderRadius: 8, background: sel ? 'rgba(31,58,46,0.08)' : '#FFFFFF',
                      border: sel ? '1px solid var(--primary)' : '1px solid var(--hairline)',
                    }}
                  >
                    <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: 'var(--primary)', width: 42 }}>
                      v{r.version}
                    </span>
                    <span style={{ fontSize: 12.5, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.title ?? r.doc_type}
                    </span>
                    <span style={{ fontSize: 11, fontFamily: MONO, color: 'var(--ink-soft)' }}>
                      {(r.md_len ?? 0).toLocaleString()} ch
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-soft)', width: 150, textAlign: 'right' }}>
                      {new Date(r.snapshotted_at).toLocaleString()}
                    </span>
                    {r.last_updated_by && (
                      <span style={{ fontSize: 11, color: 'var(--ink-soft)', width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.last_updated_by}
                      </span>
                    )}
                  </button>
                );
              })}
              {rows.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>No snapshots for this doc_type yet.</div>
              )}
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => void runDiff()}
                disabled={selected.length !== 2 || busy}
                style={{
                  padding: '8px 16px', fontSize: 12.5, fontFamily: MONO, fontWeight: 700,
                  background: selected.length === 2 ? 'var(--primary)' : 'var(--hairline)',
                  color: selected.length === 2 ? '#FFFFFF' : 'var(--ink-soft)',
                  border: 'none', borderRadius: 8, cursor: selected.length === 2 ? 'pointer' : 'default',
                }}
              >
                {busy ? 'Loading…' : `Compare ${selected.length}/2`}
              </button>
              {err && <span style={{ fontSize: 12, color: 'var(--status-red)' }}>{err}</span>}
            </div>
          </div>
        </div>
      </Container>

      {diff && <DiffPane a={diff.a} b={diff.b} ops={diff.ops} onClose={() => setDiff(null)} />}
    </div>
  );
}

type SideRow = { left: string | null; right: string | null; kind: 'same' | 'change' | 'gap' };

// Convert linear diff ops into aligned side-by-side rows: pair each run of
// deletions with the following run of additions (classic two-pane alignment).
function toSideRows(ops: DiffOp[]): SideRow[] {
  const out: SideRow[] = [];
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.type === 'same') {
      out.push({ left: op.line, right: op.line, kind: 'same' });
      i++;
      continue;
    }
    const dels: string[] = [];
    const adds: string[] = [];
    while (i < ops.length && ops[i].type === 'del') { dels.push(ops[i].line); i++; }
    while (i < ops.length && ops[i].type === 'add') { adds.push(ops[i].line); i++; }
    const rows = Math.max(dels.length, adds.length);
    for (let k = 0; k < rows; k++) {
      out.push({ left: k < dels.length ? dels[k] : null, right: k < adds.length ? adds[k] : null, kind: 'change' });
    }
  }
  return out;
}

function DiffPane({ a, b, ops, onClose }: { a: DocVersionRow; b: DocVersionRow; ops: DiffOp[]; onClose: () => void }) {
  const { added, removed } = diffStats(ops);
  const [hideSame, setHideSame] = useState(true);

  const sideRows = useMemo(() => toSideRows(ops), [ops]);

  // collapse long unchanged runs to 2 context lines each side when hideSame
  const visible = useMemo(() => {
    if (!hideSame) return sideRows.map((r, i) => ({ r, i }));
    const keep = new Set<number>();
    sideRows.forEach((r, i) => {
      if (r.kind === 'change') {
        for (let k = Math.max(0, i - 2); k <= Math.min(sideRows.length - 1, i + 2); k++) keep.add(k);
      }
    });
    const out: Array<{ r: SideRow; i: number }> = [];
    let inGap = false;
    sideRows.forEach((r, i) => {
      if (keep.has(i)) {
        out.push({ r, i });
        inGap = false;
      } else if (!inGap) {
        out.push({ r: { left: null, right: null, kind: 'gap' }, i });
        inGap = true;
      }
    });
    return out;
  }, [sideRows, hideSame]);

  return (
    <Container
      title={`Diff · ${a.doc_type} v${a.version} → v${b.version}`}
      subtitle={`+${added} added · −${removed} removed lines`}
      action={
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: 11.5, color: 'var(--ink-soft)', display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={hideSame} onChange={(e) => setHideSame(e.target.checked)} />
            changes only
          </label>
          <button
            onClick={onClose}
            style={{ appearance: 'none', border: '1px solid var(--hairline)', background: '#FFFFFF', borderRadius: 7, padding: '4px 10px', fontSize: 11.5, cursor: 'pointer', color: 'var(--ink)' }}
          >
            Close
          </button>
        </div>
      }
    >
      <div style={{ maxHeight: 560, overflow: 'auto', border: '1px solid var(--hairline)', borderRadius: 8, background: '#FFFFFF' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 11.5, lineHeight: 1.55, tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: '#FFFFFF', zIndex: 1 }}>
              <th style={{ width: '50%', textAlign: 'left', padding: '6px 10px', fontSize: 10.5, color: 'var(--ink-soft)', borderBottom: '1px solid var(--hairline)', borderRight: '1px solid var(--hairline)' }}>
                v{a.version} · {new Date(a.snapshotted_at).toLocaleDateString()}
              </th>
              <th style={{ width: '50%', textAlign: 'left', padding: '6px 10px', fontSize: 10.5, color: 'var(--ink-soft)', borderBottom: '1px solid var(--hairline)' }}>
                v{b.version} · {new Date(b.snapshotted_at).toLocaleDateString()}
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ r, i }) =>
              r.kind === 'gap' ? (
                <tr key={`gap-${i}`}>
                  <td colSpan={2} style={{ padding: '2px 10px', color: 'var(--ink-soft)', background: 'rgba(90,90,90,0.05)', textAlign: 'center', fontSize: 10.5 }}>
                    ··· unchanged ···
                  </td>
                </tr>
              ) : (
                <tr key={i}>
                  <td style={{
                    padding: '0 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', verticalAlign: 'top',
                    color: 'var(--ink)', borderRight: '1px solid var(--hairline)',
                    background: r.kind === 'change' ? (r.left !== null ? 'rgba(184,84,42,0.08)' : 'rgba(90,90,90,0.04)') : 'transparent',
                  }}>
                    {r.left ?? ' '}
                  </td>
                  <td style={{
                    padding: '0 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', verticalAlign: 'top',
                    color: 'var(--ink)',
                    background: r.kind === 'change' ? (r.right !== null ? 'rgba(31,58,46,0.08)' : 'rgba(90,90,90,0.04)') : 'transparent',
                  }}>
                    {r.right ?? ' '}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </Container>
  );
}
