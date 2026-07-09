// app/revenue/rateplans/_components/LiveRateMatrix.tsx
// PBS 2026-07-08: today's live rate matrix (room-type × rate-plan)
// Powered by public.v_rate_matrix_today (property-scoped).
// PBS 2026-07-09 pm: extra columns (last booking · total RN · room revenue) +
// price cells colorised per-column (dark green = cheapest, dark red = dearest).
// Server-safe: no state, no click handlers — pure markup.

import type { CSSProperties } from 'react';

export interface RateMatrixRow {
  room_type_id: number | string;
  room_type_name: string;
  rate_id: number | string;
  rate_name: string;
  rate_type: string | null;
  rate: number;
  minimum_stay: number | null;
  available_rooms: number | null;
  last_booking?: string | null;
  total_rn?: number | null;
  total_room_revenue?: number | null;
}

interface Props {
  rows: RateMatrixRow[];
  currencySym: string;
  /** ISO date of the snapshot (defaults to today). */
  dateIso?: string;
}

interface PlanAgg {
  rate_id: string;
  rate_name: string;
  rate_type: string | null;
  minimum_stay: number | null;
  minRate: number;
  lastBooking: string | null;
  totalRn: number;
  totalRoomRevenue: number;
}

function typeChip(rateType: string | null): { label: string; bg: string; fg: string } {
  if (rateType === 'base')       return { label: 'BAR',    bg: '#E8F1EC', fg: '#084838' };
  if (rateType === 'standalone') return { label: 'DIRECT', bg: '#F5EFDF', fg: '#7A5F1A' };
  return { label: 'PROMO', bg: '#FBEEE7', fg: '#8C3B12' };
}

