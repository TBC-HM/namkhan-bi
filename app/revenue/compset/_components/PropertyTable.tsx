// app/revenue/compset/_components/PropertyTable.tsx
// Client wrapper for the comp-set property table. Self row tinted gold + ★.
// Channel badges show B/A/E/T/D — coloured if URL exists else faded.

'use client';

import { useState } from 'react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { fmtTableUsd, fmtIsoDate, EMPTY } from '@/lib/format';
import type { CompetitorDeepData, PropertySummaryRow } from './types';
import DeepViewPanel from './property-detail/DeepViewPanel';

interface ChannelBadgeProps {
  letter: string;
  url: string | null;
  title: string;
}

function ChannelBadge({ letter, url, title }: ChannelBadgeProps) {
  const active = !!url;
  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    borderRadius: 3,
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    fontWeight: 700,
    border: `1px solid ${active ? 'var(--moss)' : 'var(--paper-deep)'}`,
    background: active ? 'var(--moss)' : 'transparent',
    color: active ? 'var(--paper-warm)' : 'var(--ink-faint)',
    textDecoration: 'none',
    opacity: active ? 1 : 0.45,
  };
  if (active) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={style}
        title={title}
      >
        {letter}
      </a>
    );
  }
  return (
    <span style={style} title={`${title} — not listed`}>
      {letter}
    </span>
  );
}

function formatLastShop(iso: string | null, human: string | null): React.ReactNode {
  if (!iso) {
    return (
      <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>
        never
      </span>
    );
  }
  const tone = human ? 'active' : 'pending';
  return <StatusPill tone={tone}>{human ?? fmtIsoDate(iso)}</StatusPill>;
}

function formatVsMedian(p: PropertySummaryRow): React.ReactNode {
  if (p.is_self) {
    return <span style={{ color: 'var(--ink-mute)' }}>self</span>;
  }
  if (p.pct_vs_median == null) return EMPTY;
  const v = Number(p.pct_vs_median);
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  const abs = Math.abs(v).toFixed(1);
  const color =
    Math.abs(v) < 5
      ? 'var(--ink-mute)'
      : v > 0
      ? 'var(--st-bad)'
      : 'var(--moss-glow)';
  return (
    <span style={{ color, fontVariantNumeric: 'tabular-nums' }}>
      {sign}
      {abs}%
    </span>
  );
}

function formatRange(p: PropertySummaryRow): React.ReactNode {
  if (p.min_30d_usd == null || p.max_30d_usd == null) return EMPTY;
  return (
    <span
      style={{
        color: 'var(--ink-mute)',
        fontSize: 'var(--t-xs)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {fmtTableUsd(p.min_30d_usd)}–{fmtTableUsd(p.max_30d_usd)}
    </span>
  );
}

function formatReviews(p: PropertySummaryRow): React.ReactNode {
  if (p.review_score == null) return EMPTY;
  const score = Number(p.review_score);
  const tone =
    score >= 9.0 ? 'var(--moss-glow)' : score >= 8.0 ? 'var(--brass)' : 'var(--ink-soft)';
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.2 }}>
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-base)',
          fontWeight: 600,
          color: tone,
        }}
      >
        {score.toFixed(1)}
      </span>
      <span
        style={{
          fontSize: 'var(--t-xs)',
          color: 'var(--ink-mute)',
          fontFamily: 'var(--mono)',
        }}
      >
        {p.star_rating ? `★ ${p.star_rating} · ` : ''}
        {p.review_count != null ? p.review_count.toLocaleString('en-US') : '0'} reviews
      </span>
    </div>
  );
}

function formatBestRate(p: PropertySummaryRow): React.ReactNode {
  if (p.latest_usd == null) return EMPTY;
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      <strong>{fmtTableUsd(p.latest_usd)}</strong>{' '}
      {p.latest_channel && (
        <span
          style={{
            fontSize: 'var(--t-xs)',
            color: 'var(--ink-mute)',
            textTransform: 'uppercase',
            fontFamily: 'var(--mono)',
            letterSpacing: 'var(--ls-loose)',
          }}
        >
          {p.latest_channel.slice(0, 3)}
        </span>
      )}
    </span>
  );
}

function formatPropertyName(p: PropertySummaryRow): React.ReactNode {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      {p.is_self && <span style={{ color: 'var(--brass)' }}>★</span>}
      {p.direct_url ? (
        <a
          href={p.direct_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--ink)',
            textDecoration: 'none',
            fontWeight: 500,
            borderBottom: '1px dashed var(--paper-deep)',
            paddingBottom: 1,
          }}
        >
          {p.property_name}
        </a>
      ) : (
        <span style={{ fontWeight: 500 }}>{p.property_name}</span>
      )}
      <span style={{ display: 'inline-flex', gap: 3, marginLeft: 4 }}>
        <ChannelBadge letter="B" url={p.bdc_url} title="Booking.com" />
        <ChannelBadge letter="E" url={p.expedia_url} title="Expedia" />
        <ChannelBadge letter="T" url={p.trip_url} title="Trip.com" />
        <ChannelBadge letter="D" url={p.direct_url} title="Direct" />
      </span>
    </div>
  );
}

