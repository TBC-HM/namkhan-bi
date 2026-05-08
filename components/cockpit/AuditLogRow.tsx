'use client';

/**
 * AuditLogRow — memoized row component for the cockpit audit log table.
 * Wrapped in React.memo so the audit log list can render thousands of rows
 * without unnecessary re-renders when only a new row is appended.
 *
 * Ticket #229 child — Perf marathon: memoize audit log row component.
 */

import React, { memo } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuditLogRowData {
  id: number;
  created_at: string;
  agent: string | null;
  action: string | null;
  target: string | null;
  ticket_id: number | null;
  success: boolean | null;
  reasoning: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd_milli: number | null;
  duration_ms: number | null;
}

interface AuditLogRowProps {
  row: AuditLogRowData;
  /** Optional click handler — passed via useCallback at the list level */
  onClick?: (id: number) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function fmtCost(milliUsd: number | null): string {
  if (milliUsd == null) return '—';
  const cents = milliUsd / 10;   // milli-USD → cents
  if (cents < 1) return `${milliUsd / 10}¢`;
  return `$${(milliUsd / 1000).toFixed(4)}`;
}

function fmtMs(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTokens(inp: number | null, out: number | null): string {
  if (inp == null && out == null) return '—';
  return `${inp ?? 0} / ${out ?? 0}`;
}

// ── Component ────────────────────────────────────────────────────────────────

function AuditLogRowInner({ row, onClick }: AuditLogRowProps) {
  const successColor = row.success === true
    ? '#065f46'
    : row.success === false
    ? '#991b1b'
    : '#6b7280';

  const successLabel = row.success === true
    ? '✓'
    : row.success === false
    ? '✗'
    : '—';

  function handleClick() {
    onClick?.(row.id);
  }

  const cellBase: React.CSSProperties = {
    padding: '9px 12px',
    borderBottom: '1px solid #e5e7eb',
    fontSize: 12,
    verticalAlign: 'middle',
    background: '#fff',
  };

  const reasoning = row.reasoning
    ? row.reasoning.slice(0, 100) + (row.reasoning.length > 100 ? '…' : '')
    : '—';

  return (
    <tr onClick={handleClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <td style={{ ...cellBase, color: '#9ca3af', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {fmtDate(row.created_at)}
      </td>
      <td style={{ ...cellBase, color: '#374151', whiteSpace: 'nowrap' }}>
        {row.agent ?? '—'}
      </td>
      <td style={{ ...cellBase, color: '#374151', whiteSpace: 'nowrap' }}>
        {row.action ?? '—'}
      </td>
      <td style={{ ...cellBase, color: '#6b7280', whiteSpace: 'nowrap' }}>
        {row.target ?? '—'}
      </td>
      <td style={{ ...cellBase, color: '#6b7280', textAlign: 'center' }}>
        {row.ticket_id != null ? `#${row.ticket_id}` : '—'}
      </td>
      <td style={{ ...cellBase, color: successColor, fontWeight: 700, textAlign: 'center' }}>
        {successLabel}
      </td>
      <td style={{ ...cellBase, color: '#6b7280', fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {fmtTokens(row.input_tokens, row.output_tokens)}
      </td>
      <td style={{ ...cellBase, color: '#6b7280', fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {fmtCost(row.cost_usd_milli)}
      </td>
      <td style={{ ...cellBase, color: '#6b7280', fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {fmtMs(row.duration_ms)}
      </td>
      <td style={{ ...cellBase, color: '#9ca3af', maxWidth: 320 }}>
        {reasoning}
      </td>
    </tr>
  );
}

/**
 * Memoized with a custom comparator.
 * Audit log rows are immutable once written — only id and success
 * could realistically differ on a re-render caused by a new append.
 * The comparator checks every field so any edge-case update is caught.
 */
const AuditLogRow = memo(AuditLogRowInner, (prev, next) => {
  return (
    prev.row.id            === next.row.id            &&
    prev.row.created_at    === next.row.created_at    &&
    prev.row.agent         === next.row.agent         &&
    prev.row.action        === next.row.action        &&
    prev.row.target        === next.row.target        &&
    prev.row.ticket_id     === next.row.ticket_id     &&
    prev.row.success       === next.row.success       &&
    prev.row.reasoning     === next.row.reasoning     &&
    prev.row.input_tokens  === next.row.input_tokens  &&
    prev.row.output_tokens === next.row.output_tokens &&
    prev.row.cost_usd_milli=== next.row.cost_usd_milli&&
    prev.row.duration_ms   === next.row.duration_ms   &&
    prev.onClick           === next.onClick
  );
});

AuditLogRow.displayName = 'AuditLogRow';

export default AuditLogRow;
