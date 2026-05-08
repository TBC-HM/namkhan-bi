'use client';

/**
 * LazyCharts.tsx
 *
 * Ticket #236 — Perf marathon: lazy-load Recharts on dashboard pages.
 *
 * Recharts is ~100 kB gzipped. Importing it statically pulls it into the
 * main JS bundle even on routes that only *sometimes* render a chart.
 *
 * Usage — replace static Recharts imports with these lazy equivalents:
 *
 *   Before:
 *       import { LineChart, Line, ... } from 'recharts';
 *
 *   After:
 *       import { LazyLineChart, LazyBarChart, LazyAreaChart, ... } from '@/components/charts/LazyCharts';
 *
 * Each export is a next/dynamic wrapper with:
 *   - ssr: false   -- prevents SSR hydration mismatch (Recharts uses window)
 *   - loading fn   -- lightweight shimmer skeleton shown while chunk downloads
 *
 * All Recharts primitives (Line, Bar, XAxis, YAxis, Tooltip, Legend, etc.)
 * are re-exported directly -- they are tiny and do not need dynamic wrapping.
 * Only the top-level Chart components are lazy.
 */

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type {
  LineChartProps,
  BarChartProps,
  AreaChartProps,
  PieChartProps,
  ComposedChartProps,
  RadarChartProps,
  ScatterChartProps,
  FunnelChartProps,
  RadialBarChartProps,
  TreemapProps,
} from 'recharts';

// ---------------------------------------------------------------------------
// Shared skeleton shown while the Recharts chunk is loading
// ---------------------------------------------------------------------------

function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading chart..."
      style={{
        width: '100%',
        height,
        background: 'linear-gradient(90deg, #1e293b 25%, #273449 50%, #1e293b 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
        borderRadius: 8,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Lazy Chart containers -- next/dynamic with ssr:false
// Recharts uses named exports so each loader picks the specific export.
// ---------------------------------------------------------------------------

/** Lazy LineChart */
export const LazyLineChart: ComponentType<LineChartProps> = dynamic(
  async () => {
    const mod = await import('recharts');
    return { default: mod.LineChart as ComponentType<LineChartProps> };
  },
  { ssr: false, loading: () => <ChartSkeleton /> },
) as ComponentType<LineChartProps>;

/** Lazy BarChart */
export const LazyBarChart: ComponentType<BarChartProps> = dynamic(
  async () => {
    const mod = await import('recharts');
    return { default: mod.BarChart as ComponentType<BarChartProps> };
  },
  { ssr: false, loading: () => <ChartSkeleton /> },
) as ComponentType<BarChartProps>;

/** Lazy AreaChart */
export const LazyAreaChart: ComponentType<AreaChartProps> = dynamic(
  async () => {
    const mod = await import('recharts');
    return { default: mod.AreaChart as ComponentType<AreaChartProps> };
  },
  { ssr: false, loading: () => <ChartSkeleton /> },
) as ComponentType<AreaChartProps>;

/** Lazy PieChart */
export const LazyPieChart: ComponentType<PieChartProps> = dynamic(
  async () => {
    const mod = await import('recharts');
    return { default: mod.PieChart as ComponentType<PieChartProps> };
  },
  { ssr: false, loading: () => <ChartSkeleton /> },
) as ComponentType<PieChartProps>;

/** Lazy ComposedChart (Line + Bar + Area mixed) */
export const LazyComposedChart: ComponentType<ComposedChartProps> = dynamic(
  async () => {
    const mod = await import('recharts');
    return { default: mod.ComposedChart as ComponentType<ComposedChartProps> };
  },
  { ssr: false, loading: () => <ChartSkeleton /> },
) as ComponentType<ComposedChartProps>;

/** Lazy RadarChart */
export const LazyRadarChart: ComponentType<RadarChartProps> = dynamic(
  async () => {
    const mod = await import('recharts');
    return { default: mod.RadarChart as ComponentType<RadarChartProps> };
  },
  { ssr: false, loading: () => <ChartSkeleton /> },
) as ComponentType<RadarChartProps>;

/** Lazy ScatterChart */
export const LazyScatterChart: ComponentType<ScatterChartProps> = dynamic(
  async () => {
    const mod = await import('recharts');
    return { default: mod.ScatterChart as ComponentType<ScatterChartProps> };
  },
  { ssr: false, loading: () => <ChartSkeleton /> },
) as ComponentType<ScatterChartProps>;

/** Lazy FunnelChart */
export const LazyFunnelChart: ComponentType<FunnelChartProps> = dynamic(
  async () => {
    const mod = await import('recharts');
    return { default: mod.FunnelChart as ComponentType<FunnelChartProps> };
  },
  { ssr: false, loading: () => <ChartSkeleton /> },
) as ComponentType<FunnelChartProps>;

/** Lazy RadialBarChart */
export const LazyRadialBarChart: ComponentType<RadialBarChartProps> = dynamic(
  async () => {
    const mod = await import('recharts');
    return { default: mod.RadialBarChart as ComponentType<RadialBarChartProps> };
  },
  { ssr: false, loading: () => <ChartSkeleton /> },
) as ComponentType<RadialBarChartProps>;

/** Lazy Treemap */
export const LazyTreemap: ComponentType<TreemapProps> = dynamic(
  async () => {
    const mod = await import('recharts');
    return { default: mod.Treemap as ComponentType<TreemapProps> };
  },
  { ssr: false, loading: () => <ChartSkeleton /> },
) as ComponentType<TreemapProps>;

// ---------------------------------------------------------------------------
// Re-export all non-chart Recharts primitives (tiny; no lazy wrapping needed)
// ---------------------------------------------------------------------------
export {
  // Data series
  Line,
  Bar,
  Area,
  Pie,
  Radar,
  Scatter,
  Cell,
  Funnel,
  RadialBar,

  // Axes and grid
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,

  // UI chrome
  Tooltip,
  Legend,
  Brush,
  ReferenceLine,
  ReferenceDot,
  ReferenceArea,
  Label,
  LabelList,

  // Containers
  ResponsiveContainer,
  CartesianAxis,
} from 'recharts';