interface Props {
  rows: PropertySummaryRow[];
  /** Server-fetched deep-view payload, keyed by comp_id. */
  deepDataMap?: Record<string, CompetitorDeepData>;
  /** Namkhan's own rate matrix, used as a baseline overlay in any comp's deep view. */
  namkhanRateMatrix?: import('./types').CompetitorRateMatrixRow[];
  /** Display name for the self row (defaults to "The Namkhan"). */
  namkhanLabel?: string;
}

const EMPTY_DEEP_DATA: CompetitorDeepData = {
  detail: null,
  roomMappings: [],
  ratePlanMix: [],
  rateMatrix: [],
  rankings: [],
  reviewsSummary: null,
  ratePlansLive: [],
};

export default function PropertyTable({ rows, deepDataMap, namkhanRateMatrix, namkhanLabel }: Props) {
  const [expandedCompId, setExpandedCompId] = useState<string | null>(null);

  const expandedRow =
    expandedCompId != null ? rows.find((r) => r.comp_id === expandedCompId) ?? null : null;
  const expandedData =
    expandedCompId != null ? deepDataMap?.[expandedCompId] ?? EMPTY_DEEP_DATA : null;

  const columns: Column<PropertySummaryRow>[] = [
    {
      key: 'expand',
      header: '',
      width: '24px',
      render: (r) => (
        <span
          data-comp-id={r.comp_id}
          aria-hidden
          style={{
            color: 'var(--ink-mute)',
            fontSize: 'var(--t-xs)',
            display: 'inline-block',
            width: 12,
            transform:
              expandedCompId === r.comp_id ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }}
        >
          ▶
        </span>
      ),
    },
    {
      key: 'property_name',
      header: 'PROPERTY',
      sortValue: (r) => (r.is_self ? '\0' : r.property_name),
      render: (r) => formatPropertyName(r),
    },
    {
      key: 'reviews',
      header: '★ / REVIEWS',
      sortValue: (r) => Number(r.review_score ?? 0),
      render: (r) => formatReviews(r),
    },
    {
      key: 'rooms',
      header: 'ROOMS',
      numeric: true,
      sortValue: (r) => Number(r.rooms ?? 0),
      render: (r) => r.rooms ?? EMPTY,
    },
    {
      key: 'best_rate',
      header: 'LATEST RATE',
      numeric: true,
      sortValue: (r) => Number(r.latest_usd ?? 0),
      render: (r) => formatBestRate(r),
    },
    {
      key: 'avg_30d',
      header: '30D AVG',
      numeric: true,
      sortValue: (r) => Number(r.avg_30d_usd ?? 0),
      render: (r) => fmtTableUsd(r.avg_30d_usd),
    },
    {
      key: 'range',
      header: '30D RANGE',
      numeric: true,
      render: (r) => formatRange(r),
    },
    {
      key: 'obs',
      header: 'SCRAPES (30D)',
      numeric: true,
      sortValue: (r) => Number(r.obs_count_30d ?? 0),
      render: (r) => r.obs_count_30d ?? EMPTY,
    },
    {
      key: 'last_shop',
      header: 'LAST SHOP',
      align: 'center',
      sortValue: (r) => r.last_shop_date ?? '',
      render: (r) => formatLastShop(r.last_shop_date, r.last_shop_human),
    },
    {
      key: 'vs_median',
      header: 'vs. MEDIAN',
      numeric: true,
      sortValue: (r) => Number(r.pct_vs_median ?? 0),
      render: (r) => formatVsMedian(r),
    },
  ];

  return (
    <>
      <div
        onClick={(e) => {
          const target = e.target as HTMLElement;
          // Don't toggle on link / pill / button clicks
          if (
            target.closest('a') ||
            target.closest('button') ||
            target.closest('.status-pill')
          ) {
            return;
          }
          const tr = target.closest('tr.data-table-row') as HTMLTableRowElement | null;
          if (!tr) return;
          // The chevron span in the first column carries data-comp-id.
          const marker = tr.querySelector('span[data-comp-id]') as HTMLElement | null;
          const compId = marker?.getAttribute('data-comp-id');
          if (!compId) return;
          setExpandedCompId((cur) => (cur === compId ? null : compId));
        }}
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.comp_id}
          rowClassName={(r) =>
            [
              r.is_self ? 'row-good' : '',
              expandedCompId === r.comp_id ? 'row-expanded' : '',
              'compset-row-clickable',
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          emptyState={
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <div style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>
                No properties in this set yet.
              </div>
              <div style={{ color: 'var(--ink-faint)', fontSize: 'var(--t-xs)' }}>
                Add competitors via the comp-set editor to start tracking.
              </div>
            </div>
          }
        />
      </div>

      {expandedRow && expandedData && (
        <DeepViewPanel
          propertyName={expandedRow.property_name}
          data={expandedData}
          isSelf={expandedRow.is_self ?? false}
          namkhanRateMatrix={namkhanRateMatrix}
          namkhanLabel={namkhanLabel}
          onClose={() => setExpandedCompId(null)}
        />
      )}

      {/* Style hooks: cursor pointer + expanded tint for the clickable rows. */}
      <style jsx global>{`
        .compset-row-clickable td:first-child + td {
          cursor: pointer;
        }
        .compset-row-clickable {
          cursor: pointer;
        }
        .row-expanded {
          background: var(--paper-deep);
        }
      `}</style>
    </>
  );
}
