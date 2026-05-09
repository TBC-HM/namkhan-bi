'use client';

// app/messy-data/_components/UnpaidBillsActions.tsx
// Client-side helpers for the messy.unpaid_bills panel:
//  · "Download CSV"  — builds a data-URI on the fly from the rendered rows.
//  · "Send to accountant" — opens mailto: with a tab-separated body.
//
// We accept the rows already serialized to a JSON-safe array so this
// component stays a thin client wrapper and the server keeps query auth.

import { useMemo } from 'react';

export interface UnpaidBillRow {
  id: number;
  supplier: string;
  due_date: string | null;
  amount_lak: number | null;
  balance_lak: number | null;
  status_raw: string | null;
  class_raw: string | null;
  location_raw: string | null;
  ai_classification: string | null;
  human_status: string | null;
  human_notes: string | null;
}

const HEADERS = [
  'id',
  'supplier',
  'due_date',
  'amount_lak',
  'balance_lak',
  'status_raw',
  'class_raw',
  'location_raw',
  'ai_classification',
  'human_status',
  'human_notes',
] as const;

function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function tsvCell(v: unknown): string {
  if (v == null) return '';
  return String(v).replace(/\t/g, ' ').replace(/\n/g, ' ');
}

export default function UnpaidBillsActions({ rows }: { rows: UnpaidBillRow[] }) {
  const csvHref = useMemo(() => {
    const lines = [HEADERS.join(',')];
    for (const r of rows) {
      lines.push(HEADERS.map((h) => csvEscape((r as unknown as Record<string, unknown>)[h])).join(','));
    }
    return 'data:text/csv;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
  }, [rows]);

  const mailtoHref = useMemo(() => {
    const subject = 'Namkhan unpaid bills — review request';
    const intro =
      `Please review the unpaid bills attached below.\nMark anything that is double-counted, wrong, or already paid off-book.\n\n`;
    const tsvHeader = HEADERS.join('\t');
    const tsvRows = rows.map((r) =>
      HEADERS.map((h) => tsvCell((r as unknown as Record<string, unknown>)[h])).join('\t'),
    );
    const body = intro + tsvHeader + '\n' + tsvRows.join('\n');
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [rows]);

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <a
        href={csvHref}
        download={`namkhan_unpaid_bills_${new Date().toISOString().slice(0, 10)}.csv`}
        style={S.btn}
      >
        ↓ Download CSV
      </a>
      <a href={mailtoHref} style={S.btn}>
        ✉ Send to accountant
      </a>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  btn: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)',
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color: 'var(--brass)',
    background: 'transparent',
    border: '1px solid #2a261d',
    padding: '4px 10px',
    borderRadius: 4,
    textDecoration: 'none',
    cursor: 'pointer',
  },
};
