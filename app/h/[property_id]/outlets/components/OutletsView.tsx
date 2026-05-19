// Client orchestrator for the F&B Outlets page.
// Receives a server-built snapshot and renders the canonical primitives.
// Same component tree for every property — values are 0 when no data.
//
// Lives in a `components/` folder rather than at the page root because
// ListContainer needs function props (renderRow, rowKey, column.render)
// which cannot cross the server→client boundary. This is the same trap
// I hit with Chart.formatY on the pace refactor.

'use client';

import { useState } from 'react';
import {
  DashboardPage, Container, KpiTile, Chart, ListContainer, Drawer,
  type ChartSeries, type ListContainerColumn, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import type { OutletsSnapshot, OutletMixRow } from '../lib/types';

const FALLBACK_OUTLET_COLORS = ['#1F3A2E', '#B8542A', '#B8A878', '#2E7D32', '#6E8B65', '#C8843E', '#5A5A5A', '#8FA585'];

interface Props {
  snapshot: OutletsSnapshot;
  propertyName: string;
}

function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return '$0';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function formatInt(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('en-US');
}

export default function OutletsView({ snapshot, propertyName }: Props) {
  const {
    mtdRevenue, mtdCovers, mtdAvgCheck, topOutlet,
    byOutlet, dailyByOutlet, outletKeys, topProducts, productCount,
    daysCovered, monthLabel,
  } = snapshot;
  const [drillRow, setDrillRow] = useState<OutletMixRow | null>(null);

  const tiles: KpiTileProps[] = [
    {
      label: 'MTD F&B Revenue', value: Math.round(mtdRevenue), currency: 'USD', size: 'sm',
      footnote: monthLabel,
      status: mtdRevenue > 0 ? 'green' : 'grey',
    },
    {
      label: 'MTD Covers', value: mtdCovers, size: 'sm',
      footnote: 'reservation-distinct',
      status: mtdCovers > 0 ? 'green' : 'grey',
    },
    {
      label: 'Avg Check', value: Math.round(mtdAvgCheck), currency: 'USD', size: 'sm',
      footnote: 'MTD revenue ÷ covers',
      status: mtdAvgCheck > 0 ? 'green' : 'grey',
    },
    {
      label: 'Top Outlet',
      value: topOutlet ? topOutlet.name : '—',
      size: 'sm',
      footnote: topOutlet ? formatUSD(topOutlet.revenue) + ' · last 30d' : 'no outlet revenue yet',
      status: topOutlet ? 'green' : 'grey',
    },
  ];

  // Chart series: one per outlet, plus a default fallback so the chart
  // still renders meaningfully when there are 0 outlets.
  const outletSeries: ChartSeries[] = outletKeys.length > 0
    ? outletKeys.map((k, i) => ({ key: k, label: k, color: FALLBACK_OUTLET_COLORS[i % FALLBACK_OUTLET_COLORS.length] }))
    : [{ key: 'total', label: 'No outlets', color: 'var(--ink-soft, #5A5A5A)' }];

  // Donut data — by outlet revenue over 30d.
  const donutData = byOutlet.length > 0
    ? byOutlet.map((o) => ({ name: o.outlet, value: Math.round(o.revenue) }))
    : [];

  // Per-outlet KpiTile grid (left side of the split).
  const outletTiles: KpiTileProps[] = byOutlet.length > 0
    ? byOutlet.slice(0, 5).map((o) => ({
        label: o.outlet,
        value: Math.round(o.revenue),
        currency: 'USD' as const,
        size: 'sm' as const,
        footnote: `${formatInt(o.covers)} covers · ${formatUSD(o.avg_check)} avg check`,
        status: 'green' as const,
      }))
    : [{ label: 'No outlet data', value: 0, currency: 'USD' as const, size: 'sm' as const, status: 'grey' as const, footnote: 'last 30 days' }];

  // ListContainer columns for products.
  const productColumns: ListContainerColumn<OutletMixRow>[] = [
    { key: 'item',           label: 'Item',     sortable: true,  align: 'left' },
    { key: 'outlet',         label: 'Outlet',   sortable: true,  align: 'left' },
    { key: 'units_sold',     label: 'Units',    sortable: true,  align: 'right', searchable: false,
      render: (p) => formatInt(p.units_sold) },
    { key: 'revenue',        label: 'Revenue',  sortable: true,  align: 'right', searchable: false,
      render: (p) => formatUSD(p.revenue) },
    { key: 'avg_unit_price', label: 'Avg Price', sortable: true, align: 'right', searchable: false,
      render: (p) => formatUSD(p.avg_unit_price) },
  ];

  return (
    <DashboardPage
      title="F&B Outlets"
      subtitle={`${propertyName} · last 30 days · MTD ${monthLabel}${daysCovered === 0 ? ' · no rows yet' : ''}`}
    >
      <Container title="Month to date" subtitle="MTD snapshot" density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container title="Daily revenue by outlet" subtitle="Last 30 days · stacked">
        <Chart
          variant="stacked_bar"
          data={dailyByOutlet}
          xKey="revenue_date"
          series={outletSeries}
          height={260}
          empty={{ title: 'No outlet revenue rows', hint: 'v_outlet_revenue_daily returned 0 rows' }}
        />
      </Container>

      <Container title="Outlet contribution" subtitle="Share of revenue · last 30 days">
        <Chart
          variant="donut"
          data={donutData}
          xKey="name"
          series={[{ key: 'value', label: 'Revenue' }]}
          height={260}
          empty={{ title: 'No outlets yet' }}
        />
      </Container>

      <Container title="Outlet tiles" subtitle="Top 5 outlets · last 30 days">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {outletTiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <ListContainer<OutletMixRow>
        title={`Top products · ${monthLabel}`}
        subtitle={productCount > 0 ? `${productCount} products this month — top 5 preview` : 'no products this month'}
        data={topProducts}
        preview={5}
        rowKey={(p) => `${p.outlet}:${p.item}`}
        renderRow={(p) => (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'baseline', fontSize: 13 }}>
            <span style={{ fontWeight: 500 }}>
              {p.item} <span style={{ color: 'var(--ink-soft, #5A5A5A)', fontWeight: 400 }}>· {p.outlet}</span>
            </span>
            <span style={{ color: 'var(--ink-soft, #5A5A5A)', fontVariantNumeric: 'tabular-nums' }}>{formatInt(p.units_sold)}</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatUSD(p.revenue)}</span>
          </div>
        )}
        drawerColumns={productColumns}
        drawerSearchKeys={['item', 'outlet']}
        drawerDefaultSort={{ key: 'revenue', direction: 'desc' }}
        onRowClick={(p) => setDrillRow(p)}
        empty={{ title: 'No products this month', hint: 'v_outlet_product_mix_monthly returned 0 rows' }}
      />

      <Drawer
        open={drillRow !== null}
        onClose={() => setDrillRow(null)}
        title={drillRow ? drillRow.item : ''}
        subtitle={drillRow ? `${drillRow.outlet} · ${monthLabel}` : ''}
        width="md"
      >
        {drillRow && (
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px' }}>
            <Dt>Outlet</Dt>           <Dd>{drillRow.outlet}</Dd>
            <Dt>Units sold</Dt>       <Dd>{formatInt(drillRow.units_sold)}</Dd>
            <Dt>Revenue</Dt>          <Dd>{formatUSD(drillRow.revenue)}</Dd>
            <Dt>Avg unit price</Dt>   <Dd>{formatUSD(drillRow.avg_unit_price)}</Dd>
            <Dt>Checks</Dt>           <Dd>{formatInt(drillRow.check_count)}</Dd>
            <Dt>Avg check</Dt>        <Dd>{formatUSD(drillRow.avg_check)}</Dd>
            <Dt>Month</Dt>            <Dd>{drillRow.month}</Dd>
          </dl>
        )}
      </Drawer>
    </DashboardPage>
  );
}

function Dt({ children }: { children: React.ReactNode }) {
  return <dt style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>{children}</dt>;
}
function Dd({ children }: { children: React.ReactNode }) {
  return <dd style={{ margin: 0, fontSize: 13, color: 'var(--ink, #1B1B1B)', fontVariantNumeric: 'tabular-nums' }}>{children}</dd>;
}
