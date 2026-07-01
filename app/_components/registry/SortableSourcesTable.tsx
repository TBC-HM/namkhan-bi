'use client';
// PBS 2026-05-29 #57 — Sources · 2024/2025/2026 table with click-to-sort headers.
// Server passes raw numeric values; this component formats currency + sorts client-side.
// Sources count (Donna 50 · Namkhan 60) reflects all distinct source_name values present
// in v_reservations_unified for the window; the table is not capped beyond the underlying data.
import Link from 'next/link';
import { useState } from 'react';

export interface SortableRow {
  source: string;
  category: string;
  res_24: number;
  res_25: number;
  res_26: number;
  rev_24: number | null;
  rev_25: number | null;
  rev_26: number | null;
  adr_24: number | null;
  adr_25: number | null;
  adr_26: number | null;
  rn_26: number;
  avg_window_days: number | null;
  avg_los: number | null;
  sdly_dev_pct: number | null;
  drillHref: string;
}

type SortKey =
  | 'source' | 'category'
  | 'res_24' | 'res_25' | 'res_26' | 'sdly_dev_pct'
  | 'rev_24' | 'rev_25' | 'rev_26'
  | 'adr_24' | 'adr_25' | 'adr_26'
  | 'rn_26' | 'avg_window_days' | 'avg_los';

type SortDir = 'asc' | 'desc';

interface Props {
  rows: SortableRow[];
  moneyCurrency: 'USD' | 'EUR';
  initialSort?: { key: SortKey; dir: SortDir };
}

