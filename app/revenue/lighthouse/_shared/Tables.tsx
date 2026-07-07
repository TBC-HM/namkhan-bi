// app/revenue/lighthouse/_shared/Tables.tsx
// PBS 2026-07-07: Presentational tables for the 5 Lighthouse views.
// Design tokens: paper white + hairlines (#E6DFCC) per feedback_paper_white_default_for_tables.
// Green = better price (lower own, higher demand), red = worse.

import type { OverviewRow, RatesRow, DeltaRow, HotelMeta } from './data';

// ── shared cell styles ────────────────────────────────────────
const th: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: 0.4, color: '#5A5A5A', padding: '8px 10px',
  borderBottom: '1px solid #E6DFCC', textAlign: 'left', background: '#FFFFFF',
  position: 'sticky', top: 0, whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  fontSize: 12, color: '#1B1B1B', padding: '6px 10px',
  borderBottom: '1px solid #F0EBD8', whiteSpace: 'nowrap',
};
const tdMuted: React.CSSProperties = { ...td, color: '#9A9A9A' };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const tdWeekend: React.CSSProperties = { background: '#FBF7EA' };

// ── formatters ────────────────────────────────────────────────
const pct = (v: number | null) => (v === null || v === undefined) ? '—' : `${Math.round(v * 100)}%`;
const rate = (v: number | null) => (v === null || v === undefined) ? null : Math.round(v).toLocaleString('en-US');
const restrictionCell = (r: string | null) =>
  !r ? '—' : <span style={{ fontSize: 11, color: '#5A5A5A', fontStyle: 'italic' }}>{r}</span>;

function isWeekend(day: string): boolean {
  return day === 'Sat' || day === 'Sun';
}

function DeltaChip({ v, unit = 'money' }: { v: number | null; unit?: 'money' | 'pct' }) {
  if (v === null || v === undefined || v === 0) return <span style={{ color: '#9A9A9A' }}> </span>;
  const positive = v > 0;
  const color = positive ? '#7A1F1A' : '#0B3B2E';
  const bg = positive ? '#F5D5CE' : '#DFF0DE';
  const label = unit === 'pct'
    ? `${positive ? '+' : ''}${Math.round(v * 100)}pp`
    : `${positive ? '+' : ''}${Math.round(v).toLocaleString('en-US')}`;
  return (
    <span style={{
      display: 'inline-block', padding: '1px 5px', fontSize: 10, fontWeight: 600,
      color, background: bg, borderRadius: 3, marginLeft: 4,
    }}>{label}</span>
  );
}

