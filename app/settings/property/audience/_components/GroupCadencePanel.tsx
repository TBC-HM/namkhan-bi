'use client';
// app/settings/property/audience/_components/GroupCadencePanel.tsx
// PBS 2026-07-22 · Per-group newsletter cadence editor.
//
// Each subscriber group has a `newsletter_cadence_per_month` (0..7, step 0.25).
// The Director autopilot cron reads this per-group value to decide how often
// to plan slots for each group. 1.00 = weekly · 0.50 = biweekly · 0.25 = ~monthly.
// 0 = pause autopilot for that group.

import { useState, useTransition } from 'react';
import type { CSSProperties } from 'react';

export interface CadenceGroupRow {
  slug: string;
  name: string;
  color: string | null;
  newsletter_cadence_per_month: number | string | null;
  member_count?: number;
}

interface Props {
  groups: CadenceGroupRow[];
}

const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_S = '#5A5A5A';
const BRAND = '#084838';
const RED   = '#B03826';

function estimatePerYear(perMonth: number): string {
  if (perMonth <= 0) return 'paused';
  if (perMonth >= 4) return 'weekly';
  if (perMonth >= 2) return 'every 2 weeks';
  if (perMonth >= 1) return 'monthly';
  if (perMonth >= 0.5) return 'every 2 months';
  return `~${Math.round(perMonth * 12)}/yr`;
}

export default function GroupCadencePanel({ groups: initial }: Props) {
  const [rows, setRows] = useState<CadenceGroupRow[]>(() =>
    [...initial].sort((a, b) => a.name.localeCompare(b.name))
  );
  const [msg, setMsg]   = useState<string | null>(null);
  const [busy, startT]  = useTransition();

  function saveCadence(slug: string, cadence: number) {
    setRows(prev => prev.map(r => r.slug === slug ? { ...r, newsletter_cadence_per_month: cadence } : r));
    startT(async () => {
      const r = await fetch('/api/marketing/audience/group-cadence-save', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, cadence_per_month: cadence }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg('Save failed: ' + (j?.error ?? r.status)); return; }
      setMsg('Cadence saved.');
      setTimeout(() => setMsg(null), 1600);
    });
  }

  return (
    <section style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div>
          <div style={h3}>Group cadence · how often to plan for each audience</div>
          <div style={muted}>
            AI Director autopilot uses this. 4 = weekly · 2 = every 2 weeks · 1 = monthly · 0 pauses that group.
          </div>
        </div>
        <div style={{ fontSize: 11, color: INK_S }}>{rows.length} group{rows.length === 1 ? '' : 's'}</div>
      </div>

      {msg && (
        <div style={{
          padding: 8, fontSize: 12,
          background: msg.includes('failed') ? '#FBE8E4' : '#EEF6EE',
          color: msg.includes('failed') ? RED : '#1F5C2C',
          border: `1px solid ${msg.includes('failed') ? RED : '#C9E1C9'}`,
          borderRadius: 3, marginBottom: 8,
        }}>{msg}</div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${HAIR}` }}>
            <th style={th}>Group</th>
            <th style={th}>Cadence / month</th>
            <th style={{ ...th, textAlign: 'right' }}>Roughly</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => {
            const c = Number(g.newsletter_cadence_per_month ?? 1);
            return (
              <tr key={g.slug} style={{ borderBottom: `1px solid ${HAIR}` }}>
                <td style={{ ...tdL, whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: g.color ?? '#7A4B2A', border: `1px solid ${HAIR}` }} />
                    <span style={{ fontWeight: 500 }}>{g.name}</span>
                    <span style={{ fontSize: 10, color: INK_S, fontFamily: 'ui-monospace, monospace' }}>{g.slug}</span>
                  </span>
                </td>
                <td style={tdL}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="range" min={0} max={8} step={0.5}
                      value={c}
                      onChange={(e) => saveCadence(g.slug, Number(e.target.value))}
                      disabled={busy}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 600, minWidth: 40, textAlign: 'right' }}>{c.toFixed(1)}</span>
                  </div>
                </td>
                <td style={{ ...tdR, textAlign: 'right', color: INK_S }}>{estimatePerYear(c)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

const panel: CSSProperties = { border: `1px solid ${HAIR}`, borderRadius: 6, background: '#FFFFFF', padding: 16 };
const h3:    CSSProperties = { margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: INK };
const muted: CSSProperties = { margin: '0 0 12px', fontSize: 11, color: INK_S };
const th:    CSSProperties = { padding: '8px 10px', fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: INK, textAlign: 'left' };
const tdL:   CSSProperties = { padding: '10px 10px', fontSize: 12, color: INK };
const tdR:   CSSProperties = { padding: '10px 10px', fontSize: 12 };
