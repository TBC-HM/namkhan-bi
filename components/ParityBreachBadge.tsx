/**
 * ParityBreachBadge — ticket #596
 *
 * Surfaces active parity breach count on the Revenue dashboard.
 * Fetches from /api/parity/breaches-count (lightweight GET endpoint below).
 *
 * Placement assumption: imported into the Revenue page next to the existing
 * KpiBox row. PBS: add <ParityBreachBadge /> wherever it best fits.
 */

'use client';

import React, { useEffect, useState } from 'react';

interface BreachData {
  count: number;
  fetchedAt: string;
}

export function ParityBreachBadge() {
  const [data, setData] = useState<BreachData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/parity/breaches-count')
      .then((r) => r.json())
      .then((d: BreachData) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!data || data.count === 0) return null;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35em',
        background: 'var(--rust, #b94f3a)',
        color: '#fff',
        borderRadius: '999px',
        padding: '0.2em 0.75em',
        fontSize: 'var(--t-sm)',
        fontWeight: 600,
        letterSpacing: '0.01em',
      }}
      title={`${data.count} active rate parity breach${data.count !== 1 ? 'es' : ''}`}
      role="status"
      aria-live="polite"
    >
      ⚠ {data.count} parity breach{data.count !== 1 ? 'es' : ''}
    </span>
  );
}
