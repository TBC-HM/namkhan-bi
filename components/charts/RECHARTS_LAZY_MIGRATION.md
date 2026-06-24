# Recharts Lazy-Load Migration Guide
**Ticket #229-child · Perf marathon 2026-05-08**

## Why

Recharts is ~450 kB (gzip: ~130 kB). When it is imported statically, Next.js
bundles it into the **initial JS payload** of every dashboard page. On a 4G
connection this adds ~300–600 ms to Time-to-Interactive.

Using `next/dynamic({ ssr: false })` tells Next.js to split Recharts into a
**separate chunk** that downloads only when the first chart component mounts.
Charts still render visually within 50–100 ms of the main bundle completing.

## Before / After

```tsx
// ❌ BEFORE — static import (blocks initial load)
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ✅ AFTER — lazy import (deferred chunk)
import {
  LazyLineChart as LineChart,
  LazyLine as Line,
  LazyXAxis as XAxis,
  LazyYAxis as YAxis,
  LazyCartesianGrid as CartesianGrid,
  LazyTooltip as Tooltip,
  LazyResponsiveContainer as ResponsiveContainer,
} from '@/components/charts/LazyRechartsWrappers';
```

The aliasing (`as LineChart`) keeps all JSX inside the chart component
**identical** — zero template changes needed.

## Available exports

| Lazy export | Recharts source |
|---|---|
| `LazyResponsiveContainer` | `ResponsiveContainer` |
| `LazyLineChart` | `LineChart` |
| `LazyBarChart` | `BarChart` |
| `LazyAreaChart` | `AreaChart` |
| `LazyPieChart` | `PieChart` |
| `LazyComposedChart` | `ComposedChart` |
| `LazyRadarChart` | `RadarChart` |
| `LazyXAxis` | `XAxis` |
| `LazyYAxis` | `YAxis` |
| `LazyCartesianGrid` | `CartesianGrid` |
| `LazyPolarGrid` | `PolarGrid` |
| `LazyPolarAngleAxis` | `PolarAngleAxis` |
| `LazyPolarRadiusAxis` | `PolarRadiusAxis` |
| `LazyLine` | `Line` |
| `LazyBar` | `Bar` |
| `LazyArea` | `Area` |
| `LazyPie` | `Pie` |
| `LazyRadar` | `Radar` |
| `LazyCell` | `Cell` |
| `LazyTooltip` | `Tooltip` |
| `LazyLegend` | `Legend` |
| `LazyReferenceLine` | `ReferenceLine` |
| `LazyReferenceArea` | `ReferenceArea` |
| `LazyLabel` | `Label` |
| `LazyLabelList` | `LabelList` |
| `LazyBrush` | `Brush` |

## Skeleton loading state

Chart-root components (`LazyLineChart`, `LazyBarChart`, etc.) show an animated
shimmer placeholder at `height: 260px` while Recharts loads. This prevents
Cumulative Layout Shift (CLS). You can override height via the `height` prop on
`LazyResponsiveContainer` as usual.

## How to migrate an existing chart file

1. Replace `import { ... } from 'recharts'` with the lazy equivalents above.
2. Alias with `as OriginalName` to keep JSX identical.
3. Ensure the file has `'use client'` at the top (charts are always client components).
4. Remove any `// @ts-ignore recharts` suppressions — types are identical.

## Measurement

Run Lighthouse before/after on `/revenue/pulse` (the heaviest chart page):

```
lighthouse https://namkhan-bi.vercel.app/revenue/pulse \
  --only-categories=performance --output=json | \
  jq '.categories.performance.score, .audits["total-blocking-time"].numericValue'
```

Expected: TBT drops ≥ 80 ms, TBC score ≥ +5 points.
