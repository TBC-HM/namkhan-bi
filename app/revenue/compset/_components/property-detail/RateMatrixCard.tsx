// app/revenue/compset/_components/property-detail/RateMatrixCard.tsx
//
// Rate matrix — 8 most-recent stay dates × 4 channels (BDC, Expedia, Trip, Direct).
// Agoda removed 2026-05-04 (Namkhan has no Agoda account).
//
// v3 (2026-05-04 PM):
//   - FIX: pivot now maps DB channel 'booking' → column key 'bdc' (was returning empty cells)
//   - Adds STAY DATE column with "+Xd" lead-time hint
//   - Adds SHOPPED column (relative time of last scrape per row)
//   - Adds explanatory note that each cell = lowest rate found on that page; per-room
//     and per-rate-plan capture is Phase 2.
//   - "Sold out" rendered explicitly when scrape_status='no_availability' (was em-dash)

'use client';

import { EMPTY, fmtIsoDate, fmtTableUsd } from '@/lib/format';
import type { CompetitorRateMatrixRow } from '../types';

interface Props {
  rows: CompetitorRateMatrixRow[];
  /** Namkhan's own rates per stay date — overlaid as a baseline column. */
  baselineRows?: CompetitorRateMatrixRow[];
  baselineLabel?: string;
}

const CHANNELS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'bdc',     label: 'BDC' },
  { key: 'expedia', label: 'EXPEDIA' },
  { key: 'trip',    label: 'TRIP' },
  { key: 'direct',  label: 'DIRECT' },
];

// Map DB channel value → column key (DB stores 'booking', column is 'bdc')
function normaliseChannel(ch: string): string {
  const lc = ch.toLowerCase();
  if (lc === 'booking') return 'bdc';
  return lc;
}

const wrapStyle: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 4,
  overflow: 'hidden',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thStyle: React.CSSProperties = {
  textAlign: 'right',
  padding: '10px 12px',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  color: 'var(--brass)',
  borderBottom: '1px solid var(--paper-deep)',
  fontWeight: 600,
  background: 'var(--paper-deep)',
};

const thLeftStyle: React.CSSProperties = { ...thStyle, textAlign: 'left' };

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 'var(--t-sm)',
  color: 'var(--ink)',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  borderBottom: '1px solid var(--paper-deep)',
};

const tdLeftStyle: React.CSSProperties = { ...tdStyle, textAlign: 'left' };

const cheapestStyle: React.CSSProperties = {
  background: 'var(--st-good-bg)',
  color: 'var(--moss)',
  fontWeight: 600,
  borderRadius: 3,
  padding: '2px 6px',
  display: 'inline-block',
};

const soldOutStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)',
  color: 'var(--st-bad)',
  fontWeight: 600,
  textTransform: 'uppercase',
};

interface PivotedRow {
  stay_date: string;
  rates: Record<string, number | null>;
  soldOut: Record<string, boolean>;
  min: number | null;
  cheapestKey: string | null;
  shop_date: string | null;
}

function dayOfWeekTag(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}

function leadTimeFromToday(iso: string): string {
  const stay = new Date(iso + 'T00:00:00Z');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const days = Math.round((stay.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return '+1d';
  if (days < 0) return `${days}d`;
  if (days < 30) return `+${days}d`;
  if (days < 90) return `+${Math.round(days / 7)}w`;
  return `+${Math.round(days / 30)}mo`;
}

function shopRelative(iso: string | null): string {
  if (!iso) return EMPTY;
  const shop = new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : ''));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - shop.getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return fmtIsoDate(iso) ?? iso;
}

function pivotByDate(rows: CompetitorRateMatrixRow[]): PivotedRow[] {
  const map = new Map<string, PivotedRow>();
  for (const r of rows) {
    if (!r.stay_date) continue;
    let cur = map.get(r.stay_date);
    if (!cur) {
      cur = { stay_date: r.stay_date, rates: {}, soldOut: {}, min: null, cheapestKey: null, shop_date: null };
      map.set(r.stay_date, cur);
    }
    const ch = normaliseChannel(r.channel ?? '');
    if (!CHANNELS.some((c) => c.key === ch)) continue;
    if (r.shop_date && (!cur.shop_date || r.shop_date > cur.shop_date)) cur.shop_date = r.shop_date;
    if (r.rate_usd != null) {
      const num = Number(r.rate_usd);
      cur.rates[ch] = num;
      if (cur.min == null || num < cur.min) {
        cur.min = num;
        cur.cheapestKey = ch;
      }
    } else if (r.scrape_status === 'no_availability' || r.is_available === false) {
      cur.soldOut[ch] = true;
    }
  }
  return Array.from(map.values())
    .sort((a, b) => a.stay_date.localeCompare(b.stay_date))
    .slice(0, 8);
}

