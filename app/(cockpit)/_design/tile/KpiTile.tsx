// KpiTile — single number + label + delta + 0..n comparisons.
// Spec: design_system v5 §3.1. Sizes sm=88 / md=120 / lg=160.

'use client';

import { useState, type CSSProperties } from 'react';
import type { KpiTileProps, KpiComparison, TileSize } from '../types';
import { directionColor, arrowFor, renderCompareLine, formatNumber, formatCurrency } from '../internal/format';
import { statusColor } from '../internal/status';
import Skeleton from '../internal/Skeleton';
import '../internal/tokens.css';

const SIZE_HEIGHT: Record<TileSize, number> = { sm: 88, md: 120, lg: 160 };
const SIZE_VALUE:  Record<TileSize, number> = { sm: 20, md: 28,  lg: 36  };
const SIZE_PAD:    Record<TileSize, number> = { sm: 12, md: 16,  lg: 20  };

function renderValue(value: KpiTileProps['value'], currency?: KpiTileProps['currency']): string {
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return '—';
  if (currency) return formatCurrency(value, currency);
  return formatNumber(value, { decimals: 0 });
}

// When value is a long string (e.g. a kpi.v_… view name) we shrink the
// display so it fits a sm tile without horizontal overflow.
function valueFontSizeFor(value: KpiTileProps['value'], base: number): number {
  if (typeof value !== 'string') return base;
  if (value.length <= 8) return base;
  if (value.length <= 14) return Math.max(13, base - 4);
  if (value.length <= 24) return Math.max(12, base - 7);
  return Math.max(11, base - 9);
}

export default function KpiTile(props: KpiTileProps) {
  const {
    label, value, unit, currency, delta, compare, status, footnote, stly,
    size = 'md', loading, onClick, comparisonsExpandable = true,
  } = props;
  const [tipOpen, setTipOpen] = useState(false);
  const height = SIZE_HEIGHT[size];
  const valueBase = SIZE_VALUE[size];
  const valueSize = valueFontSizeFor(value, valueBase);
  const pad = SIZE_PAD[size];

  const compareItems: KpiComparison[] = compare ?? [];
  const isSm = size === 'sm';
  const inlineCount = isSm ? 0 : Math.min(2, compareItems.length);
  const inline = compareItems.slice(0, inlineCount);
  const overflow = compareItems.slice(inlineCount);
  const showChip = overflow.length > 0 && comparisonsExpandable;

  const interactive = !!onClick;

  const tileStyle: CSSProperties = {
    background: 'var(--paper, #FFFFFF)',
    border: '1px solid var(--hairline, #E6DFCC)',
    borderRadius: 8,
    padding: pad,
    minHeight: height,
    display: 'flex',
    flexDirection: 'column',
    gap: isSm ? 2 : 6,
    cursor: interactive ? 'pointer' : 'default',
    transition: 'box-shadow 120ms ease, border-color 120ms ease, transform 120ms ease',
    color: 'var(--ink, #1B1B1B)',
    fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
    position: 'relative',
    fontVariantNumeric: 'tabular-nums',
    overflow: 'hidden',
  };

  function handleKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!interactive) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  }

  if (loading) {
    return (
      <div style={tileStyle} aria-busy>
        <Skeleton width="60%" height={10} />
        <div style={{ marginTop: 6 }}><Skeleton width="40%" height={valueBase - 6} /></div>
        <div style={{ marginTop: 6 }}><Skeleton width="50%" height={10} /></div>
      </div>
    );
  }

  return (
    <div
      style={tileStyle}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : -1}
      onClick={onClick}
      onKeyDown={handleKey}
      onMouseEnter={(e) => {
        if (!interactive) return;
        e.currentTarget.style.borderColor = 'var(--primary, #1F3A2E)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--hairline, #E6DFCC)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={S.headRow}>
        <span style={{ ...S.label, fontSize: isSm ? 11 : 12 }}>{label}</span>
        {status && (
          <span
            aria-label={`status ${status}`}
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: statusColor(status),
              flexShrink: 0,
            }}
          />
        )}
      </div>

      <div style={{ ...S.valueRow, fontSize: valueSize }}>
        <span style={S.valueText}>{renderValue(value, currency)}</span>
        {unit && <span style={{ ...S.unit, fontSize: Math.max(10, valueSize - 8) }}>{unit}</span>}
      </div>

      {delta && (
        <div style={{ ...S.deltaLine, color: directionColor(delta.direction, delta.isGoodWhenUp ?? true) }}>
          <span style={S.arrow}>{arrowFor(delta.direction)}</span>
          <span>{formatNumber(delta.value, { signed: true, decimals: 1 })}%</span>
          <span style={S.deltaPeriod}>vs {delta.period}</span>
        </div>
      )}

      {inline.length > 0 && (
        <div style={S.compareStack}>
          {inline.map((c, i) => <CompareLine key={i} item={c} currency={currency} />)}
        </div>
      )}

      {showChip && (
        <div style={S.chipRow}>
          <button
            type="button"
            onMouseEnter={() => setTipOpen(true)}
            onMouseLeave={() => setTipOpen(false)}
            onFocus={() => setTipOpen(true)}
            onBlur={() => setTipOpen(false)}
            onClick={(e) => { e.stopPropagation(); setTipOpen((s) => !s); }}
            style={S.chip}
            aria-haspopup
            aria-expanded={tipOpen}
          >
            {isSm
              ? `+${compareItems.length} comparison${compareItems.length === 1 ? '' : 's'}`
              : `+${overflow.length} more`}
          </button>
          {tipOpen && (
            <div role="tooltip" style={S.tooltip}>
              {(isSm ? compareItems : overflow).map((c, i) => (
                <CompareLine key={i} item={c} currency={currency} inTooltip />
              ))}
            </div>
          )}
        </div>
      )}

      {footnote && (
        <div style={{ ...S.footnote, paddingRight: stly ? 56 : 0 }}>{footnote}</div>
      )}

      {stly && (
        <span
          style={S.stlyBadge}
          title="Same time last year"
          aria-label={`Same time last year: ${stly}`}
        >
          <span style={S.stlyPrefix}>LY</span> {stly}
        </span>
      )}
    </div>
  );
}

