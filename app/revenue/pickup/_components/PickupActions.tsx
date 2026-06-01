'use client';

// app/revenue/pickup/_components/PickupActions.tsx
// Send + Print + Download CSV for the Pickup matrix page header.
// PBS 2026-06-01 #94 — added Download CSV (matrix flattened: one row per month×metric × column).

import type { PickupMatrixData, PickupMatrixRow, PickupMetric } from '@/app/(cockpit)/_design/PickupMatrix';

interface Props {
  property: string;
  asOfDate: string;
  data?: PickupMatrixData;
}

const CSV_COLUMNS: Array<[string, (r: PickupMatrixRow) => number | null]> = [
  ['2023 RO',           (r) => r.baseline2023],
  ['2024 RO',           (r) => r.baseline2024],
  ['2025 RO',           (r) => r.baseline2025],
  ['Budget 2026',       (r) => r.budget2026],
  ['OTB ALL 2026',      (r) => r.otbAll],
  ['OTB Monthly',       (r) => r.otbMonthly],
  ['OTB Monday',        (r) => r.otbMonday],
  ['OTB Yesterday',     (r) => r.otbYesterday],
  ['OTB Today',         (r) => r.otbToday],
  ['Pickup Monthly',    (r) => r.pickupMonthly?.abs ?? null],
  ['Pickup Weekly',     (r) => r.pickupWeekly?.abs ?? null],
  ['Pickup Yesterday',  (r) => r.pickupYesterday?.abs ?? null],
  ['vs Budget (abs)',   (r) => r.vsBudget?.abs ?? null],
  ['vs Budget (%)',     (r) => r.vsBudget?.pct ?? null],
  ['vs LY (abs)',       (r) => r.vsLy?.abs ?? null],
  ['vs LY (%)',         (r) => r.vsLy?.pct ?? null],
  ['SDLY',              (r) => r.sdly],
  ['SDLY Diff',         (r) => r.sdlyDiff],
];

const METRIC_ORDER: PickupMetric[] = ['RN', 'OCC', 'REV', 'ADR', 'RevPAR'];

function csvEscape(s: string): string {
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(data: PickupMatrixData): string {
  const lines: string[] = [];
  lines.push(`# Pickup matrix · ${data.property} · as of ${data.asOfDate}`);
  lines.push(`# capacity ${data.capacity} rooms`);
  lines.push('');
  const header = ['Month', 'Metric', ...CSV_COLUMNS.map(([h]) => h)].map(csvEscape).join(',');
  lines.push(header);
  for (const m of data.months) {
    const byMetric = new Map<PickupMetric, PickupMatrixRow>();
    for (const r of m.rows) byMetric.set(r.metric, r);
    for (const metric of METRIC_ORDER) {
      const r = byMetric.get(metric);
      if (!r) continue;
      const cells = CSV_COLUMNS.map(([, getter]) => {
        const v = getter(r);
        return v == null || !Number.isFinite(v) ? '' : String(v);
      });
      lines.push([csvEscape(m.monthLabel), csvEscape(metric), ...cells].join(','));
    }
  }
  return lines.join('\n');
}

export default function PickupActions({ property, asOfDate, data }: Props) {
  function doPrint() { window.print(); }
  function doSend() {
    const subject = encodeURIComponent(`Pickup matrix · ${property} · ${asOfDate}`);
    const body = encodeURIComponent(
      `Pickup matrix for ${property} as of ${asOfDate}.\n\n` +
      `Live link: ${typeof window !== 'undefined' ? window.location.href : ''}\n\n` +
      `Sent from namkhan-bi cockpit.`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }
  function doDownload() {
    if (!data) return;
    const csv = buildCsv(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pickup-${data.property.replace(/\s+/g, '_')}-${data.asOfDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: 'flex', gap: 6 }} className="no-print">
      <button type="button" onClick={doDownload} disabled={!data} style={btnStyle} title="Download matrix as CSV">⬇ Download</button>
      <button type="button" onClick={doSend} style={btnStyle}>✉ Send</button>
      <button type="button" onClick={doPrint} style={btnStylePrimary}>🖨 Print</button>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 4,
  border: '1px solid var(--hairline, #E6DFCC)',
  background: 'var(--paper, #FFFFFF)',
  color: 'var(--ink, #1B1B1B)',
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.04em',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const btnStylePrimary: React.CSSProperties = {
  ...btnStyle,
  background: 'var(--primary, #1F3A2E)',
  color: '#FFFFFF',
  border: '1px solid var(--primary, #1F3A2E)',
};
