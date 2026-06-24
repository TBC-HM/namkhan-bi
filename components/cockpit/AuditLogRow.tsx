'use client';

/**
 * components/cockpit/AuditLogRow.tsx
 * Perf #229-child — memoized audit-log row component.
 *
 * The /cockpit Logs tab renders 1 000+ rows.  Without memoization every
 * parent re-render (poll, tab switch, notification badge update) causes
 * a full list reconciliation.  With React.memo + stable prop shapes the
 * cost drops to O(changed rows) instead of O(all rows).
 *
 * Usage:
 *   import AuditLogRow from '@/components/cockpit/AuditLogRow';
 *   // inside a <tbody>:
 *   {rows.map(r => <AuditLogRow key={r.id} row={r} />)}
 */

import React, { memo } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: number;
  created_at: string;
  agent?: string | null;
  action?: string | null;
  /** Legacy shape: job field */
  job?: string | null;
  arm?: string | null;
  /** Legacy shape: arms[] */
  arms?: string[] | null;
  status?: string | null;
  trigger?: string | null;
  duration_ms?: number | null;
  cost_usd?: number | null;
  output?: string | null;
  pr_url?: string | null;
  ticket_id?: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  success: 'var(--green, #16a34a)',
  completed: 'var(--green, #16a34a)',
  error: 'var(--red, #dc2626)',
  failed: 'var(--red, #dc2626)',
  running: 'var(--blue, #2563eb)',
  pending: 'var(--yellow, #ca8a04)',
};

function statusColor(status: string | null | undefined): string {
  if (!status) return 'var(--muted, #6b7280)';
  return STATUS_COLOR[status.toLowerCase()] ?? 'var(--muted, #6b7280)';
}

function fmtDate(iso: string): string {
  return iso ? iso.slice(0, 16).replace('T', ' ') : '—';
}

function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtCost(usd: number | null | undefined): string {
  if (usd == null) return '—';
  return `$${usd.toFixed(4)}`;
}

function shortOutput(output: string | null | undefined, maxLen = 100): string {
  if (!output) return '—';
  const cleaned = output.replace(/\n/g, ' ').trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + '…' : cleaned;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const tdStyle: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: 12,
  verticalAlign: 'top',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border, #e5e7eb)',
};

// ── Memoized Row ─────────────────────────────────────────────────────────────

interface AuditLogRowProps {
  row: AuditLogEntry;
}

const AuditLogRow = memo(function AuditLogRow({ row }: AuditLogRowProps) {
  // Support both new schema (agent/action) and legacy shape (job/arms)
  const agent = row.agent ?? row.job ?? '—';
  const action = row.action ?? '—';
  const arm = row.arm ?? (row.arms?.join(', ')) ?? '—';
  const status = row.status ?? '—';

  return (
    <tr>
      <td style={tdStyle}>{row.id}</td>
      <td style={tdStyle}>{fmtDate(row.created_at)}</td>
      <td style={{ ...tdStyle, fontWeight: 600 }}>{agent}</td>
      <td style={tdStyle}>{action}</td>
      <td style={tdStyle}>{arm}</td>
      <td style={tdStyle}>
        <span
          style={{
            color: statusColor(status),
            fontWeight: 600,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {status}
        </span>
      </td>
      <td style={tdStyle}>{fmtDuration(row.duration_ms)}</td>
      <td style={tdStyle}>{fmtCost(row.cost_usd)}</td>
      <td
        style={{
          ...tdStyle,
          maxWidth: 280,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: 'var(--muted, #6b7280)',
        }}
        title={row.output ?? undefined}
      >
        {shortOutput(row.output)}
      </td>
      <td style={tdStyle}>
        {row.pr_url ? (
          <a href={row.pr_url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue, #2563eb)', fontSize: 11 }}>
            PR
          </a>
        ) : (
          '—'
        )}
      </td>
    </tr>
  );
});

export default AuditLogRow;

// ── Companion: AuditLogTable ─────────────────────────────────────────────────
// A ready-made table shell that maps AuditLogRow — import separately or
// use inline in the cockpit page.

interface AuditLogTableProps {
  rows: AuditLogEntry[];
}

const thStyle: React.CSSProperties = {
  padding: '7px 10px',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  textAlign: 'left',
  borderBottom: '2px solid var(--border, #e5e7eb)',
  background: 'var(--surface, #f9fafb)',
  whiteSpace: 'nowrap',
};

export const AuditLogTable = memo(function AuditLogTable({ rows }: AuditLogTableProps) {
  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
        <thead>
          <tr>
            <th style={thStyle}>#</th>
            <th style={thStyle}>Time</th>
            <th style={thStyle}>Agent</th>
            <th style={thStyle}>Action</th>
            <th style={thStyle}>Arm</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Duration</th>
            <th style={thStyle}>Cost</th>
            <th style={thStyle}>Output</th>
            <th style={thStyle}>PR</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={10}
                style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted, #6b7280)', padding: 24 }}
              >
                No audit log entries.
              </td>
            </tr>
          ) : (
            rows.map((row) => <AuditLogRow key={row.id} row={row} />)
          )}
        </tbody>
      </table>
    </div>
  );
});
