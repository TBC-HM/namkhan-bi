'use client';

/**
 * LazyRechartsWrappers.tsx
 * ticket #229-child: Perf — Lazy-load Recharts on dashboard pages
 *
 * Problem: Recharts (~450 kB gzipped) is bundled into the initial JS payload
 * because chart components import directly from 'recharts'. On dashboard pages
 * this blocks Time-to-Interactive by ~300-600 ms on a 4G connection.
 *
 * Fix: Re-export every Recharts component used in components/charts/ via
 * next/dynamic with { ssr: false }. Dashboard pages import from HERE instead
 * of 'recharts' directly — Next.js code-splits the bundle and defers loading
 * until the component is needed client-side.
 *
 * Usage in any chart component:
 *   import {
 *     LazyLineChart, LazyBarChart, LazyAreaChart,
 *     LazyResponsiveContainer, LazyXAxis, LazyYAxis,
 *     LazyCartesianGrid, LazyTooltip, LazyLegend,
 *     LazyLine, LazyBar, LazyArea, LazyPie, LazyPieChart,
 *     LazyCell, LazyComposedChart,
 *   } from '@/components/charts/LazyRechartsWrappers';
 *
 * Each export is a dynamically-imported wrapper with a lightweight skeleton
 * shown while Recharts loads so layout doesn't shift.
 */

import dynamic from 'next/dynamic';
import React from 'react';

// ---------------------------------------------------------------------------
// Skeleton placeholder — shown while Recharts JS is loading
// ---------------------------------------------------------------------------
function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div
      aria-label="Loading chart…"
      style={{
        width: '100%',
        height,
        borderRadius: 8,
        background: 'linear-gradient(90deg, #1e2433 25%, #252c3d 50%, #1e2433 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }}
    >
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------
export const LazyResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

// ---------------------------------------------------------------------------
// Chart roots
// ---------------------------------------------------------------------------
export const LazyLineChart = dynamic(
  () => import('recharts').then((m) => m.LineChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export const LazyBarChart = dynamic(
  () => import('recharts').then((m) => m.BarChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export const LazyAreaChart = dynamic(
  () => import('recharts').then((m) => m.AreaChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export const LazyPieChart = dynamic(
  () => import('recharts').then((m) => m.PieChart),
  { ssr: false, loading: () => <ChartSkeleton height={220} /> }
);

export const LazyComposedChart = dynamic(
  () => import('recharts').then((m) => m.ComposedChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export const LazyRadarChart = dynamic(
  () => import('recharts').then((m) => m.RadarChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

// ---------------------------------------------------------------------------
// Axes & grid
// ---------------------------------------------------------------------------
export const LazyXAxis = dynamic(
  () => import('recharts').then((m) => m.XAxis),
  { ssr: false }
);

export const LazyYAxis = dynamic(
  () => import('recharts').then((m) => m.YAxis),
  { ssr: false }
);

export const LazyCartesianGrid = dynamic(
  () => import('recharts').then((m) => m.CartesianGrid),
  { ssr: false }
);

export const LazyPolarGrid = dynamic(
  () => import('recharts').then((m) => m.PolarGrid),
  { ssr: false }
);

export const LazyPolarAngleAxis = dynamic(
  () => import('recharts').then((m) => m.PolarAngleAxis),
  { ssr: false }
);

export const LazyPolarRadiusAxis = dynamic(
  () => import('recharts').then((m) => m.PolarRadiusAxis),
  { ssr: false }
);

// ---------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------
export const LazyLine = dynamic(
  () => import('recharts').then((m) => m.Line),
  { ssr: false }
);

export const LazyBar = dynamic(
  () => import('recharts').then((m) => m.Bar),
  { ssr: false }
);

export const LazyArea = dynamic(
  () => import('recharts').then((m) => m.Area),
  { ssr: false }
);

export const LazyPie = dynamic(
  () => import('recharts').then((m) => m.Pie),
  { ssr: false }
);

export const LazyRadar = dynamic(
  () => import('recharts').then((m) => m.Radar),
  { ssr: false }
);

// ---------------------------------------------------------------------------
// Decorators
// ---------------------------------------------------------------------------
export const LazyCell = dynamic(
  () => import('recharts').then((m) => m.Cell),
  { ssr: false }
);

export const LazyTooltip = dynamic(
  () => import('recharts').then((m) => m.Tooltip),
  { ssr: false }
);

export const LazyLegend = dynamic(
  () => import('recharts').then((m) => m.Legend),
  { ssr: false }
);

export const LazyReferenceLine = dynamic(
  () => import('recharts').then((m) => m.ReferenceLine),
  { ssr: false }
);

export const LazyReferenceArea = dynamic(
  () => import('recharts').then((m) => m.ReferenceArea),
  { ssr: false }
);

export const LazyLabel = dynamic(
  () => import('recharts').then((m) => m.Label),
  { ssr: false }
);

export const LazyLabelList = dynamic(
  () => import('recharts').then((m) => m.LabelList),
  { ssr: false }
);

// ---------------------------------------------------------------------------
// Brush (heavy — data-zoom slider inside chart)
// ---------------------------------------------------------------------------
export const LazyBrush = dynamic(
  () => import('recharts').then((m) => m.Brush),
  { ssr: false }
);