function money(sym: string, v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `${sym}${Math.round(Number(v)).toLocaleString('en-US')}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

/**
 * Colour a price cell dark-green (cheapest in room-type column) → dark-red (dearest).
 * Zero-range column (only one rate published) falls back to neutral.
 */
function priceCellColour(rate: number, colMin: number, colMax: number): { bg: string; fg: string } {
  if (colMax <= colMin) return { bg: '#FFFFFF', fg: '#1B1B1B' };
  const t = (rate - colMin) / (colMax - colMin); // 0 = cheapest · 1 = dearest
  // 5-stop ramp: dark green → light green → cream → light red → dark red
  if (t < 0.20) return { bg: '#1F5A3E', fg: '#FFFFFF' }; // dark green
  if (t < 0.40) return { bg: '#7FB08A', fg: '#0B2A1A' }; // light green
  if (t < 0.60) return { bg: '#F5EEDB', fg: '#1B1B1B' }; // cream / neutral
  if (t < 0.80) return { bg: '#E39E86', fg: '#3A0C00' }; // light red
  return             { bg: '#8C2A16', fg: '#FFFFFF' };   // dark red
}

export default function LiveRateMatrix({ rows, currencySym }: Props) {
  if (rows.length === 0) {
    return (
      <div style={emptyBox}>
        No rates published for today. Check <code>rate_inventory</code> sync + rate-plan visibility.
      </div>
    );
  }

  // Column order: room types sorted by min sellable rate ascending (cheapest first).
  const roomAgg = new Map<string, { name: string; min: number; max: number }>();
  for (const r of rows) {
    const key = String(r.room_type_id);
    const cur = roomAgg.get(key);
    if (!cur) roomAgg.set(key, { name: r.room_type_name, min: r.rate, max: r.rate });
    else {
      if (r.rate < cur.min) cur.min = r.rate;
      if (r.rate > cur.max) cur.max = r.rate;
    }
  }
  const roomIds = Array.from(roomAgg.entries())
    .sort((a, b) => a[1].min - b[1].min)
    .map(([id]) => id);
  const roomNames = new Map(Array.from(roomAgg.entries()).map(([id, v]) => [id, v.name]));

  // Row order: rate plans sorted by lowest offered rate. Also collect lifetime aggregates.
  const planAgg = new Map<string, PlanAgg>();
  for (const r of rows) {
    const key = String(r.rate_id);
    const cur = planAgg.get(key);
    if (!cur) {
      planAgg.set(key, {
        rate_id: key,
        rate_name: r.rate_name,
        rate_type: r.rate_type,
        minimum_stay: r.minimum_stay,
        minRate: r.rate,
        lastBooking: r.last_booking ?? null,
        totalRn: Number(r.total_rn ?? 0),
        totalRoomRevenue: Number(r.total_room_revenue ?? 0),
      });
    } else {
      if (r.rate < cur.minRate) cur.minRate = r.rate;
      if ((r.minimum_stay ?? 1) < (cur.minimum_stay ?? 1)) cur.minimum_stay = r.minimum_stay;
      // last_booking / total_rn / total_room_revenue are per-rate-plan (same for every room row) — take max
      if (r.last_booking && (!cur.lastBooking || String(r.last_booking) > String(cur.lastBooking))) cur.lastBooking = r.last_booking;
      cur.totalRn = Math.max(cur.totalRn, Number(r.total_rn ?? 0));
      cur.totalRoomRevenue = Math.max(cur.totalRoomRevenue, Number(r.total_room_revenue ?? 0));
    }
  }
  const planRows = Array.from(planAgg.values()).sort((a, b) => a.minRate - b.minRate);

  // Lookup: rate per (rate_id | room_type_id)
  const cell = new Map<string, RateMatrixRow>();
  for (const r of rows) cell.set(`${r.rate_id}|${r.room_type_id}`, r);

  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: 'left', minWidth: 260 }}>Rate plan</th>
            <th style={{ ...thStyle, textAlign: 'center', width: 60 }}>Min stay</th>
            <th style={{ ...thStyle, textAlign: 'right', minWidth: 100 }}>Last booking</th>
            <th style={{ ...thStyle, textAlign: 'right', minWidth: 70 }}>Total RN</th>
            <th style={{ ...thStyle, textAlign: 'right', minWidth: 110 }}>Room revenue</th>
            {roomIds.map((id) => (
              <th key={id} style={{ ...thStyle, textAlign: 'right', minWidth: 90 }} title={roomNames.get(id)}>
                {roomNames.get(id)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {planRows.map((p) => {
            const chip = typeChip(p.rate_type);
            return (
              <tr key={p.rate_id}>
                <td style={tdLabel}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ ...chipStyle, background: chip.bg, color: chip.fg }}>{chip.label}</span>
                    <span style={{ fontWeight: 500 }}>{p.rate_name}</span>
                  </div>
                </td>
                <td style={{ ...tdNum, textAlign: 'center' }}>{p.minimum_stay ?? 1}n</td>
                <td style={tdNum}>{fmtDate(p.lastBooking)}</td>
                <td style={tdNum}>{p.totalRn > 0 ? p.totalRn.toLocaleString('en-US') : '—'}</td>
                <td style={tdNum}>{p.totalRoomRevenue > 0 ? money(currencySym, p.totalRoomRevenue) : '—'}</td>
                {roomIds.map((rid) => {
                  const c = cell.get(`${p.rate_id}|${rid}`);
                  const col = roomAgg.get(rid);
                  const colour = c && col ? priceCellColour(c.rate, col.min, col.max) : { bg: 'transparent', fg: '#1B1B1B' };
                  return (
                    <td
                      key={rid}
                      style={{
                        ...tdNum,
                        background: colour.bg,
                        color: colour.fg,
                        fontWeight: 600,
                      }}
                      title={c ? `${p.rate_name} · ${roomNames.get(rid)} · ${currencySym}${c.rate}` : '—'}
                    >
                      {c ? `${currencySym}${Math.round(c.rate)}` : '—'}
                    </td>
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

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
  background: '#FFFFFF',
};
const thStyle: CSSProperties = {
  padding: '8px 10px',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#5A5A5A',
  borderBottom: '1px solid #E6DFCC',
  background: '#FAF7EE',
};
const tdLabel: CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid #F1EBD9',
  color: '#1B1B1B',
  fontVariantNumeric: 'tabular-nums',
};
const tdNum: CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid #F1EBD9',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};
const chipStyle: CSSProperties = {
  padding: '1px 6px',
  borderRadius: 3,
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.06em',
};
const emptyBox: CSSProperties = {
  padding: 24,
  textAlign: 'center',
  color: '#5A5A5A',
  fontSize: 12,
  border: '1px dashed #E6DFCC',
  borderRadius: 6,
  background: '#FAFAF7',
};
