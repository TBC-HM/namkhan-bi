'use client';

/**
 * TicketRow — memoized row component for the cockpit ticket table.
 * Wrapped in React.memo so parent re-renders don't force DOM diffing
 * unless the ticket object itself changes.
 *
 * Ticket #229 child — Perf marathon: memoize ticket table row component.
 */

import React, { memo } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TicketRowData {
  id: number;
  created_at: string;
  updated_at: string;
  arm: string | null;
  intent: string | null;
  status: string;
  parsed_summary: string | null;
  source: string | null;
}

interface TicketRowProps {
  ticket: TicketRowData;
  /** Optional click handler — passed via useCallback at the list level */
  onClick?: (id: number) => void;
}

// ── Status pill helpers ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  completed:      { bg: '#d1fae5', text: '#065f46' },
  triage_failed:  { bg: '#fee2e2', text: '#991b1b' },
  triaged:        { bg: '#dbeafe', text: '#1e40af' },
  working:        { bg: '#fef3c7', text: '#92400e' },
  awaits_user:    { bg: '#ede9fe', text: '#5b21b6' },
  new:            { bg: '#f3f4f6', text: '#374151' },
};

function statusStyle(status: string) {
  return STATUS_COLORS[status] ?? { bg: '#f3f4f6', text: '#374151' };
}

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

// ── Component ────────────────────────────────────────────────────────────────

function TicketRowInner({ ticket, onClick }: TicketRowProps) {
  const { bg, text } = statusStyle(ticket.status);

  const firstLine = ticket.parsed_summary
    ? ticket.parsed_summary.split('\n').find(l => l.trim().length > 0) ?? '—'
    : '—';

  const summary =
    firstLine.replace(/^\*\*[^*]+\*\*\s*/, '').slice(0, 120) || '—';

  function handleClick() {
    onClick?.(ticket.id);
  }

  const cellBase: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid #e5e7eb',
    fontSize: 13,
    verticalAlign: 'middle',
    background: '#fff',
  };

  return (
    <tr onClick={handleClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <td style={{ ...cellBase, color: '#6b7280', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        #{ticket.id}
      </td>
      <td style={{ ...cellBase, whiteSpace: 'nowrap', color: '#374151' }}>
        {fmtDate(ticket.created_at)}
      </td>
      <td style={{ ...cellBase }}>
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 9999,
          fontSize: 11,
          fontWeight: 600,
          background: bg,
          color: text,
          textTransform: 'capitalize',
          letterSpacing: '0.02em',
        }}>
          {ticket.status.replace(/_/g, ' ')}
        </span>
      </td>
      <td style={{ ...cellBase, color: '#6b7280', textTransform: 'capitalize' }}>
        {ticket.arm ?? '—'}
      </td>
      <td style={{ ...cellBase, color: '#6b7280', textTransform: 'capitalize' }}>
        {ticket.intent ?? '—'}
      </td>
      <td style={{ ...cellBase, color: '#374151', maxWidth: 400 }}>
        {summary}
      </td>
      <td style={{ ...cellBase, color: '#6b7280', whiteSpace: 'nowrap' }}>
        {fmtDate(ticket.updated_at)}
      </td>
    </tr>
  );
}

/**
 * Memoized with a custom comparator — only re-render if key fields change.
 * Parent list should wrap onClick handlers in useCallback.
 */
const TicketRow = memo(TicketRowInner, (prev, next) => {
  return (
    prev.ticket.id             === next.ticket.id             &&
    prev.ticket.status         === next.ticket.status         &&
    prev.ticket.updated_at     === next.ticket.updated_at     &&
    prev.ticket.arm            === next.ticket.arm            &&
    prev.ticket.intent         === next.ticket.intent         &&
    prev.ticket.parsed_summary === next.ticket.parsed_summary &&
    prev.onClick               === next.onClick
  );
});

TicketRow.displayName = 'TicketRow';

export default TicketRow;
