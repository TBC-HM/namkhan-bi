'use client';

import React, { memo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
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
  entry: AuditLogEntry;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCost(milliUsd: number | null): string {
  if (milliUsd == null) return '—';
  if (milliUsd < 1) return '<$0.001';
  return `$${(milliUsd / 1000).toFixed(3)}`;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ─── AuditLogRow ─────────────────────────────────────────────────────────────
// memo() ensures this row only re-renders when its own `entry` prop changes.
// In a live-polling audit log with 50+ rows, this prevents full-table repaints
// on every poll tick — O(n) → O(changed rows).

const AuditLogRow = memo(function AuditLogRow({ entry }: AuditLogRowProps) {
  const time = entry.created_at
    ? new Date(entry.created_at).toISOString().slice(11, 19)
    : '—';

  const reasoning = entry.reasoning
    ? entry.reasoning.slice(0, 100) + (entry.reasoning.length > 100 ? '…' : '')
    : '—';

  const successColor = entry.success === true
    ? '#059669'
    : entry.success === false
    ? '#dc2626'
    : '#9ca3af';

  const successLabel = entry.success === true ? '✓' : entry.success === false ? '✗' : '—';

  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      <td style={{ padding: '6px 10px', fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {time}
      </td>
      <td style={{ padding: '6px 10px', fontSize: 12, color: '#374151', fontWeight: 600 }}>
        {entry.agent ?? '—'}
      </td>
      <td style={{ padding: '6px 10px', fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>
        {entry.action ?? '—'}
      </td>
      <td style={{ padding: '6px 10px', fontSize: 12, color: '#6b7280' }}>
        {entry.target ?? (entry.ticket_id != null ? `ticket:${entry.ticket_id}` : '—')}
      </td>
      <td style={{ padding: '6px 10px', fontSize: 12, textAlign: 'center', color: successColor, fontWeight: 700 }}>
        {successLabel}
      </td>
      <td style={{ padding: '6px 10px', fontSize: 12, color: '#6b7280', maxWidth: 300 }}>
        {reasoning}
      </td>
      <td style={{ padding: '6px 10px', fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', textAlign: 'right' }}>
        {formatTokens(entry.input_tokens)}&thinsp;/&thinsp;{formatTokens(entry.output_tokens)}
      </td>
      <td style={{ padding: '6px 10px', fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', textAlign: 'right' }}>
        {formatCost(entry.cost_usd_milli)}
      </td>
      <td style={{ padding: '6px 10px', fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', textAlign: 'right' }}>
        {formatDuration(entry.duration_ms)}
      </td>
    </tr>
  );
});

export default AuditLogRow;
