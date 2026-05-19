// MetricRow — horizontal strip of 3-6 KpiTiles, auto-balanced widths.

'use client';

import type { CSSProperties } from 'react';
import KpiTile from '../tile/KpiTile';
import type { MetricRowProps } from '../types';
import '../internal/tokens.css';

export default function MetricRow({ tiles, size = 'md' }: MetricRowProps) {
  const cols = Math.max(1, Math.min(6, tiles.length));
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${size === 'sm' ? 160 : 200}px, 1fr))`,
        gap: 12,
        gridAutoRows: '1fr',
        '--metric-cols': cols,
      } as CSSProperties}
    >
      {tiles.map((t, i) => <KpiTile key={i} {...t} size={t.size ?? size} />)}
    </div>
  );
}
