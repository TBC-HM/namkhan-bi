// app/revenue/compset/_components/SetTabs.tsx
// Horizontal set tabs with `?set=<id>` URL state. Server-side default = primary set.

'use client';

import Link from 'next/link';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import type { SetSummaryRow } from './types';

const FRESHNESS_TONE: Record<SetSummaryRow['data_freshness'], StatusTone> = {
  fresh:    'active',
  aging:    'pending',
  stale:    'expired',
  no_data:  'inactive',
};

const FRESHNESS_LABEL: Record<SetSummaryRow['data_freshness'], string> = {
  fresh:    'FRESH',
  aging:    'AGING',
  stale:    'STALE',
  no_data:  'NO DATA',
};

interface Props {
  sets: SetSummaryRow[];
  selectedSetId: string;
}

export default function SetTabs({ sets, selectedSetId }: Props) {
  if (sets.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        borderBottom: '1px solid var(--paper-deep)',
        marginTop: 18,
        flexWrap: 'wrap',
      }}
    >
      {sets.map((s) => {
        const active = s.set_id === selectedSetId;
        return (
          <Link
            key={s.set_id}
            href={`/revenue/compset?set=${s.set_id}`}
            style={{
              padding: '12px 18px',
              border: '1px solid var(--paper-deep)',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              background: active ? 'var(--paper-warm)' : 'var(--paper)',
              color: active ? 'var(--ink)' : 'var(--ink-mute)',
              fontSize: 'var(--t-base)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              fontWeight: active ? 600 : 400,
            }}
          >
            {s.is_primary && <span style={{ color: 'var(--brass)' }}>★</span>}
            <span>{s.set_name}</span>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                color: 'var(--ink-mute)',
                letterSpacing: 'var(--ls-loose)',
              }}
            >
              {s.property_count} props
            </span>
            <StatusPill tone={FRESHNESS_TONE[s.data_freshness]}>
              {FRESHNESS_LABEL[s.data_freshness]}
            </StatusPill>
          </Link>
        );
      })}
    </div>
  );
}
