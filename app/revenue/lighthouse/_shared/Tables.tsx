// app/revenue/lighthouse/_shared/Tables.tsx
// PBS 2026-07-07: Presentational tables for the 5 Lighthouse views.
// Palette matches source Lighthouse xlsx exactly:
//   - default text #5C5F61 (dark grey)
//   - zebra rows #FFFFFF / #F2F2F2 (alternating, not weekend-based)
//   - green rate text #02A245 (competitor > own → own well-positioned)
//   - red   rate text #CE1C33 (competitor < own → competitor undercutting)
//   - restriction text #D8D8D8 (LOS2/LOS3/No flex/Sold out — muted)
//   - delta values plain grey with +/- prefix (no colour, per source)

import type { OverviewRow, RatesRow, DeltaRow, HotelMeta } from './data';

// ─────────────────────────────────────────────────────────────
//  Lighthouse palette (source xlsx cell colours, byte-exact)
// ─────────────────────────────────────────────────────────────
const INK          = '#5C5F61';   // default text
const ZEBRA_LIGHT  = '#FFFFFF';
const ZEBRA_DARK   = '#F2F2F2';
const RATE_GREEN   = '#02A245';   // competitor rate above own
const RATE_RED     = '#CE1C33';   // competitor rate below own
const RESTRICTION  = '#D8D8D8';   // LOS/Sold-out grey
const HAIRLINE     = '#E6DFCC';

const th: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: 0.4, color: INK, padding: '8px 10px',
  borderBottom: `1px solid ${HAIRLINE}`, textAlign: 'left', background: '#FFFFFF',
  position: 'sticky', top: 0, whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  fontSize: 12, color: INK, padding: '6px 10px',
  whiteSpace: 'nowrap',
};
const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

const pct = (v: number | null) => (v === null || v === undefined) ? '—' : `${Math.round(v * 100)}%`;
const money = (v: number | null) => (v === null || v === undefined) ? null : Math.round(v).toLocaleString('en-US');

function zebra(idx: number): React.CSSProperties {
  return { background: idx % 2 === 0 ? ZEBRA_LIGHT : ZEBRA_DARK };
}

function cmpColour(cellRate: number | null, ownRate: number | null): string {
  if (cellRate === null || ownRate === null) return INK;
  if (cellRate > ownRate) return RATE_GREEN;
  if (cellRate < ownRate) return RATE_RED;
  return INK;
}