export default function RateMatrixCard({ rows, baselineRows, baselineLabel = 'Namkhan' }: Props) {
  const pivoted = pivotByDate(rows);

  // Build a lookup of Namkhan's BDC rate per stay_date for the overlay column.
  // Picks the latest shop_date per stay_date.
  const baselineByStay = new Map<string, { rate: number | null; sold: boolean; shop_date: string | null }>();
  for (const r of baselineRows ?? []) {
    if (!r.stay_date) continue;
    const ch = normaliseChannel(r.channel ?? '');
    if (ch !== 'bdc') continue;
    const cur = baselineByStay.get(r.stay_date);
    if (cur && cur.shop_date && r.shop_date && cur.shop_date > r.shop_date) continue;
    baselineByStay.set(r.stay_date, {
      rate: r.rate_usd != null ? Number(r.rate_usd) : null,
      sold: r.scrape_status === 'no_availability' || r.is_available === false,
      shop_date: r.shop_date,
    });
  }
  const showBaseline = baselineByStay.size > 0;

  if (pivoted.length === 0) {
    return (
      <div style={{ ...wrapStyle, padding: '24px 20px', textAlign: 'center' }}>
        <div style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>
          No rate observations yet for this property.
        </div>
        <div style={{ color: 'var(--ink-faint)', fontSize: 'var(--t-xs)' }}>
          Press <strong>RUN NOW (BDC)</strong> at the top of the page.
        </div>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thLeftStyle}>STAY DATE</th>
              {CHANNELS.map((c) => (
                <th key={c.key} style={thStyle}>{c.label}</th>
              ))}
              <th style={thStyle}>MIN</th>
              {showBaseline && <th style={{ ...thStyle, color: 'var(--moss-glow)' }}>{baselineLabel.toUpperCase()} (BDC)</th>}
              {showBaseline && <th style={thStyle}>Δ vs YOU</th>}
              <th style={thStyle}>SHOPPED</th>
            </tr>
          </thead>
          <tbody>
            {pivoted.map((row) => (
              <tr key={row.stay_date}>
                <td style={tdLeftStyle}>
                  <span style={{ color: 'var(--ink)' }}>{fmtIsoDate(row.stay_date)}</span>
                  <span
                    style={{
                      marginLeft: 8,
                      fontFamily: 'var(--mono)',
                      fontSize: 'var(--t-xs)',
                      letterSpacing: 'var(--ls-loose)',
                      color: 'var(--ink-mute)',
                    }}
                  >
                    {dayOfWeekTag(row.stay_date)}
                  </span>
                  <span
                    style={{
                      marginLeft: 8,
                      padding: '1px 6px',
                      borderRadius: 3,
                      background: 'var(--paper-warm)',
                      fontFamily: 'var(--mono)',
                      fontSize: 'var(--t-xs)',
                      color: 'var(--brass)',
                    }}
                  >
                    {leadTimeFromToday(row.stay_date)}
                  </span>
                </td>
                {CHANNELS.map((c) => {
                  const rate = row.rates[c.key];
                  const isCheapest = row.cheapestKey === c.key && rate != null;
                  const sold = row.soldOut[c.key];
                  return (
                    <td key={c.key} style={tdStyle}>
                      {rate != null ? (
                        isCheapest ? (
                          <span style={cheapestStyle}>{fmtTableUsd(rate)}</span>
                        ) : (
                          fmtTableUsd(rate)
                        )
                      ) : sold ? (
                        <span style={soldOutStyle}>SOLD OUT</span>
                      ) : (
                        <span style={{ color: 'var(--ink-faint)' }}>{EMPTY}</span>
                      )}
                    </td>
                  );
                })}
                <td style={{ ...tdStyle, color: 'var(--moss-glow)', fontWeight: 600 }}>
                  {fmtTableUsd(row.min)}
                </td>
                {showBaseline && (() => {
                  const b = baselineByStay.get(row.stay_date);
                  const compMin = row.min;
                  const baseRate = b?.rate ?? null;
                  let deltaCell: React.ReactNode = EMPTY;
                  if (baseRate != null && compMin != null) {
                    const diff = baseRate - compMin;
                    const pct = ((diff / compMin) * 100).toFixed(1);
                    const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
                    const tone =
                      diff > 0 ? 'var(--st-bad)' :
                      diff < 0 ? 'var(--st-good)' : 'var(--ink-mute)';
                    deltaCell = (
                      <span style={{ color: tone, fontWeight: 600 }}>
                        {sign}{fmtTableUsd(Math.abs(diff))} ({sign}{Math.abs(parseFloat(pct))}%)
                      </span>
                    );
                  }
                  return (
                    <>
                      <td style={{ ...tdStyle, color: 'var(--moss-glow)' }}>
                        {b?.sold ? <span style={soldOutStyle}>SOLD OUT</span> : fmtTableUsd(baseRate)}
                      </td>
                      <td style={tdStyle}>{deltaCell}</td>
                    </>
                  );
                })()}
                <td style={{ ...tdStyle, color: 'var(--ink-mute)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>
                  {shopRelative(row.shop_date)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        style={{
          padding: '8px 12px',
          background: 'var(--paper-deep)',
          color: 'var(--ink-mute)',
          fontSize: 'var(--t-xs)',
          fontFamily: 'var(--mono)',
          letterSpacing: 'var(--ls-loose)',
          borderTop: '1px solid var(--paper-deep)',
        }}
      >
        Each cell = lowest available rate found on that channel for that stay date · LOS 1 · 2 adults · USD.
        Full per-room / per-rate-plan detail in the RATE PLANS table below.
      </div>
    </div>
  );
}
