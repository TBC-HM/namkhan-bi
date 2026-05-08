'use client';

/**
 * loading.tsx — /cockpit layout-level skeleton
 * Shown by Next.js App Router while any cockpit/* page segment suspends.
 * Ticket #229 child: Perf marathon — Add loading.tsx for /cockpit/* slow tabs
 */

import React from 'react';

export default function CockpitLoading() {
  return (
    <div
      role="status"
      aria-label="Loading…"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '24px 32px',
        minHeight: '60vh',
        width: '100%',
      }}
    >
      {/* Page-header skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Bone width={180} height={28} radius={6} />
        <Bone width={80} height={20} radius={4} />
      </div>

      {/* KPI row skeleton — 4 tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} width="100%" height={96} radius={10} />
        ))}
      </div>

      {/* Chart / table skeleton */}
      <Bone width="100%" height={320} radius={10} style={{ marginTop: 8 }} />

      {/* Secondary row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Bone width="100%" height={180} radius={10} />
        <Bone width="100%" height={180} radius={10} />
      </div>

      <span className="sr-only">Loading cockpit data…</span>
    </div>
  );
}

/* ─── Inline skeleton bone — no external dependency required ─────────────── */
interface BoneProps {
  width: number | string;
  height: number | string;
  radius?: number;
  style?: React.CSSProperties;
}

function Bone({ width, height, radius = 6, style }: BoneProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%)',
        backgroundSize: '400% 100%',
        animation: 'cockpit-shimmer 1.4s ease-in-out infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