// ─────────────────────────────────────────────────────────────
//  Overview table  (per-date summary — no colour comparisons)
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
          {rows.map((r, i) => {
            const z = zebra(i);
            return (
              <tr key={r.stay_date}>
                <td style={{ ...td, ...z, fontWeight: 600 }}>{r.day_name}</td>
                <td style={{ ...td, ...z }}>{r.stay_date}</td>
                <td style={{ ...td, ...z }}>{r.flex_own ?? '—'}</td>
                <td style={{ ...tdNum, ...z }}>{r.median_compset === null ? '—' : money(r.median_compset)}</td>
                <td style={{ ...td, ...z }}>{r.compset_rank ?? '—'}</td>
                <td style={{ ...tdNum, ...z }}>{pct(r.my_otb_pct)}</td>
                <td style={{ ...tdNum, ...z }}>{pct(r.market_demand_pct)}</td>
                <td style={{ ...td, ...z }}>{r.bookingcom_ranking ?? '—'}</td>
                <td style={{ ...td, ...z, color: r.holidays ? INK : '#B0B0B0' }}>{r.holidays ?? '—'}</td>
                <td style={{ ...td, ...z, color: r.events ? INK : '#B0B0B0' }}>{r.events ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Rates table  — green/red text on competitor rates
// ─────────────────────────────────────────────────────────────
export function RatesTable({ rows, hotels }: { rows: RatesRow[]; hotels: HotelMeta[] }) {
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
              <th key={h.hotel_name} style={{ ...th, textAlign: 'right' }}>
                {h.display_short ?? shortName(h.hotel_name)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const z = zebra(i);
            const ownCell = r.cells.find((c) => c.is_own);
            const ownRate = ownCell?.rate_value ?? null;
            return (
              <tr key={r.stay_date}>
                <td style={{ ...td, ...z, fontWeight: 600 }}>{r.day_name}</td>
                <td style={{ ...td, ...z }}>{r.stay_date}</td>
                <td style={{ ...tdNum, ...z }}>{pct(r.my_otb_pct)}</td>
                <td style={{ ...tdNum, ...z }}>{pct(r.market_demand_pct)}</td>
                {r.cells.map((c, ci) => renderRateCell(c, ownRate, z, ci))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderRateCell(c: RatesRow['cells'][number], ownRate: number | null, z: React.CSSProperties, key: React.Key) {
  const isRate = c.rate_value !== null;
  if (isRate) {
    const colour = c.is_own ? INK : cmpColour(c.rate_value, ownRate);
    return (
      <td key={key} style={{ ...tdNum, ...z, color: colour, fontWeight: c.is_own ? 700 : 500 }}>
        {money(c.rate_value)}
      </td>
    );
  }
  // restriction — muted grey
  return (
    <td key={key} style={{ ...tdNum, ...z, color: RESTRICTION }}>
      {c.restriction ?? '—'}
    </td>
  );
}

// ─────────────────────────────────────────────────────────────
//  Delta table — matches Lighthouse conditional formatting rules exactly:
//    delta > 0 → green #02A245 (rate went up)
//    delta < 0 → red   #CE1C33 (rate went down)
//    bracketed [LOS2] → grey #A5A6A5
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
                <React.Fragment key={h.hotel_name}>
                  <th style={{ ...th, textAlign: 'right' }}>{h.display_short ?? shortName(h.hotel_name)}</th>
                  <th style={{ ...th, textAlign: 'right', color: '#B0B0B0', fontSize: 9 }}>Δ</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const z = zebra(i);
              const ownCell = r.cells.find((c) => c.is_own);
              const ownRate = ownCell?.rate_value ?? null;
              return (
                <tr key={r.stay_date}>
                  <td style={{ ...td, ...z, fontWeight: 600 }}>{r.day_name}</td>
                  <td style={{ ...td, ...z }}>{r.stay_date}</td>
                  <td style={{ ...tdNum, ...z }}>
                    {pct(r.my_otb_pct)}
                    {(() => { const d = formatPctDelta(r.delta_otb); return d.text ? <span style={{ marginLeft: 4, color: d.colour, fontSize: 11, fontWeight: 600 }}>{d.text}</span> : null; })()}
                  </td>
                  <td style={{ ...tdNum, ...z }}>
                    {pct(r.market_demand_pct)}
                    {(() => { const d = formatPctDelta(r.delta_demand); return d.text ? <span style={{ marginLeft: 4, color: d.colour, fontSize: 11, fontWeight: 600 }}>{d.text}</span> : null; })()}
                  </td>
                  {r.cells.map((c, ci) => {
                    const d = formatDelta(c.delta_rate);
                    return (
                      <React.Fragment key={ci}>
                        {renderRateCell(c, ownRate, z, `${ci}-r`)}
                        <td style={{ ...tdNum, ...z, color: d.colour, fontSize: 11, fontWeight: 600 }}>
                          {d.text}
                        </td>
                      </React.Fragment>
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

function formatDelta(v: number | null): { text: string; colour: string } {
  if (v === null || v === undefined || v === 0) return { text: '', colour: INK };
  const sign = v > 0 ? '+' : '−';
  const colour = v > 0 ? RATE_GREEN : RATE_RED;
  return { text: `${sign}${Math.abs(Math.round(v))}`, colour };
}
// pp = percentage-point delta for OTB / demand columns
function formatPctDelta(v: number | null): { text: string; colour: string } {
  if (v === null || v === undefined || v === 0) return { text: '', colour: INK };
  const sign = v > 0 ? '+' : '−';
  const colour = v > 0 ? RATE_GREEN : RATE_RED;
  const abs = Math.abs(Math.round(v * 100));
  return { text: `${sign}${abs}pp`, colour };
}

// Small React import shim (no useState/useEffect used but Fragment needs it)
import * as React from 'react';

// ── helpers ───────────────────────────────────────────────────
const scroller: React.CSSProperties = { overflowX: 'auto', border: `1px solid ${HAIRLINE}`, borderRadius: 4, background: '#FFFFFF' };
const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' as const };
const emptyBox: React.CSSProperties = { padding: 24, textAlign: 'center', fontSize: 13, color: INK, background: '#FFFFFF', border: `1px solid ${HAIRLINE}`, borderRadius: 4 };

function shortName(full: string): string {
  const parts = full.split(/[·,]/)[0].trim();
  return parts.length > 22 ? parts.slice(0, 20) + '…' : parts;
}
