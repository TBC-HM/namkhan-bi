'use client';
// app/settings/guardrails/_components/GuardrailsClient.tsx
// PBS 2026-07-06 late evening: edit thresholds inline · updates via /api/guardrail/update.

import { useState } from 'react';

interface Row {
  id: number;
  domain: string;
  rule_key: string;
  threshold_kind: string;
  threshold_val: number | string;
  active: boolean;
  notes: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

const DOMAIN_LABEL: Record<string, string> = {
  retention:    'Retention',
  reputation:   'Reputation',
  newsletter:   'Newsletter',
  observations: 'Observations · data quality',
  revenue:      'Revenue',
  operations:   'Operations',
};

const KIND_LABEL: Record<string, string> = {
  gte: '≥',
  lte: '≤',
  eq:  '=',
};

export default function GuardrailsClient({ rows: initial }: { rows: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok'|'err'; text: string } | null>(null);

  const setRow = (id: number, patch: Partial<Row>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const save = async (row: Row) => {
    setSavingId(row.id);
    setMsg(null);
    try {
      const res = await fetch('/api/guardrail/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: row.domain,
          rule_key: row.rule_key,
          threshold_val: Number(row.threshold_val),
          active: row.active,
          notes: row.notes ?? '',
        }),
      });
      const j = await res.json();
      if (j.ok) setMsg({ kind: 'ok', text: `Saved ${row.domain} · ${row.rule_key}` });
      else setMsg({ kind: 'err', text: j.error ?? 'update failed' });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSavingId(null);
    }
  };

  // Group by domain
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = groups.get(r.domain) ?? [];
    arr.push(r);
    groups.set(r.domain, arr);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {msg && (
        <div style={{
          padding: '8px 12px', borderRadius: 4, fontSize: 12,
          background: msg.kind === 'ok' ? '#F0F7F2' : '#FFF3F1',
          color: msg.kind === 'ok' ? '#084838' : '#B04A2F',
          border: '1px solid ' + (msg.kind === 'ok' ? '#0848380F' : '#B04A2F33'),
        }}>{msg.text}</div>
      )}

      {Array.from(groups.entries()).map(([domain, list]) => (
        <div key={domain} style={box}>
          <div style={header}>
            <span style={pill}>{DOMAIN_LABEL[domain] ?? domain}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: '#5A5A5A' }}>
              {list.length} rule{list.length === 1 ? '' : 's'}
            </span>
          </div>
          <div style={{ padding: '4px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={th}>Rule</th>
                  <th style={th}>Kind</th>
                  <th style={th}>Threshold</th>
                  <th style={th}>Active</th>
                  <th style={th}>Notes</th>
                  <th style={th}>Updated</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {list.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #F5F0E1' }}>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#3A3A3A' }}>{r.rule_key}</td>
                    <td style={td}>{KIND_LABEL[r.threshold_kind] ?? r.threshold_kind}</td>
                    <td style={td}>
                      <input
                        type="number"
                        step="0.01"
                        value={String(r.threshold_val)}
                        onChange={e => setRow(r.id, { threshold_val: e.target.value })}
                        style={inp}
                      />
                    </td>
                    <td style={td}>
                      <input
                        type="checkbox"
                        checked={r.active}
                        onChange={e => setRow(r.id, { active: e.target.checked })}
                      />
                    </td>
                    <td style={td}>
                      <input
                        type="text"
                        value={r.notes ?? ''}
                        onChange={e => setRow(r.id, { notes: e.target.value })}
                        style={{ ...inp, width: 260 }}
                      />
                    </td>
                    <td style={{ ...td, fontSize: 10, color: '#5A5A5A' }}>
                      {r.updated_at ? new Date(r.updated_at).toLocaleDateString('en-GB') : '—'}
                      {r.updated_by ? <div>{r.updated_by}</div> : null}
                    </td>
                    <td style={td}>
                      <button
                        onClick={() => save(r)}
                        disabled={savingId === r.id}
                        style={btnSave}
                      >{savingId === r.id ? 'Saving…' : 'Save'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

const box: React.CSSProperties = { border: '1px solid #E6DFCC', borderRadius: 6, background: '#FFFFFF', overflow: 'hidden' };
const header: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#FAFAF7', borderBottom: '1px solid #E6DFCC' };
const pill: React.CSSProperties = { display: 'inline-block', padding: '3px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#FFFFFF', background: '#1B1B1B', borderRadius: 99, textTransform: 'uppercase' };
const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #E6DFCC', color: '#3A3A3A', fontSize: 11 };
const td: React.CSSProperties = { padding: '6px 12px', color: '#1B1B1B', fontSize: 12 };
const inp: React.CSSProperties = { padding: '4px 8px', fontSize: 12, border: '1px solid #E6DFCC', borderRadius: 3, background: '#FFFFFF', color: '#1B1B1B', width: 80 };
const btnSave: React.CSSProperties = { padding: '4px 12px', fontSize: 11, fontWeight: 600, background: '#084838', color: '#FFFFFF', border: '1px solid #084838', borderRadius: 3, cursor: 'pointer' };
