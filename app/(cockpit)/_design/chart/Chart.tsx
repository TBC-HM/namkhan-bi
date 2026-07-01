// Chart — 10 variants in one component. Spec: design_system v5 §3.2.
// Universal tooltip (no opt-out). Optional dimension dropdown portals into
// the parent Container's action slot.

'use client';

import { Fragment, type CSSProperties, type ReactNode } from 'react';
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell,
  ComposedChart,
  XAxis, YAxis, CartesianGrid, Legend, Tooltip,
} from 'recharts';
import type { ChartProps, ChartSeries } from '../types';
import ChartTooltip from './ChartTooltip';
import EmptyState from './EmptyState';
import DimensionSelector from './DimensionSelector';
import Skeleton from '../internal/Skeleton';
import '../internal/tokens.css';

const DEFAULT_COLORS = [
  '#1F3A2E', '#B8542A', '#B8A878', '#2E7D32',
  '#6E8B65', '#C8843E', '#5A5A5A', '#8FA585',
];

function colorAt(i: number, override?: string): string { return override ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]; }

function asSeries(yKey: ChartProps['yKey'], series?: ChartSeries[]): ChartSeries[] {
  if (series && series.length > 0) return series;
  if (Array.isArray(yKey)) return yKey.map((k) => ({ key: k, label: k }));
  if (typeof yKey === 'string') return [{ key: yKey, label: yKey }];
  return [];
}

