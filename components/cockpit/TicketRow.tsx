'use client';

import React, { memo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Ticket {
  id: number;
  created_at: string;
  updated_at: string;
  source: string | null;
  arm: string | null;
  intent: string | null;
  status: string;
  parsed_summary: string | null;
}

interface TicketRowProps {
  ticket: Ticket;
  onSelect?: (id: number) => void;
}

// ─── Status badge colours ─────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  completed:       { bg: '#d1fae5', text: '#065f46' },
  triage_failed:   { bg: '#fee2e2', text: '#991b1b' },
  triaged:         { bg: '#dbeafe', text: '#1e40af' },
  awaits_user:     { bg: '#fef9c3', text: '#854d0e' },
  working:         { bg: '#ede9fe', text: '#4c1d95' },
  new:             { bg: '#f3f4f6', text: '#374151' },
};

function statusStyle(status: string) {
  return STATUS_COLORS[status] ?? { bg: '#f3f4f6', text: '#374151' };
}

// ─── TicketRow ────────────────────────────────────────────────────────────────
// memo() prevents re-render when sibling tickets update — key perf gain for
// long lists where only one row changes at a time.

const TicketRow = memo(function TicketRow({ ticket, onSelect }: TicketRowProps) {
  const { bg, text } = statusStyle(ticket.status);

  const handleClick = () => {
    if (onSelect) onSelect(ticket.id);
  };

  const date = ticket.updated_at
    ? new Date(ticket.updated_at).toISOString().slice(0, 16).replace('T', ' ')
    : '—';

  const summary = ticket.parsed_summary
    ? ticket.parsed_summary.slice(0, 120) + (ticket.parsed_summary.length > 120 ? '…' : '')
    : '—';

  return (
    <tr
      onClick={handleClick}
      style={{
        cursor: onSelect ? 'pointer' : 'default',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <td style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums', color: '#6b7280', fontSize: 13 }}>
        #{ticket.id}
      </td>
      <td style={{ padding: '8px 12px', fontSize: 13 }}>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 9999,
            background: bg,
            color: text,
            fontWeight: 600,
            fontSize: 11,
            textTransform: 'capitalize',
            letterSpacing: '0.02em',
          }}
        >
          {ticket.status.replace(/_/g, ' ')}
        </span>
      </td>
      <td style={{ padding: '8px 12px', fontSize: 13, color: '#374151', textTransform: 'capitalize' }}>
        {ticket.arm ?? '—'}
      </td>
      <td style={{ padding: '8px 12px', fontSize: 13, color: '#374151', textTransform: 'capitalize' }}>
        {ticket.intent ?? '—'}
      </td>
      <td style={{ padding: '8px 12px', fontSize: 13, color: '#6b7280', maxWidth: 420 }}>
        {summary}
      </td>
      <td style={{ padding: '8px 12px', fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>
        {date}
      </td>
    </tr>
  );
});

export default TicketRow;
