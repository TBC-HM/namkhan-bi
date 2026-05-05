// app/revenue/compset/_components/agent/MandateRulesTable.tsx
// Read-only table of mandate rules pulled from v_compset_agent_settings.locked_by_mandate.mandate_rules.

'use client';

import DataTable, { type Column } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { EMPTY } from '@/lib/format';
import type { MandateRule } from '../scoring/types';

interface Props {
  rows: MandateRule[];
}

function formatValue(r: MandateRule): React.ReactNode {
  if (r.numeric_value != null) {
    const txt = `${r.numeric_value}${r.unit ? ' ' + r.unit : ''}`;
    return (
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {txt}
      </span>
    );
  }
  if (r.text_value) {
    return (
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-sm)',
        }}
      >
        {r.text_value}
      </span>
    );
  }
  return EMPTY;
}

export default function MandateRulesTable({ rows }: Props) {
  const columns: Column<MandateRule>[] = [
    {
      key: 'rule_type',
      header: 'RULE TYPE',
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            color: 'var(--ink-soft)',
            letterSpacing: 'var(--ls-loose)',
          }}
        >
          {r.rule_type ?? EMPTY}
        </span>
      ),
    },
    {
      key: 'applies_to',
      header: 'APPLIES TO',
      render: (r) => (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)' }}>
          {r.applies_to ?? EMPTY}
        </span>
      ),
    },
    {
      key: 'value',
      header: 'VALUE',
      align: 'right',
      render: (r) => formatValue(r),
    },
    {
      key: 'severity',
      header: 'SEVERITY',
      align: 'center',
      render: (r) => {
        if (r.severity === 'block')
          return <StatusPill tone="expired">BLOCK</StatusPill>;
        if (r.severity === 'warn')
          return <StatusPill tone="pending">WARN</StatusPill>;
        return <StatusPill tone="info">{(r.severity ?? '').toString().toUpperCase() || 'INFO'}</StatusPill>;
      },
    },
    {
      key: 'notes',
      header: 'NOTES',
      render: (r) => (
        r.notes
          ? <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--t-sm)' }}>{r.notes}</span>
          : EMPTY
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(_r, i) => `mandate-${i}`}
      emptyState={
        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
          <div style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>
            No mandate rules attached.
          </div>
          <div style={{ color: 'var(--ink-faint)', fontSize: 'var(--t-xs)' }}>
            Owner-published mandates appear here. Contact PBS to attach a mandate.
          </div>
        </div>
      }
    />
  );
}