export default function Chart(props: ChartProps) {
  const {
    variant, data, xKey, yKey, height = 280, loading, empty, formatY, formatX, legend = 'bottom',
    tooltipFormatter, dimensions, activeDimensionKey, onDimensionChange, renderItem, onRowClick,
  } = props;

  const series = asSeries(yKey, props.series);
  const showDimSel = (dimensions?.length ?? 0) >= 2;

  if (loading) {
    return (
      <>
        {showDimSel && <DimensionSelector dimensions={dimensions!} activeKey={activeDimensionKey} onChange={onDimensionChange} />}
        <div style={{ minHeight: height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Skeleton width="100%" height={height} />
        </div>
      </>
    );
  }
  if (!data || data.length === 0) {
    return (
      <>
        {showDimSel && <DimensionSelector dimensions={dimensions!} activeKey={activeDimensionKey} onChange={onDimensionChange} />}
        <EmptyState title={empty?.title ?? 'No data'} hint={empty?.hint} height={height} />
      </>
    );
  }

  const sel = showDimSel
    ? <DimensionSelector dimensions={dimensions!} activeKey={activeDimensionKey} onChange={onDimensionChange} />
    : null;

  const tip = (variantName: string, showStackTotal = false) => (
    <Tooltip
      cursor={{ stroke: 'var(--hairline, #E6DFCC)', strokeWidth: 1 }}
      content={(p) => (
        <ChartTooltip
          {...p as Record<string, unknown>}
          formatY={formatY}
          formatX={formatX}
          tooltipFormatter={tooltipFormatter}
          variant={variantName}
          showStackTotal={showStackTotal}
        />
      )}
    />
  );

  switch (variant) {
    case 'line': return (
      <>
        {sel}
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--hairline, #E6DFCC)" vertical={false} />
            {/* PBS 2026-05-28: Recharts default "preserveEnd" clusters labels at the right on long timelines (30+ months). Pick every-Nth tick for ~8 evenly-spaced labels across the full range, plus minTickGap so they never overlap. */}
            <XAxis dataKey={xKey} stroke="var(--ink-soft, #5A5A5A)" fontSize={11} tickFormatter={formatX as (v: unknown) => string | undefined} interval={data.length > 12 ? Math.max(0, Math.floor((data.length - 1) / 7)) : 0} minTickGap={16} />
            <YAxis stroke="var(--ink-soft, #5A5A5A)" fontSize={11} tickFormatter={formatY} />
            {tip('line')}
            {legend !== 'none' && <Legend verticalAlign={legend === 'top' ? 'top' : 'bottom'} wrapperStyle={{ fontSize: 11 }} />}
            {series.map((s, i) => (
              <Line key={s.key} dataKey={s.key} name={s.label} stroke={colorAt(i, s.color)} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </>
    );

    case 'area': return (
      <>
        {sel}
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--hairline, #E6DFCC)" vertical={false} />
            <XAxis dataKey={xKey} stroke="var(--ink-soft, #5A5A5A)" fontSize={11} tickFormatter={formatX as (v: unknown) => string | undefined} />
            <YAxis stroke="var(--ink-soft, #5A5A5A)" fontSize={11} tickFormatter={formatY} />
            {tip('area')}
            {legend !== 'none' && <Legend verticalAlign={legend === 'top' ? 'top' : 'bottom'} wrapperStyle={{ fontSize: 11 }} />}
            {series.map((s, i) => {
              const c = colorAt(i, s.color);
              return <Area key={s.key} dataKey={s.key} name={s.label} stroke={c} fill={c} fillOpacity={0.18} strokeWidth={2} />;
            })}
          </AreaChart>
        </ResponsiveContainer>
      </>
    );

    case 'bar':
    case 'stacked_bar': {
      const stacked = variant === 'stacked_bar';
      return (
        <>
          {sel}
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="var(--hairline, #E6DFCC)" vertical={false} />
              <XAxis dataKey={xKey} stroke="var(--ink-soft, #5A5A5A)" fontSize={11} tickFormatter={formatX as (v: unknown) => string | undefined} />
              <YAxis stroke="var(--ink-soft, #5A5A5A)" fontSize={11} tickFormatter={formatY} />
              {tip(variant, stacked)}
              {legend !== 'none' && <Legend verticalAlign={legend === 'top' ? 'top' : 'bottom'} wrapperStyle={{ fontSize: 11 }} />}
              {series.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={colorAt(i, s.color)} stackId={stacked ? 'a' : undefined} radius={stacked ? 0 : [2, 2, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </>
      );
    }

    case 'combo': return (
      <>
        {sel}
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--hairline, #E6DFCC)" vertical={false} />
            <XAxis dataKey={xKey} stroke="var(--ink-soft, #5A5A5A)" fontSize={11} tickFormatter={formatX as (v: unknown) => string | undefined} />
            <YAxis stroke="var(--ink-soft, #5A5A5A)" fontSize={11} tickFormatter={formatY} />
            {tip('combo')}
            {legend !== 'none' && <Legend verticalAlign={legend === 'top' ? 'top' : 'bottom'} wrapperStyle={{ fontSize: 11 }} />}
            {series.map((s, i) => {
              const c = colorAt(i, s.color);
              if (s.type === 'line') {
                return <Line key={s.key} dataKey={s.key} name={s.label} stroke={c} strokeWidth={2} dot={false} />;
              }
              return <Bar key={s.key} dataKey={s.key} name={s.label} fill={c} radius={[2, 2, 0, 0]} />;
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </>
    );

    case 'donut': {
      const total = data.reduce((acc, d) => acc + (Number(d[series[0]?.key ?? 'value']) || 0), 0);
      return (
        <>
          {sel}
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              {tip('donut')}
              <Pie data={data} dataKey={series[0]?.key ?? 'value'} nameKey={xKey ?? 'name'} innerRadius="55%" outerRadius="85%" paddingAngle={1} stroke="var(--paper, #FFFFFF)">
                {data.map((_, i) => <Cell key={i} fill={colorAt(i)} />)}
              </Pie>
              {legend !== 'none' && <Legend verticalAlign={legend === 'top' ? 'top' : 'bottom'} wrapperStyle={{ fontSize: 11 }} formatter={(name: string, _e, idx) => {
                const v = Number(data[idx as number]?.[series[0]?.key ?? 'value']) || 0;
                const pct = total ? ((v / total) * 100).toFixed(1) : '0.0';
                return `${name} · ${pct}%`;
              }} />}
            </PieChart>
          </ResponsiveContainer>
        </>
      );
    }

    case 'heatmap':  return <>{sel}<HeatmapView data={data} xKey={xKey ?? 'x'} yKey={(Array.isArray(yKey) ? yKey[0] : yKey) ?? 'y'} valueKey={series[0]?.key ?? 'value'} height={height} formatY={formatY} valueSuffix={props.valueSuffix} /></>;
    case 'table':    return <>{sel}<TableView data={data} series={series} xKey={xKey} formatY={formatY} formatX={formatX} onRowClick={onRowClick} /></>;
    case 'tile':     return <>{sel}<TileView data={data} series={series} xKey={xKey} formatY={formatY} /></>;
    case 'cards':    return <>{sel}<CardsView data={data} renderItem={renderItem} series={series} xKey={xKey} /></>;

    default: return <EmptyState title={`Unknown variant: ${variant}`} height={height} />;
  }
}

// ─── Custom variant views ─────────────────────────────────────────────────

function HeatmapView({ data, xKey, yKey, valueKey, height, formatY, valueSuffix }: { data: Record<string, unknown>[]; xKey: string; yKey: string; valueKey: string; height: number; formatY?: (v: number) => string; valueSuffix?: string }) {
  const fmtVal = (v: number) => formatY ? formatY(v) : `${v.toLocaleString('en-US')}${valueSuffix ?? ''}`;
  const xs = Array.from(new Set(data.map((d) => String(d[xKey]))));
  const ys = Array.from(new Set(data.map((d) => String(d[yKey]))));
  const lookup = new Map<string, number>();
  let max = 0;
  data.forEach((d) => {
    const v = Number(d[valueKey]) || 0;
    if (v > max) max = v;
    lookup.set(`${d[xKey]}|${d[yKey]}`, v);
  });
  if (max === 0) max = 1;

  return (
    <div style={{ overflowX: 'auto', minHeight: height }}>
      <div style={{ display: 'grid', gridTemplateColumns: `auto repeat(${xs.length}, 1fr)`, gap: 2, fontSize: 11 }}>
        <div />
        {xs.map((x) => <div key={`xhead-${x}`} style={{ padding: '4px 8px', color: 'var(--ink-soft, #5A5A5A)', textAlign: 'center', fontWeight: 500 }}>{x}</div>)}
        {ys.map((y) => (
          <Fragment key={`row-${y}`}>
            <div style={{ padding: '6px 8px', color: 'var(--ink-soft, #5A5A5A)', fontWeight: 500 }}>{y}</div>
            {xs.map((x) => {
              const v = lookup.get(`${x}|${y}`) ?? 0;
              const intensity = v / max;
              const bg = `rgba(31, 58, 46, ${Math.max(0.05, intensity)})`;
              const fg = intensity > 0.55 ? '#FFF' : 'var(--ink, #1B1B1B)';
              return (
                <div key={`cell-${x}-${y}`} title={`${y} · ${x} · ${fmtVal(v)}`} style={{ background: bg, color: fg, padding: '8px 4px', textAlign: 'center', borderRadius: 2, fontVariantNumeric: 'tabular-nums', cursor: 'help' }}>
                  {fmtVal(v)}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function TableView({ data, series, xKey, formatY, formatX, onRowClick }: { data: Record<string, unknown>[]; series: ChartSeries[]; xKey?: string; formatY?: (v: number) => string; formatX?: (v: unknown) => string; onRowClick?: (row: Record<string, unknown>) => void }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={S.table}>
        <thead>
          <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E6DFCC' }}>
            {xKey && <th style={S.th}>{xKey}</th>}
            {series.map((s) => <th key={s.key} style={{ ...S.th, textAlign: 'right' }}>{s.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#F5F5F5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              onClick={() => onRowClick?.(row)}
            >
              {xKey && <td style={S.td}>{formatX ? formatX(row[xKey]) : String(row[xKey] ?? '')}</td>}
              {series.map((s) => {
                const v = row[s.key];
                const rendered = typeof v === 'number' && formatY ? formatY(v) : (typeof v === 'number' ? v.toLocaleString('en-US') : String(v ?? ''));
                return <td key={s.key} style={{ ...S.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{rendered}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TileView({ data, series, xKey, formatY }: { data: Record<string, unknown>[]; series: ChartSeries[]; xKey?: string; formatY?: (v: number) => string }) {
  const row = data[0] ?? {};
  const main = series[0]?.key ?? (xKey ?? '');
  const value = row[main];
  const display = typeof value === 'number' ? (formatY ? formatY(value) : value.toLocaleString('en-US')) : String(value ?? '—');
  return (
    <div title={`${main} · ${display}`} style={{ ...S.tileWrap, transition: 'box-shadow 120ms ease, transform 120ms ease' }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={S.tileLabel}>{series[0]?.label ?? main}</div>
      <div style={S.tileValue}>{display}</div>
    </div>
  );
}

function CardsView({ data, renderItem, series, xKey }: { data: Record<string, unknown>[]; renderItem?: (row: Record<string, unknown>) => ReactNode; series: ChartSeries[]; xKey?: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
      {data.map((row, i) => (
        <div
          key={i}
          style={S.card}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary, #1F3A2E)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--hairline, #E6DFCC)'; }}
        >
          {renderItem ? renderItem(row) : (
            <>
              {xKey && <div style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)' }}>{String(row[xKey] ?? '')}</div>}
              {series.map((s) => (
                <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--ink-soft, #5A5A5A)' }}>{s.label}</span>
                  <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{String(row[s.key] ?? '—')}</span>
                </div>
              ))}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)' },
  th: { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #E6DFCC', color: '#1B1B1B', fontWeight: 600, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em', background: '#FFFFFF', fontFamily: 'var(--mono, monospace)' },
  td: { padding: '8px 12px', borderBottom: '1px solid #E6DFCC', color: '#1B1B1B' },
  tileWrap: { background: 'var(--paper, #FFFFFF)', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 },
  tileLabel: { fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  tileValue: { fontSize: 28, fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
  card: { background: 'var(--paper, #FFFFFF)', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 },
};
