'use client';

import { getFreshnessTone, getFreshnessLabel, type FreshnessTone } from '../types';

interface FreshnessDotProps {
  lastUpdatedAt: string | null;
  showLabel?: boolean;
}

const DOT_STYLES: Record<FreshnessTone, React.CSSProperties> = {
  green: {
    backgroundColor: 'var(--color-success, #22c55e)',
    boxShadow: '0 0 0 2px rgba(34,197,94,0.25)',
  },
  brass: {
    backgroundColor: 'var(--color-warning, #b8902e)',
    boxShadow: '0 0 0 2px rgba(184,144,46,0.25)',
  },
  terracotta: {
    backgroundColor: 'var(--color-danger, #c0392b)',
    boxShadow: '0 0 0 2px rgba(192,57,43,0.25)',
  },
};

export function FreshnessDot({ lastUpdatedAt, showLabel = false }: FreshnessDotProps) {
  const tone = getFreshnessTone(lastUpdatedAt);
  const label = getFreshnessLabel(lastUpdatedAt);

  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
      title={label}
    >
      <span
        style={{
          display: 'inline-block',
          width: '0.5rem',
          height: '0.5rem',
          borderRadius: '50%',
          flexShrink: 0,
          ...DOT_STYLES[tone],
        }}
        aria-label={label}
      />
      {showLabel && (
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
