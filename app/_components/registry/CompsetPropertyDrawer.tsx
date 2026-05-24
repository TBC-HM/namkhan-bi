// app/_components/registry/CompsetPropertyDrawer.tsx
// PBS #193 (2026-05-25) — clicking a competitor row on /revenue/compset opens
// this right-side drawer with a compact summary of the property. Same URL
// pattern as ChannelDrillDrawer (?comp=<comp_id>). Close strips the param.
'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Drawer, KpiTile, type KpiTileProps } from '@/app/(cockpit)/_design';

export interface CompsetRow {
  comp_id: string;
  property_name: string;
  is_self: boolean | null;
  star_rating: number | null;
  rooms: number | null;
  latest_usd: number | null;
  avg_30d_usd: number | null;
  min_30d_usd: number | null;
  max_30d_usd: number | null;
  pct_vs_median: number | null;
  obs_count_30d: number | null;
  last_shop_human: string | null;
  review_score: number | null;
  review_count: number | null;
  channels_with_reviews: number | null;
  has_bdc: boolean | null;
  has_agoda: boolean | null;
  has_expedia: boolean | null;
  has_trip: boolean | null;
  has_direct: boolean | null;
}

interface Props {
  rows: CompsetRow[];
}

function fmtUSD(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return '$' + Math.round(Number(n)).toLocaleString('en-US');
}
function fmtSignedPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}

export default function CompsetPropertyDrawer({ rows }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const compId = sp?.get('comp') ?? '';

  const active = useMemo(
    () => (compId ? rows.find((r) => r.comp_id === compId) : undefined),
    [compId, rows],
  );

  const onClose = useCallback(() => {
    const params = new URLSearchParams(sp?.toString() ?? '');
    params.delete('comp');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [router, pathname, sp]);

  if (!compId) return null;
  if (!active) return null;

  const tiles: KpiTileProps[] = [
    { label: 'Latest rate', value: fmtUSD(active.latest_usd), size: 'sm', footnote: active.last_shop_human ? `shopped ${active.last_shop_human}` : 'last shop' },
    { label: 'Avg · 30d',   value: fmtUSD(active.avg_30d_usd), size: 'sm', footnote: `${active.obs_count_30d ?? 0} observations` },
    { label: '30d range',   value: `${fmtUSD(active.min_30d_usd)} – ${fmtUSD(active.max_30d_usd)}`, size: 'sm' },
    { label: 'vs median',   value: fmtSignedPct(active.pct_vs_median), size: 'sm',
      status: active.pct_vs_median == null ? 'grey' : active.pct_vs_median > 5 ? 'amber' : active.pct_vs_median < -5 ? 'red' : 'green' },
    { label: 'Rooms',       value: active.rooms ?? '—', size: 'sm', footnote: active.star_rating ? '★'.repeat(active.star_rating) : '' },
    { label: 'Review score', value: active.review_score ? active.review_score.toFixed(1) : '—', size: 'sm', footnote: active.review_count ? `${active.review_count} reviews` : '' },
  ];

  const channels: Array<[string, boolean | null]> = [
    ['Booking.com', active.has_bdc],
    ['Agoda',       active.has_agoda],
    ['Expedia',     active.has_expedia],
    ['Trip.com',    active.has_trip],
    ['Direct',      active.has_direct],
  ];

  return (
    <Drawer
      open={true}
      onClose={onClose}
      title={active.property_name}
      subtitle={active.is_self ? '⭐ This is your property' : 'Competitor · last 30 days'}
      width="lg"
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>

      <section style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--hairline, #E6DFCC)' }}>
        <h3 style={headingStyle}>Channels seen</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {channels.map(([name, on]) => (
            <span key={name} style={pillStyle(!!on)}>{name}</span>
          ))}
        </div>
      </section>
    </Drawer>
  );
}

const headingStyle: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--ink-soft, #5A5A5A)',
};

function pillStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    padding: '4px 10px',
    borderRadius: 99,
    border: `1px solid ${active ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
    background: active ? 'var(--primary, #1F3A2E)' : 'var(--paper, #FFFFFF)',
    color: active ? '#FFFFFF' : 'var(--ink-soft, #5A5A5A)',
    fontWeight: active ? 600 : 500,
  };
}
