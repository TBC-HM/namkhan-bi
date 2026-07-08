'use client';

// app/revenue/pickup/_components/PickupActions.tsx
// Send + Print + Download CSV for the Pickup matrix page header.
// PBS 2026-07-08 fixes:
//  - CSV numbers ROUNDED (was raw floats like 122.04301075268818)
//  - UTF-8 BOM prepended (Excel parses columns correctly)
//  - Title + property + date metadata rows at top
//  - Send button no longer opens mailto with empty body — calls /api/pickup/email
//    which posts via the shared send-report-email edge fn with a proper HTML table

import { useState } from 'react';
import type { PickupMatrixData, PickupMatrixRow, PickupMetric } from '@/app/(cockpit)/_design/PickupMatrix';

interface Props {
  property: string;
  asOfDate: string;
  data?: PickupMatrixData;
  propertyId?: number;
}

// Metric-aware precision: integer for counts / revenue / RevPAR, one decimal for OCC%, integer for ADR.
function roundValue(metric: PickupMetric, v: number): number {
  if (metric === 'OCC') return Math.round(v * 10) / 10; // 1 dp
  return Math.round(v); // RN/REV/ADR/RevPAR
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
  const today = new Date().toISOString().slice(0, 10);
  lines.push(csvEscape(`Pickup matrix · ${data.property} · Generated ${today}`));
  lines.push(csvEscape(`As of ${data.asOfDate} · Capacity ${data.capacity} rooms`));
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
        if (v == null || !Number.isFinite(v)) return '';
        return String(roundValue(metric, v));
      });
      lines.push([csvEscape(m.monthLabel), csvEscape(metric), ...cells].join(','));
    }
  }
  // UTF-8 BOM so Excel parses columns correctly.
  return '﻿' + lines.join('\r\n');
}

/** HTML table for the email body — first 3 columns + last 4 pickup/comparison columns to keep it readable. */
function buildEmailHtml(data: PickupMatrixData, today: string): string {
  const SHORT_COLS: Array<[string, (r: PickupMatrixRow) => number | null]> = [
    ['OTB ALL 2026',      (r) => r.otbAll],
    ['OTB Monthly',       (r) => r.otbMonthly],
    ['Pickup Monthly',    (r) => r.pickupMonthly?.abs ?? null],
    ['Pickup Weekly',     (r) => r.pickupWeekly?.abs ?? null],
    ['vs Budget (%)',     (r) => r.vsBudget?.pct ?? null],
    ['vs LY (%)',         (r) => r.vsLy?.pct ?? null],
  ];
  const rows: string[] = [];
  for (const m of data.months) {
    const rn = m.rows.find((r) => r.metric === 'RN');
    if (!rn) continue;
    const cells = SHORT_COLS.map(([, g]) => {
      const v = g(rn);
      if (v == null || !Number.isFinite(v)) return `<td style="text-align:right">—</td>`;
      return `<td style="text-align:right">${roundValue('RN', v)}</td>`;
    }).join('');
    rows.push(`<tr><td>${m.monthLabel}</td>${cells}</tr>`);
  }
  const th = SHORT_COLS.map(([h]) => `<th>${h}</th>`).join('');
  return `<div style="font-family:Georgia,serif;color:#1B1B1B">
    <h2 style="margin:0 0 4px">${data.property} · Pickup matrix</h2>
    <p style="margin:0 0 12px;color:#5A5A5A">Generated ${today} · As of ${data.asOfDate} · Room-nights (RN) view</p>
    <table style="border-collapse:collapse;font-size:12px" cellpadding="4" cellspacing="0">
      <thead style="background:#0B3B2E;color:#fff"><tr><th>Month</th>${th}</tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
    <p style="font-size:11px;color:#8A8A8A;margin-top:16px">RN totals only — full metric grid (RN/OCC/REV/ADR/RevPAR × 18 columns) available in the on-page dashboard and the CSV attachment.</p>
  </div>`;
}

export default function PickupActions({ property, asOfDate, data, propertyId }: Props) {
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function doPrint() { window.print(); }
  async function doSend() {
    const to = window.prompt('Send Pickup matrix to (email address):');
    if (!to || !data) return;
    setSending(true); setMsg(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const html = buildEmailHtml(data, today);
      const csv = buildCsv(data);
      const base64 = typeof btoa !== 'undefined'
        ? btoa(unescape(encodeURIComponent(csv)))
        : Buffer.from(csv, 'utf8').toString('base64');
      const r = await fetch('/api/pickup/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject: `${data.property} · Pickup matrix · ${today}`,
          html,
          attachment_name: `pickup-${data.property.replace(/\s+/g, '_')}-${data.asOfDate}.csv`,
          attachment_base64: base64,
          property_id: propertyId,
        }),
      });
      const j = await r.json().catch(() => ({}));
      setMsg(r.ok ? `✓ Sent to ${to}` : `✗ ${j.error ?? 'send failed'}`);
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSending(false);
    }
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
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} className="no-print">
      <button type="button" onClick={doDownload} disabled={!data} style={btnStyle} title="Download matrix as CSV (Excel-friendly, rounded)">⬇ Download</button>
      <button type="button" onClick={doSend} disabled={!data || sending} style={btnStyle} title="Email this matrix with a summary table + CSV attachment">
        {sending ? '…sending' : '✉ Send'}
      </button>
      <button type="button" onClick={doPrint} style={btnStylePrimary}>🖨 Print</button>
      {msg && <span style={{ fontSize: 11, color: msg.startsWith('✓') ? '#1F5C2C' : '#B04A2F', marginLeft: 8 }}>{msg}</span>}
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