function CompareLine({
  item, currency, inTooltip,
}: { item: KpiComparison; currency?: KpiTileProps['currency']; inTooltip?: boolean }) {
  const { label, body, arrow, color, pending } = renderCompareLine(item, currency);
  return (
    <div style={{ ...S.compareLine, ...(inTooltip ? S.compareLineTip : null) }}>
      <span style={S.compareLabel}>{label}:</span>
      <span style={{ color: pending ? 'var(--ink-soft, #5A5A5A)' : color, fontStyle: pending ? 'italic' : 'normal' }}>
        {body}{!pending && arrow ? ` ${arrow}` : ''}
      </span>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  headRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { color: 'var(--ink-soft, #5A5A5A)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  valueRow: { display: 'flex', alignItems: 'baseline', gap: 6, fontWeight: 600, color: 'var(--ink, #1B1B1B)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, minWidth: 0 },
  valueText: { wordBreak: 'break-word', minWidth: 0 },
  unit: { color: 'var(--ink-soft, #5A5A5A)', fontWeight: 500 },
  deltaLine: { display: 'flex', alignItems: 'baseline', gap: 4, fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexWrap: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' },
  arrow: { fontSize: 14 },
  deltaPeriod: { color: 'var(--ink-soft, #5A5A5A)', fontWeight: 400, marginLeft: 4 },
  compareStack: { display: 'flex', flexDirection: 'column', gap: 2 },
  compareLine: { display: 'flex', gap: 6, fontSize: 11, alignItems: 'baseline' },
  compareLineTip: { fontSize: 12, padding: '2px 0' },
  compareLabel: { color: 'var(--ink-soft, #5A5A5A)' },
  chipRow: { position: 'relative', display: 'flex' },
  chip: {
    background: 'transparent',
    border: '1px solid var(--hairline, #E6DFCC)',
    borderRadius: 99,
    padding: '2px 8px',
    fontSize: 10,
    color: 'var(--ink-soft, #5A5A5A)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    marginBottom: 6,
    background: 'var(--paper, #FFFFFF)',
    border: '1px solid var(--hairline, #E6DFCC)',
    borderRadius: 6,
    padding: '8px 12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    minWidth: 160,
    zIndex: 50,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  footnote: { fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', marginTop: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
  // PBS 2026-07-15: compact "LY 22%" pill · bottom-right corner · never overlaps footnote
  // (footnote reserves paddingRight: 56 when stly is set).
  stlyBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    padding: '2px 6px',
    borderRadius: 4,
    background: 'var(--paper-soft, #FAFAF7)',
    border: '1px solid var(--hairline, #E6DFCC)',
    color: 'var(--ink, #1B1B1B)',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.02em',
    lineHeight: 1.2,
    fontVariantNumeric: 'tabular-nums',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    maxWidth: 90,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  stlyPrefix: {
    color: 'var(--ink-soft, #5A5A5A)',
    fontWeight: 500,
    fontSize: 9,
    letterSpacing: '0.06em',
    marginRight: 2,
  },
};
