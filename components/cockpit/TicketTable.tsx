'use client';

/**
 * components/cockpit/TicketTable.tsx
 * Perf #229-child — memoized ticket table for /cockpit page.
 *
 * Uses React.memo on the row sub-component so that when the parent
 * re-renders (e.g. tab change, notification poll) unchanged rows do
 * NOT re-render.  The table itself is also memo-wrapped so callers
 * can pass a stable `rows` reference (e.g. via useMemo) and pay zero
 * diffing cost.
 */

import React, { memo, useMemo } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TicketRow {
  id: number;
  created_at: string;
  arm: string | null;
  intent: string | null;
  status: string;
  parsed_summary: string | null;
  pr_url?: string | null;
  github_issue_url?: string | null;
  iterations?: number | null;
}

interface TicketTableProps {
  rows: TicketRow[];
  /** Optional: highlight row IDs (e.g. active/working tickets) */
  highlightIds?: number[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  completed: 'var(--green, #16a34a)',
  working: 'var(--blue, #2563eb)',
  triaged: 'var(--yellow, #ca8a04)',
  triage_failed: 'var(--red, #dc2626)',
  awaits_user: 'var(--orange, #ea580c)',
  new: 'var(--muted, #6b7280)',
};

function statusColor(status: string): string {
  return STATUS_COLOR[status] ?? 'var(--muted, #6b7280)';
}

function shortSummary(summary: string | null, maxLen = 120): string {
  if (!summary) return '—';
  const first = summary.split('\n')[0].replace(/^\*+/, '').trim();
  return first.length > maxLen ? first.slice(0, maxLen) + '…' : first;
}

function fmtDate(iso: string): string {
  return iso ? iso.slice(0, 16).replace('T', ' ') : '—';
}

// ── Row (memoized) ───────────────────────────────────────────────────────────

interface TicketRowProps {
  row: TicketRow;
  highlighted: boolean;
}

const TicketRowItem = memo(function TicketRowItem({ row, highlighted }: TicketRowProps) {
  return (
    <tr
      style={{
        background: highlighted ? 'rgba(37,99,235,0.06)' : undefined,
        borderBottom: '1px solid var(--border, #e5e7eb)',
      }}
    >
      <td style={tdStyle}>{row.id}</td>
      <td style={tdStyle}>{row.arm ?? '—'}</td>
      <td style={tdStyle}>{row.intent ?? '—'}</td>
      <td style={tdStyle}>
        <span
          style={{
            color: statusColor(row.status),
            fontWeight: 600,
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {row.status}
        </span>
      </td>
      <td style={{ ...tdStyle, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {shortSummary(row.parsed_summary)}
      </td>
      <td style={tdStyle}>{fmtDate(row.created_at)}</td>
      <td style={tdStyle}>
        {row.pr_url ? (
          <a href={row.pr_url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue, #2563eb)', fontSize: 12 }}>
            PR
          </a>
        ) : (
          '—'
        )}
      </td>
    </tr>
  );
});

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 13,
  verticalAlign: 'top',
  whiteSpace: 'nowrap',
};

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  textAlign: 'left',
  borderBottom: '2px solid var(--border, #e5e7eb)',
  background: 'var(--surface, #f9fafb)',
  whiteSpace: 'nowrap',
};

// ── Table (memoized) ─────────────────────────────────────────────────────────

const TicketTable = memo(function TicketTable({ rows, highlightIds = [] }: TicketTableProps) {
  const highlightSet = useMemo(() => new Set(highlightIds), [highlightIds]);

  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
        <thead>
          <tr>
            <th style={thStyle}>#</th>
            <th style={thStyle}>Arm</th>
            <th style={thStyle}>Intent</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Summary</th>
            <th style={thStyle}>Created</th>
            <th style={thStyle}>PR</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted, #6b7280)', padding: 24 }}>
                No tickets found.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <TicketRowItem
                key={row.id}
                row={row}
                highlighted={highlightSet.has(row.id)}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
});

export default TicketTable;
