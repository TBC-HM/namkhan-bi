'use client';
// PBS 2026-05-31 #71 — Graph 1 (Room Only · 2026) with a custom hover tooltip
// that surfaces the RO share of monthly OCC (bookings_ro / bookings_active).
// Wraps the universal Chart primitive. The tooltipFormatter is a function
// prop, so this client wrapper exists to avoid passing it across the RSC boundary.

import { Chart } from '@/app/(cockpit)/_design';

interface Row {
  month: string;
  ro: number;
  total: number;
  ro_occ_pct: number;
  bookings_ro: number;
  bookings_total: number;
}

interface Props {
  data: Row[];
  sym: string;
}

export default function RoTooltipChart({ data, sym }: Props) {
  return (
    <Chart
      variant="line"
      data={data as unknown as Record<string, unknown>[]}
      xKey="month"
      series={[
        { key: 'ro',    label: `RO revenue (${sym})`,    color: 'var(--primary, #1F3A2E)' },
        { key: 'total', label: `Total revenue (${sym})`, color: 'var(--terracotta, #B8542A)' },
      ]}
      height={180}
      tooltipFormatter={(point) => {
        const ro  = Number((point as Record<string, unknown>).ro ?? 0);
        const tot = Number((point as Record<string, unknown>).total ?? 0);
        const occ = Number((point as Record<string, unknown>).ro_occ_pct ?? 0);
        const br  = Number((point as Record<string, unknown>).bookings_ro ?? 0);
        const bt  = Number((point as Record<string, unknown>).bookings_total ?? 0);
        const month = String((point as Record<string, unknown>).month ?? '');
        return (
          <div style={{ minWidth: 200 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{month}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
              <span style={{ color: 'var(--primary, #1F3A2E)' }}>RO revenue</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{sym}{Math.round(ro).toLocaleString('en-US')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
              <span style={{ color: 'var(--terracotta, #B8542A)' }}>Total revenue</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{sym}{Math.round(tot).toLocaleString('en-US')}</span>
            </div>
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--hairline, #E6DFCC)', display: 'flex', justifyContent: 'space-between', gap: 12, fontWeight: 600, fontSize: 12 }}>
              <span>OCC · RO share</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{occ.toFixed(1)}% ({br}/{bt})</span>
            </div>
          </div>
        );
      }}
      empty={{ title: 'No RO data' }}
    />
  );
}
