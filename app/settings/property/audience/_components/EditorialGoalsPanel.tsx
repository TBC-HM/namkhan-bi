'use client';
// app/settings/property/audience/_components/EditorialGoalsPanel.tsx
// PBS 2026-07-22 · Editorial goals editor moved from /guest/newsletters/director.
//
// Weight scale is 0-100 (share-of-slots). AI Director normalises weight/SUM(weights).
// Existing 0-10 weights were multiplied by 10 in the accompanying migration.
//
// Fields per row: label (editable) · goal_key (read-only, monospace) · weight slider (0-100)
//                 · active toggle · Delete (custom rows only).
// Add row: input for label + auto-slug key + weight 20 default.

import { useMemo, useState, useTransition } from 'react';
import type { CSSProperties } from 'react';

export interface GoalRow {
  id: number;
  property_id: number;
  goal_key: string;
  goal_label: string;
  weight: number;      // 0..100
  active: boolean;
}

interface Props {
  propertyId: number;
  initial: GoalRow[];
}

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_S = '#5A5A5A';
const BRAND = '#084838';
const RED   = '#B03826';

// system keys — do NOT allow deletion or key-edit
const SYSTEM_KEYS = new Set(['retreats', 'wellness', 'roots', 'eco-farm', 'green-season', 'loyalty', 'seasonal']);

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

// Assumes ~50 broadcasts/year cadence baseline; overridden by any share > 0.
function estimateSlotsPerYear(share: number): number {
  const CADENCE = 52;  // one B2C broadcast per week at most, per PBS guidance
  return Math.round(share * CADENCE);
}

