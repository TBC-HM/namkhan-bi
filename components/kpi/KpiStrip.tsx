// components/kpi/KpiStrip.tsx
//
// Compact one-row KPI strip — replaces the bulky `<PanelHero kpis>` tiles
// (which are min-height 96px each) with a single ~52px row.
// Use when 6+ KPIs need to sit on one line and the page should feel modern,
// not "1982 spreadsheet". Uses brass-mono labels above italic-serif values to
// keep the rest of the design language consistent.
//
// Props
//   items     — array of { label, value, hint?, tone? }
//   columns?  — preferred minimum tile width in px. Default 150 (auto-fits).

import type { CSSProperties } from 'react';

export interface KpiStripItem {
  label: string;
  value: string | number;
  /** Small caption shown below the value. Optional. */
  hint?: string;
  /** Colour tone for the value. */
  tone?: 'pos' | 'neg' | 'warn' | 'neutral';
  /** Format hint — applied if value is a number. */
  kind?: 'money' | 'pct' | 'count' | 'text';
  /** Hover tooltip — same data-tooltip pattern as KpiBox. Falls back to label · hint. */
  tooltip?: string;
}

interface Props {
  items: KpiStripItem[];
  /** Min tile width in px before they wrap. Default 150. */
  minWidth?: number;
}

function fmtValue(item: KpiStripItem): string {
  const v = item.value;
  if (typeof v === 'string') return v;
  if (item.kind === 'pct')   return `${v.toFixed(1)}%`;
  if (item.kind === 'money') {
    const abs = Math.abs(v);
    const sign = v < 0 ? '−' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}k`;
    return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
  }
  if (item.kind === 'count') return Math.round(v).toLocaleString('en-US');
  return String(v);
}

const toneColor: Record<NonNullable<KpiStripItem['tone']>, string> = {
  pos: 'var(--good, #2c7a4b)',
  neg: 'var(--bad, #b53a2a)',
  warn: 'var(--brass, #b48228)',
  neutral: 'var(--ink, #2c2a25)',
};

export default function KpiStrip({ items, minWidth = 150 }: Props) {
  if (items.length === 0) return null;

  const containerStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`,
    gap: 1,
    background: 'var(--paper-deep, #d9cfb6)',
    border: '1px solid var(--paper-deep, #d9cfb6)',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 14,
  };
  const itemStyle: CSSProperties = {
    background: 'var(--paper-warm, #f5e9cf)',
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minHeight: 0,
  };
  const labelStyle: CSSProperties = {
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)',
    textTransform: 'uppercase',
    color: 'var(--brass, #b48228)',
    lineHeight: 1.1,
  };
  const valueStyle = (tone?: KpiStripItem['tone']): CSSProperties => ({
    fontFamily: 'var(--serif)',
    fontStyle: 'italic',
    fontSize: 'var(--t-lg)',
    lineHeight: 1.05,
    fontVariantNumeric: 'tabular-nums',
    color: tone ? toneColor[tone] : toneColor.neutral,
  });
  const hintStyle: CSSProperties = {
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    color: 'var(--ink-soft, #6b675f)',
    lineHeight: 1.1,
    opacity: 0.85,
  };

  return (
    <div style={containerStyle} role="group" aria-label="KPI strip">
      {items.map((it, i) => {
        const tip = it.tooltip ?? [it.label, it.hint].filter(Boolean).join(' · ');
        return (
          <div key={i} style={itemStyle} data-tooltip={tip || undefined}>
            <span style={labelStyle}>{it.label}</span>
            <span style={valueStyle(it.tone)}>{fmtValue(it)}</span>
            {it.hint ? <span style={hintStyle}>{it.hint}</span> : null}
          </div>
        );
      })}
    </div>
  );
}