const thStyle: React.CSSProperties = { padding: '6px 10px', textAlign: 'left' };
const tdLabelStyle: React.CSSProperties = { padding: '6px 10px', whiteSpace: 'nowrap' };
const tdNumStyle: React.CSSProperties = { padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
const sourceLinkStyle: React.CSSProperties = { color: 'var(--primary, #1F3A2E)', textDecoration: 'none', fontWeight: 600 };

function fmtCurrency(v: number | null, sym: string): string {
  if (v == null) return '—';
  return `${sym}${Math.round(v).toLocaleString('en-US')}`;
}
function fmtSdly(v: number | null): string {
  if (v == null) return '—';
  const arrow = v > 0 ? '↑ ' : v < 0 ? '↓ ' : '→ ';
  return `${arrow}${Math.round(v)}%`;
}
function fmtDays(v: number | null): string {
  return v == null ? '—' : `${Math.round(v)}d`;
}
function fmtLos(v: number | null): string {
  return v == null ? '—' : `${v.toFixed(1)}n`;
}

export default function SortableSourcesTable({ rows, moneyCurrency, initialSort = { key: 'rev_26', dir: 'desc' } }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>(initialSort);
  const sym = moneyCurrency === 'EUR' ? '€' : '$';

  function compare(a: SortableRow, b: SortableRow): number {
    const { key, dir } = sort;
    const mul = dir === 'asc' ? 1 : -1;
    const av = a[key];
    const bv = b[key];
    if (typeof av === 'string' && typeof bv === 'string') {
      return mul * av.localeCompare(bv);
    }
    // numeric — push nulls to the bottom regardless of direction
    // nulls sort to the bottom regardless of direction: use -Infinity in desc (mul=-1) and +Infinity in asc (mul=1)
    const nullSentinel = mul === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    const ax = av == null ? nullSentinel : (av as number);
    const bx = bv == null ? nullSentinel : (bv as number);
    return mul * (ax - bx);
  }

  const sorted = [...rows].sort(compare);

  function onHeader(k: SortKey) {
    if (sort.key === k) {
      setSort({ key: k, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      // numeric defaults to desc (largest first), text defaults to asc (A-Z)
      const isText = k === 'source' || k === 'category';
      setSort({ key: k, dir: isText ? 'asc' : 'desc' });
    }
  }

  function HeaderCell({ k, label, align }: { k: SortKey; label: string; align?: 'right' }) {
    const active = sort.key === k;
    const arrow = active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';
    return (
      <th
        onClick={() => onHeader(k)}
        style={{
          ...thStyle,
          textAlign: align ?? 'left',
          cursor: 'pointer',
          userSelect: 'none',
          color: '#000',
          fontWeight: 700,
        }}
      >
        {label}{arrow}
      </th>
    );
  }

  if (rows.length === 0) {
    return <div style={{ padding: 16, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>No sources data</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E6DFCC', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, color: '#1B1B1B' }}>
            <HeaderCell k="source" label="Source" />
            <HeaderCell k="category" label="Group" />
            <HeaderCell k="res_24" label="Res 24" align="right" />
            <HeaderCell k="res_25" label="Res 25" align="right" />
            <HeaderCell k="res_26" label="Res 26" align="right" />
            <HeaderCell k="sdly_dev_pct" label="SDLY 26 vs 25" align="right" />
            <HeaderCell k="rev_24" label="Rev 24" align="right" />
            <HeaderCell k="rev_25" label="Rev 25" align="right" />
            <HeaderCell k="rev_26" label="Rev 26" align="right" />
            <HeaderCell k="adr_24" label="ADR 24" align="right" />
            <HeaderCell k="adr_25" label="ADR 25" align="right" />
            <HeaderCell k="adr_26" label="ADR 26" align="right" />
            <HeaderCell k="rn_26" label="RN 26" align="right" />
            <HeaderCell k="avg_window_days" label="Avg window" align="right" />
            <HeaderCell k="avg_los" label="Avg LOS" align="right" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={`${r.source}-${i}`} style={{ borderTop: '1px solid #E6DFCC' }}>
              <td style={tdLabelStyle}><Link href={r.drillHref} style={sourceLinkStyle}>{r.source}</Link></td>
              <td style={tdLabelStyle}>{r.category}</td>
              <td style={tdNumStyle}>{r.res_24}</td>
              <td style={tdNumStyle}>{r.res_25}</td>
              <td style={tdNumStyle}>{r.res_26}</td>
              <td style={tdNumStyle}>{fmtSdly(r.sdly_dev_pct)}</td>
              <td style={tdNumStyle}>{fmtCurrency(r.rev_24, sym)}</td>
              <td style={tdNumStyle}>{fmtCurrency(r.rev_25, sym)}</td>
              <td style={tdNumStyle}>{fmtCurrency(r.rev_26, sym)}</td>
              <td style={tdNumStyle}>{fmtCurrency(r.adr_24, sym)}</td>
              <td style={tdNumStyle}>{fmtCurrency(r.adr_25, sym)}</td>
              <td style={tdNumStyle}>{fmtCurrency(r.adr_26, sym)}</td>
              <td style={tdNumStyle}>{r.rn_26}</td>
              <td style={tdNumStyle}>{fmtDays(r.avg_window_days)}</td>
              <td style={tdNumStyle}>{fmtLos(r.avg_los)}</td>
            </tr>
          ))}
        </tbody>
        {/* PBS 2026-07-01: totals row. ADR is night-weighted (sum_rev / sum_rn)
            so mixed-length stays don't distort the average. */}
        {(() => {
          const t = sorted.reduce(
            (a, r) => {
              a.res_24 += r.res_24; a.res_25 += r.res_25; a.res_26 += r.res_26;
              a.rev_24 += r.rev_24 ?? 0; a.rev_25 += r.rev_25 ?? 0; a.rev_26 += r.rev_26 ?? 0;
              const rn24 = r.adr_24 && r.rev_24 ? Math.round((r.rev_24 ?? 0) / r.adr_24) : 0;
              const rn25 = r.adr_25 && r.rev_25 ? Math.round((r.rev_25 ?? 0) / r.adr_25) : 0;
              a.rn_24 += rn24; a.rn_25 += rn25; a.rn_26 += r.rn_26 ?? 0;
              return a;
            },
            { res_24: 0, res_25: 0, res_26: 0, rev_24: 0, rev_25: 0, rev_26: 0, rn_24: 0, rn_25: 0, rn_26: 0 },
          );
          const adr = (rev: number, rn: number) => rn > 0 ? Math.round(rev / rn) : null;
          const sdlyPct = t.res_25 > 0 ? Math.round(((t.res_26 - t.res_25) / t.res_25) * 100) : null;
          return (
            <tfoot>
              <tr style={{ borderTop: '2px solid #E6DFCC', background: '#FFFFFF', fontWeight: 700, color: '#1B1B1B' }}>
                <td style={{ ...tdLabelStyle, fontWeight: 700 }}>Total · {sorted.length} sources</td>
                <td style={tdLabelStyle}>—</td>
                <td style={tdNumStyle}>{t.res_24.toLocaleString('en-US')}</td>
                <td style={tdNumStyle}>{t.res_25.toLocaleString('en-US')}</td>
                <td style={tdNumStyle}>{t.res_26.toLocaleString('en-US')}</td>
                <td style={tdNumStyle}>{sdlyPct == null ? '—' : `${sdlyPct > 0 ? '↑ ' : sdlyPct < 0 ? '↓ ' : '→ '}${sdlyPct}%`}</td>
                <td style={tdNumStyle}>{fmtCurrency(t.rev_24, sym)}</td>
                <td style={tdNumStyle}>{fmtCurrency(t.rev_25, sym)}</td>
                <td style={tdNumStyle}>{fmtCurrency(t.rev_26, sym)}</td>
                <td style={tdNumStyle}>{fmtCurrency(adr(t.rev_24, t.rn_24), sym)}</td>
                <td style={tdNumStyle}>{fmtCurrency(adr(t.rev_25, t.rn_25), sym)}</td>
                <td style={tdNumStyle}>{fmtCurrency(adr(t.rev_26, t.rn_26), sym)}</td>
                <td style={tdNumStyle}>{t.rn_26.toLocaleString('en-US')}</td>
                <td style={tdNumStyle}>—</td>
                <td style={tdNumStyle}>—</td>
              </tr>
            </tfoot>
          );
        })()}
      </table>
    </div>
  );
}
