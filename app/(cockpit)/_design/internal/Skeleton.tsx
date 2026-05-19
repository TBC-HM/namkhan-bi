// Shared shimmer block for loading states.

'use client';

import type { CSSProperties } from 'react';

interface Props {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
}

export default function Skeleton({ width = '100%', height = 12, radius = 4, style }: Props) {
  return (
    <span
      style={{
        display: 'inline-block',
        width,
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, rgba(230,223,204,0.4) 0%, rgba(230,223,204,0.8) 50%, rgba(230,223,204,0.4) 100%)',
        backgroundSize: '200% 100%',
        animation: 'tbc-skeleton 1.2s ease-in-out infinite',
        ...style,
      }}
    />
  );
}
