'use client';
/**
 * DynamicCharts.tsx — Lazy-loaded Recharts barrel
 *
 * Perf marathon #229 child (ticket #236)
 * Recharts is 100 kB+ gzipped. This file re-exports every chart type
 * used across dashboard pages via next/dynamic so the bundle is NOT
 * included in the initial JS payload. Consumers import from here
 * instead of directly from 'recharts'.
 *
 * Usage:
 *   import { LazyLineChart, LazyBarChart } from '@/components/charts/DynamicCharts';
 *
 * Each export is a client component with ssr:false and a lightweight
 * skeleton placeholder while loading.
 */

import dynamic from 'next/dynamic';
import React from 'react';

// ---------------------------------------------------------------------------
// Shared loading skeleton
// ---------------------------------------------------------------------------
function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div
      style={{
        width: '100%',
        height,
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
        borderRadius: 8,
      }}
      aria-busy="true"
      aria-label="Loading chart…"
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
// Lazy-loaded Recharts chart roots
// ---------------------------------------------------------------------------

/** Lazy LineChart — use for time-series revenue / rate trends */
export const LazyLineChart = dynamic(
  () => import('recharts').then((m) => ({ default: m.LineChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

/** Lazy BarChart — use for occupancy / segmentation breakdowns */
export const LazyBarChart = dynamic(
  () => import('recharts').then((m) => ({ default: m.BarChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

/** Lazy AreaChart — use for cumulative revenue / pick-up curves */
export const LazyAreaChart = dynamic(
  () => import('recharts').then((m) => ({ default: m.AreaChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

/** Lazy PieChart — use for channel-mix / room-type distributions */
export const LazyPieChart = dynamic(
  () => import('recharts').then((m) => ({ default: m.PieChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

/** Lazy ComposedChart — use for dual-axis ADR + OCC overlays */
export const LazyComposedChart = dynamic(
  () => import('recharts').then((m) => ({ default: m.ComposedChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

/** Lazy RadarChart — use for segment spider / heatmap views */
export const LazyRadarChart = dynamic(
  () => import('recharts').then((m) => ({ default: m.RadarChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

// ---------------------------------------------------------------------------
// Recharts sub-components — re-exported as-is (tiny, always needed with chart)
// These are NOT dynamically imported because they are JSON-serialisable
// config objects (no rendering weight on their own).
// ---------------------------------------------------------------------------
export {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  Bar,
  Area,
  Pie,
  Cell,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Brush,
  LabelList,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