// ─────────────────────────────────────────────────────────────
//  Overview table  (per-date summary)
// ─────────────────────────────────────────────────────────────
export function OverviewTable({ rows }: { rows: OverviewRow[] }) {
  if (rows.length === 0) return <div style={emptyBox}>No data for this snapshot.</div>;
  return (
    <div style={scroller}>
      <table style={tbl}>
        <thead>
          <tr>
            <th style={th}>Day</th>
            <th style={th}>Date</th>
            <th style={th}>Flex own</th>
            <th style={{ ...th, textAlign: 'right' }}>Median compset</th>
            <th style={th}>Rank</th>
            <th style={{ ...th, textAlign: 'right' }}>My OTB %</th>
            <th style={{ ...th, textAlign: 'right' }}>Market demand %</th>
            <th style={th}>BCom ranking</th>
            <th style={th}>Holidays</th>
            <th style={th}>Events</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const w = isWeekend(r.day_name) ? tdWeekend : null;
            return (
              <tr key={r.stay_date}>
                <td style={{ ...td, ...w, fontWeight: 600 }}>{r.day_name}</td>
                <td style={{ ...td, ...w }}>{r.stay_date}</td>
                <td style={{ ...td, ...w }}>{r.flex_own ?? '—'}</td>
                <td style={{ ...tdNum, ...w }}>{r.median_compset === null ? '—' : rate(r.median_compset)}</td>
                <td style={{ ...td, ...w }}>{r.compset_rank ?? '—'}</td>
                <td style={{ ...tdNum, ...w }}>{pct(r.my_otb_pct)}</td>
                <td style={{ ...tdNum, ...w }}>{pct(r.market_demand_pct)}</td>
                <td style={{ ...td, ...w }}>{r.bookingcom_ranking ?? '—'}</td>
                <td style={{ ...td, ...w, color: r.holidays ? '#1B1B1B' : '#9A9A9A' }}>{r.holidays ?? '—'}</td>
                <td style={{ ...td, ...w, color: r.events ? '#1B1B1B' : '#9A9A9A' }}>{r.events ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Rates table  (per-date × per-hotel grid)
// ─────────────────────────────────────────────────────────────
export function RatesTable({ rows, hotels }: {
  rows: RatesRow[];
  hotels: HotelMeta[];
}) {
  if (rows.length === 0) return <div style={emptyBox}>No data for this snapshot.</div>;
  return (
    <div style={scroller}>
      <table style={tbl}>
        <thead>
          <tr>
            <th style={th}>Day</th>
            <th style={th}>Date</th>
            <th style={{ ...th, textAlign: 'right' }}>My OTB %</th>
            <th style={{ ...th, textAlign: 'right' }}>Market demand %</th>
            {hotels.map((h) => (
              <th key={h.hotel_name} style={{ ...th, textAlign: 'right', background: h.is_own ? '#F0E9CE' : '#FFFFFF' }}>
                {h.display_short ?? shortName(h.hotel_name)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const w = isWeekend(r.day_name) ? tdWeekend : null;
            return (
              <tr key={r.stay_date}>
                <td style={{ ...td, ...w, fontWeight: 600 }}>{r.day_name}</td>
                <td style={{ ...td, ...w }}>{r.stay_date}</td>
                <td style={{ ...tdNum, ...w }}>{pct(r.my_otb_pct)}</td>
                <td style={{ ...tdNum, ...w }}>{pct(r.market_demand_pct)}</td>
                {r.cells.map((c, i) => {
                  const bg = c.is_own ? { background: '#FBF6DC' } : w;
                  const shown = c.rate_value !== null ? rate(c.rate_value) : restrictionCell(c.restriction);
                  return (
                    <td key={i} style={{ ...tdNum, ...bg, fontWeight: c.is_own ? 700 : 400 }}>{shown ?? '—'}</td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Delta table  (same grid + delta chip after each rate)
// ─────────────────────────────────────────────────────────────
export function DeltaTable({ rows, hotels, earlierSnapshot }: {
  rows: DeltaRow[];
  hotels: HotelMeta[];
  earlierSnapshot: string | null;
}) {
  if (rows.length === 0) return <div style={emptyBox}>No data for this snapshot.</div>;
  return (
    <>
      {!earlierSnapshot && (
        <div style={{
          padding: '8px 12px', background: '#FDF6D8', border: '1px solid #E9D66C',
          borderRadius: 4, fontSize: 12, color: '#5A4A00', marginBottom: 10,
        }}>
          Only one Lighthouse snapshot exists — deltas will populate once a second daily snapshot lands.
          Grid below shows the current rates only.
        </div>
      )}
      <div style={scroller}>
        <table style={tbl}>
          <thead>
            <tr>
              <th style={th}>Day</th>
              <th style={th}>Date</th>
              <th style={{ ...th, textAlign: 'right' }}>My OTB %</th>
              <th style={{ ...th, textAlign: 'right' }}>Market demand %</th>
              {hotels.map((h) => (
                <th key={h.hotel_name} style={{ ...th, textAlign: 'right', background: h.is_own ? '#F0E9CE' : '#FFFFFF' }}>
                  {h.display_short ?? shortName(h.hotel_name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const w = isWeekend(r.day_name) ? tdWeekend : null;
              return (
                <tr key={r.stay_date}>
                  <td style={{ ...td, ...w, fontWeight: 600 }}>{r.day_name}</td>
                  <td style={{ ...td, ...w }}>{r.stay_date}</td>
                  <td style={{ ...tdNum, ...w }}>{pct(r.my_otb_pct)}<DeltaChip v={r.delta_otb} unit="pct" /></td>
                  <td style={{ ...tdNum, ...w }}>{pct(r.market_demand_pct)}<DeltaChip v={r.delta_demand} unit="pct" /></td>
                  {r.cells.map((c, i) => {
                    const bg = c.is_own ? { background: '#FBF6DC' } : w;
                    const shown = c.rate_value !== null ? rate(c.rate_value) : restrictionCell(c.restriction);
                    return (
                      <td key={i} style={{ ...tdNum, ...bg, fontWeight: c.is_own ? 700 : 400 }}>
                        {shown ?? '—'}<DeltaChip v={c.delta_rate} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── helpers ───────────────────────────────────────────────────
const scroller: React.CSSProperties = { overflowX: 'auto', border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF' };
const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' as const };
const emptyBox: React.CSSProperties = { padding: 24, textAlign: 'center', fontSize: 13, color: '#5A5A5A', background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 4 };

function shortName(full: string): string {
  const parts = full.split(/[·,]/)[0].trim();
  return parts.length > 22 ? parts.slice(0, 20) + '…' : parts;
}
