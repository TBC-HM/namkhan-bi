'use client';

// app/_components/registry/TopSourcesOtbTable.tsx
// Forward-looking Top-N table: OTB (on-the-books) for next 90 days per source,
// compared to Same Day Last Year (SDLY). Same column shape as Top 10 sources.
// PBS 2026-07-01.
//
// PBS 2026-07-07: currency prop threaded so Donna renders € not $. Default
// stays USD for backward-compat with the existing Namkhan call-site.

import Link from 'next/link';
import { fmtMoney, type Currency } from '@/lib/format';

export interface OtbSdlyRow {
  source_name: string;
  bkg_otb: number;
  rn_otb: number;
  rev_otb: number;
  bkg_sdly: number;
  rn_sdly: number;
  rev_sdly: number;
  rev_delta_pct: number | null;
  adr_otb: number | null;
}

interface Props {
  rows: OtbSdlyRow[];
  /** Property display currency for money columns. Defaults to USD. */
  currency?: Currency;
}

export default function TopSourcesOtbTable({ rows, currency = 'USD' }: Props) {
  if (rows.length === 0) {
    return (
      <div style={{
        padding: '24px 20px',
        background: '#FFFFFF',
        border: '1px solid #E6DFCC',
        borderRadius: 6,
        textAlign: 'center',
        color: '#5A5A5A',
        fontSize: 13,
      }}>
        No on-the-books reservations in the next 90 days.
      </div>
    );
  }

  const th: React.CSSProperties = {
    padding: '8px 10px', textAlign: 'right',
    fontFamily: 'var(--mono, monospace)', fontSize: 10,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: '#5A5A5A', fontWeight: 600,
    borderBottom: '1px solid #E6DFCC', background: '#FFFFFF',
  };
  const td: React.CSSProperties = {
    padding: '8px 10px', textAlign: 'right', fontSize: 12,
    color: '#1B1B1B', fontVariantNumeric: 'tabular-nums',
    borderBottom: '1px solid #E6DFCC', background: '#FFFFFF',
  };
  const tdLabel: React.CSSProperties = {
    padding: '8px 10px', textAlign: 'left', fontSize: 13,
    color: '#1B1B1B', fontWeight: 500,
    borderBottom: '1px solid #E6DFCC', background: '#FFFFFF',
  };

  const deltaColor = (v: number | null) =>
    v == null ? '#8A8A8A' : v >= 5 ? '#2C5F4F' : v <= -5 ? '#B03826' : '#B8542A';
  const deltaText = (v: number | null) => {
    if (v == null) return '—';
    const arrow = v > 0 ? '▲' : v < 0 ? '▼' : '·';
    return `${arrow} ${Math.abs(v).toFixed(0)}%`;
  };

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 8, overflow: 'hidden' }}>
      <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--sans)' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>Source</th>
            <th style={th}>Bkg OTB</th>
            <th style={th}>Rev OTB</th>
            <th style={th}>ADR OTB</th>
            <th style={th}>Rev SDLY</th>
            <th style={th}>Δ vs SDLY</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.source_name}>
              <td style={tdLabel}>
                <Link
                  href={`/revenue/channels/${encodeURIComponent(r.source_name)}`}
                  style={{
                    color: '#1F3A2E', fontWeight: 600,
                    textDecoration: 'underline', textDecorationColor: '#C79A6B',
                    textDecorationThickness: 2, textUnderlineOffset: 3,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}
                  title={`Open landing page for ${r.source_name}`}
                >
                  {r.source_name}
                  <span style={{ color: '#C79A6B', fontSize: 11 }}>→</span>
                </Link>
              </td>
              <td style={td}>{r.bkg_otb.toLocaleString('en-US')}</td>
              <td style={td}>{fmtMoney(r.rev_otb, currency)}</td>
              <td style={td}>{r.adr_otb != null ? fmtMoney(r.adr_otb, currency) : '—'}</td>
              <td style={td}>{r.rev_sdly > 0 ? fmtMoney(r.rev_sdly, currency) : '—'}</td>
              <td style={{ ...td, color: deltaColor(r.rev_delta_pct), fontWeight: 600 }}>{deltaText(r.rev_delta_pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