export default function EditorialGoalsPanel({ propertyId, initial }: Props) {
  const [rows, setRows] = useState<GoalRow[]>(() => [...initial].sort((a, b) => b.weight - a.weight));
  const [newLabel, setNewLabel] = useState('');
  const [newWeight, setNewWeight] = useState(20);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, startT] = useTransition();

  const totalWeight = useMemo(() => rows.filter(r => r.active).reduce((s, r) => s + (r.weight || 0), 0), [rows]);

  function saveGoal(row: GoalRow, patch: Partial<GoalRow>) {
    const next = { ...row, ...patch };
    setRows(prev => prev.map(r => r.id === row.id ? next : r));
    startT(async () => {
      const r = await fetch('/api/marketing/director/goal-upsert', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          goal_key: next.goal_key,
          goal_label: next.goal_label,
          weight: next.weight,
          active: next.active,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg('Save failed: ' + (j?.error ?? r.status)); return; }
      setMsg('Goal saved.');
      setTimeout(() => setMsg(null), 1600);
    });
  }

  async function deleteGoal(id: number) {
    if (!confirm('Delete this custom goal? The AI Director will stop planning for it.')) return;
    startT(async () => {
      const r = await fetch(`/api/marketing/director/goal-upsert?id=${id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg('Delete failed: ' + (j?.error ?? r.status)); return; }
      setRows(prev => prev.filter(x => x.id !== id));
      setMsg('Goal deleted.');
      setTimeout(() => setMsg(null), 1600);
    });
  }

  async function addGoal() {
    const label = newLabel.trim();
    if (!label) return;
    const key = slugify(label);
    if (!key) { setMsg('Label produces an empty key.'); return; }
    if (rows.some(r => r.goal_key === key)) { setMsg('A goal with that key already exists.'); return; }
    startT(async () => {
      const r = await fetch('/api/marketing/director/goal-upsert', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, goal_key: key, goal_label: label, weight: newWeight, active: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg('Add failed: ' + (j?.error ?? r.status)); return; }
      const newRow: GoalRow = { id: Number(j.id ?? Date.now()), property_id: propertyId, goal_key: key, goal_label: label, weight: newWeight, active: true };
      setRows(prev => [...prev, newRow].sort((a, b) => b.weight - a.weight));
      setNewLabel(''); setNewWeight(20);
      setMsg('Goal added.');
      setTimeout(() => setMsg(null), 1600);
    });
  }

  return (
    <section style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div>
          <div style={h3}>Editorial goals · weights (0-100)</div>
          <div style={muted}>
            Higher weight = higher share of the AI Director's calendar slots.{' '}
            {totalWeight > 0
              ? `Active total: ${totalWeight}. Each row shows its normalised share.`
              : 'No active weights yet — the Director will stall until you set some.'}
          </div>
        </div>
        <div style={{ fontSize: 11, color: INK_S }}>{rows.length} goal{rows.length === 1 ? '' : 's'}</div>
      </div>

      {msg && (
        <div style={{ padding: 8, fontSize: 12, background: msg.includes('failed') ? '#FBE8E4' : '#EEF6EE',
                      color: msg.includes('failed') ? RED : '#1F5C2C',
                      border: `1px solid ${msg.includes('failed') ? RED : '#C9E1C9'}`, borderRadius: 3, marginBottom: 8 }}>
          {msg}
        </div>
      )}

      <div style={{ border: `1px solid ${HAIR}`, borderRadius: 4, overflow: 'hidden', background: WHITE }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#FAFAF7', borderBottom: `1px solid ${HAIR}` }}>
              <th style={th}>Goal label</th>
              <th style={th}>Key</th>
              <th style={{ ...th, width: 260 }}>Weight (0-100)</th>
              <th style={{ ...th, width: 140 }}>Share · ~slots/yr</th>
              <th style={{ ...th, width: 70, textAlign: 'center' }}>Active</th>
              <th style={{ ...th, width: 90, textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const share = totalWeight > 0 && r.active ? r.weight / totalWeight : 0;
              const isSystem = SYSTEM_KEYS.has(r.goal_key);
              return (
                <tr key={r.id} style={{ borderBottom: `1px solid ${HAIR}` }}>
                  <td style={tdL}>
                    <input
                      type="text" defaultValue={r.goal_label}
                      onBlur={(e) => e.target.value !== r.goal_label && saveGoal(r, { goal_label: e.target.value })}
                      style={{ ...inp, width: '100%', maxWidth: 280 }}
                    />
                  </td>
                  <td style={{ ...tdL, fontFamily: 'ui-monospace, monospace', fontSize: 11, color: INK_S }}>{r.goal_key}</td>
                  <td style={tdL}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="range" min={0} max={100} step={1} defaultValue={r.weight}
                        disabled={busy}
                        onMouseUp={(e) => saveGoal(r, { weight: Number((e.target as HTMLInputElement).value) })}
                        onTouchEnd={(e) => saveGoal(r, { weight: Number((e.target as HTMLInputElement).value) })}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: INK, minWidth: 30, textAlign: 'right' }}>{r.weight}</span>
                    </div>
                  </td>
                  <td style={{ ...tdL, fontSize: 11, color: INK_S }}>
                    {r.active ? `${(share * 100).toFixed(0)}% · ~${estimateSlotsPerYear(share)}/yr` : '—'}
                  </td>
                  <td style={{ ...tdL, textAlign: 'center' }}>
                    <input
                      type="checkbox" defaultChecked={r.active}
                      onChange={(e) => saveGoal(r, { active: e.target.checked })}
                      disabled={busy}
                    />
                  </td>
                  <td style={{ ...tdL, textAlign: 'right' }}>
                    {!isSystem && (
                      <button type="button" onClick={() => deleteGoal(r.id)} disabled={busy} style={dangerBtn}>Delete</button>
                    )}
                    {isSystem && <span style={{ fontSize: 10, color: INK_S }}>system</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Add-row */}
        <div style={{ padding: 12, background: '#FAFAF7', borderTop: `1px solid ${HAIR}`, display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <label style={fieldWrap}>
            <span style={fieldLabel}>New goal label</span>
            <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Family stays" style={{ ...inp, width: 260 }} />
          </label>
          <label style={fieldWrap}>
            <span style={fieldLabel}>Weight</span>
            <input type="number" min={0} max={100} step={1} value={newWeight} onChange={(e) => setNewWeight(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} style={{ ...inp, width: 80 }} />
          </label>
          <button type="button" onClick={addGoal} disabled={busy || !newLabel.trim()} style={primaryBtn}>+ Add custom goal</button>
        </div>
      </div>
    </section>
  );
}

// ---------- styles ----------
const panel: CSSProperties = { border: `1px solid ${HAIR}`, borderRadius: 6, background: WHITE, padding: 16 };
const h3: CSSProperties    = { fontSize: 13, fontWeight: 700, color: INK };
const muted: CSSProperties = { fontSize: 11, color: INK_S, marginTop: 2 };
const th: CSSProperties    = { padding: '8px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: INK, textAlign: 'left' };
const tdL: CSSProperties   = { padding: '7px 10px', fontSize: 12, color: INK, verticalAlign: 'middle' };
const inp: CSSProperties   = { padding: '4px 8px', border: `1px solid ${HAIR}`, borderRadius: 3, background: WHITE, color: INK, fontSize: 12, boxSizing: 'border-box' };
const primaryBtn: CSSProperties = { padding: '6px 14px', background: BRAND, color: WHITE, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const dangerBtn: CSSProperties  = { padding: '4px 10px', background: WHITE, color: RED, border: `1px solid ${RED}`, borderRadius: 3, fontSize: 11, cursor: 'pointer' };
const fieldWrap: CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 3 };
const fieldLabel: CSSProperties = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_S, fontWeight: 700 };
