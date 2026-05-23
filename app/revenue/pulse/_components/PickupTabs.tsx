'use client';

// app/revenue/pulse/_components/PickupTabs.tsx
// 2 tabs in one box: "Pickup" + "Cancellations". Server pre-renders both
// data sets and passes them as serialized rows; this client component
// handles the tab toggle. Task #103 · 2026-05-23.

import { useState } from 'react';

interface Row {
  source: string;
  guest: string;
  reservation_id: string;
  accommodation: string;
  nights: number | string;
  adr: string;
  value: string;
  window: string;
}

interface Props {
  pickup: Row[];
  cancellations: Row[];
}

export default function PickupTabs({ pickup, cancellations }: Props) {
  const [tab, setTab] = useState<'pickup' | 'cancel'>('pickup');
  const active = tab === 'pickup' ? pickup : cancellations;
  const empty = tab === 'pickup' ? 'No bookings on this day' : 'No cancellations on this day';

  const tabStyle = (selected: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    fontSize: 11,
    fontWeight: selected ? 600 : 500,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    border: 'none',
    borderBottom: selected ? '2px solid var(--primary, #1F3A2E)' : '2px solid transparent',
    background: 'transparent',
    color: selected ? 'var(--ink, #1B1B1B)' : 'var(--ink-soft, #5A5A5A)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--hairline, #E6DFCC)', marginBottom: 8 }}>
        <button type="button" onClick={() => setTab('pickup')} style={tabStyle(tab === 'pickup')}>
          Pickup · {pickup.length}
        </button>
        <button type="button" onClick={() => setTab('cancel')} style={tabStyle(tab === 'cancel')}>
          Cancellations · {cancellations.length}
        </button>
      </div>
      {active.length === 0 ? (
        <div style={{ padding: 14, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>{empty}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#FAFAF7' }}>
                <th style={th}>Source</th>
                <th style={th}>Guest</th>
                <th style={th}>Reservation</th>
                <th style={th}>Room</th>
                <th style={{ ...th, textAlign: 'right' }}>LOS</th>
                <th style={{ ...th, textAlign: 'right' }}>ADR</th>
                <th style={{ ...th, textAlign: 'right' }}>Value</th>
                <th style={{ ...th, textAlign: 'right' }}>Window</th>
              </tr>
            </thead>
            <tbody>
              {active.map((r, i) => (
                <tr key={r.reservation_id + '-' + i} style={{ borderTop: '1px solid var(--hairline, #E6DFCC)' }}>
                  <td style={td}>{r.source}</td>
                  <td style={td}>{r.guest}</td>
                  <td style={tdMono}>{r.reservation_id}</td>
                  <td style={td}>{r.accommodation}</td>
                  <td style={tdR}>{r.nights}</td>
                  <td style={tdR}>{r.adr}</td>
                  <td style={tdR}>{r.value}</td>
                  <td style={tdR}>{r.window}</td>
                </tr>
              ))}
              {active.length > 1 && (
                <tr style={{ borderTop: '2px solid var(--ink, #1B1B1B)', background: '#FAFAF7' }}>
                  <td style={{ ...td, fontWeight: 600 }} colSpan={4}>
                    Total · {active.length} {tab === 'pickup' ? 'bookings' : 'cancellations'}
                  </td>
                  <td style={tdR}>
                    {active.reduce((s, r) => s + (typeof r.nights === 'number' ? r.nights : 0), 0)}
                  </td>
                  <td style={tdR}>—</td>
                  <td style={{ ...tdR, fontWeight: 600 }}>
                    {/* sum of value (string with currency) is hard to total client-side; show count */}
                    {/* delegate to server-rendered sum via prop? for now show '—' */}
                    —
                  </td>
                  <td style={tdR}>—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '6px 10px', fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', textAlign: 'left',
  borderBottom: '1px solid var(--hairline, #E6DFCC)',
};
const td: React.CSSProperties = { padding: '5px 10px', fontSize: 11, color: 'var(--ink, #1B1B1B)', whiteSpace: 'nowrap' };
const tdMono: React.CSSProperties = { ...td, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, color: 'var(--ink-soft, #5A5A5A)' };
const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
