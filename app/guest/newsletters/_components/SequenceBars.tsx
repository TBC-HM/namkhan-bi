'use client';
// app/guest/newsletters/_components/SequenceBars.tsx
// PBS 2026-07-22 · Horizontal bar per funnel: name · enrolled · sent(7d) · avg-open.

import type { CSSProperties } from 'react';
import TenantLink from '@/components/nav/TenantLink';

export interface SeqRow {
  funnel_id: string;
  property_id: number;
  funnel_key: string;
  name: string;
  status: string;
  enrolled: number;
  active: number;
  sent_7d: number;
  failed_7d: number;
  total_sent: number;
  total_opens: number;
  total_clicks: number;
  avg_open_rate: number;   // 0..1
  updated_at: string;
}

interface Props { rows: SeqRow[] }

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const GREEN = '#1F3A2E';

export default function SequenceBars({ rows }: Props) {
  const maxEnrolled = Math.max(1, ...rows.map(r => r.enrolled));

  if (rows.length === 0) {
    return (
      <div style={{ padding: '14px 16px', fontSize: 12, color: INK_M, background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6 }}>
        No active sequences yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => {
        const pctBar = Math.round((r.enrolled / maxEnrolled) * 100);
        return (
          <TenantLink
            key={r.funnel_id}
            href={`/guest/newsletters/sequences/${r.funnel_id}`}
            style={{
              display: 'block', textDecoration: 'none', color: 'inherit',
              background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '10px 14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>
                {r.name}
                <span style={{ marginLeft: 8, fontSize: 10, color: INK_M, fontWeight: 500, fontFamily: 'ui-monospace, monospace' }}>{r.funnel_key}</span>
              </div>
              <div style={{ fontSize: 11, color: INK_M }}>
                <strong style={{ color: INK }}>{r.enrolled.toLocaleString()}</strong> enrolled
                {' · '}
                <strong style={{ color: INK }}>{r.sent_7d.toLocaleString()}</strong> sent 7d
                {' · '}
                <strong style={{ color: INK }}>{(r.avg_open_rate * 100).toFixed(0)}%</strong> avg open
              </div>
            </div>
            <div style={{ marginTop: 6, height: 6, background: '#FAFAF7', border: `1px solid ${HAIR}`, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pctBar}%`, height: '100%', background: GREEN }} />
            </div>
          </TenantLink>
        );
      })}
    </div>
  );
}
