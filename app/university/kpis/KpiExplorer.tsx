'use client';
// app/university/kpis/KpiExplorer.tsx
// TBC University · KPI dictionary explorer. Client-side: search box filters
// across name / meaning / formula; KPIs group into family sections. Each card
// shows name, plain meaning, plain formula, watch-out, and an AI DRAFT badge
// until the definition is gated/approved.

import { useMemo, useState } from 'react';
import { INK, INK_SOFT, HAIR, GREEN, GOLD, WARM, TIP_BG, TIP_BORDER, WARN_BG, WARN_BORDER } from '../_lib/theme';

export type KpiRow = {
  label: string; family: string; meaning: string; formula: string;
  watchOut: string; status: string;
};

const GATED = new Set(['gated', 'approved', 'verified', 'final', 'confirmed']);

export default function KpiExplorer({ kpis }: { kpis: KpiRow[] }) {
  const [q, setQ] = useState('');

  const families = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? kpis.filter((k) =>
          [k.label, k.family, k.meaning, k.formula, k.watchOut].join(' ').toLowerCase().includes(needle))
      : kpis;
    const byFamily = new Map<string, KpiRow[]>();
    for (const k of filtered) {
      if (!byFamily.has(k.family)) byFamily.set(k.family, []);
      byFamily.get(k.family)!.push(k);
    }
    for (const list of Array.from(byFamily.values())) list.sort((a, b) => a.label.localeCompare(b.label));
    return Array.from(byFamily.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [kpis, q]);

  return (
    <div>
      <input
        type="search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder='Search a number — e.g. "RevPAR", "occupancy", "no-show"'
        style={{
          width: '100%', boxSizing: 'border-box', fontSize: 14.5, padding: '11px 14px',
          border: `1px solid ${HAIR}`, borderRadius: 6, fontFamily: 'inherit', color: INK,
          background: '#FFFFFF', outline: 'none',
        }}
      />

      {families.length === 0 && (
        <div style={{ marginTop: 16, fontSize: 13.5, color: INK_SOFT }}>
          Nothing matches &ldquo;{q}&rdquo; — try a shorter word.
        </div>
      )}

      {families.map(([family, list]) => (
        <section key={family} style={{ marginTop: 24 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_SOFT }}>
            {family}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
            {list.map((k) => {
              const gated = GATED.has((k.status || '').toLowerCase());
              return (
                <div key={`${family}-${k.label}`} style={{
                  background: '#FFFFFF', border: `1px solid ${HAIR}`, borderRadius: 8, padding: '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>{k.label}</span>
                    {!gated && (
                      <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 3, padding: '1px 6px', flex: 'none' }}
                        title="This definition was drafted by AI and has not been signed off yet.">
                        AI DRAFT
                      </span>
                    )}
                  </div>
                  {k.meaning && (
                    <div style={{ fontSize: 13.5, lineHeight: 1.6, color: INK }}>{k.meaning}</div>
                  )}
                  {k.formula && (
                    <div style={{ background: TIP_BG, border: `1px solid ${TIP_BORDER}`, borderRadius: 5, padding: '8px 11px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: GREEN, marginBottom: 3 }}>How it&rsquo;s calculated</div>
                      <div style={{ fontSize: 12.5, lineHeight: 1.55, color: INK }}>{k.formula}</div>
                    </div>
                  )}
                  {k.watchOut && (
                    <div style={{ background: WARN_BG, border: `1px solid ${WARN_BORDER}`, borderRadius: 5, padding: '8px 11px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: GOLD, marginBottom: 3 }}>Watch out</div>
                      <div style={{ fontSize: 12.5, lineHeight: 1.55, color: INK }}>{k.watchOut}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <div style={{ marginTop: 20, fontSize: 11, color: '#8A8A8A', background: WARM, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '8px 12px' }}>
        Definitions marked AI DRAFT were written by the system and are waiting for sign-off. If a number
        on a dashboard does not match its definition here, tell PBS — the definition wins.
      </div>
    </div>
  );
}
