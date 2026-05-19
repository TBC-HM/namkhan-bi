// Merged F&B Outlets — full-parity scaffold for legacy /operations/restaurant.
// Single tree, both properties; live tiles render real data, "wire later"
// tiles render 0 + grey status + footnote pointing at the missing bridge.

'use client';

import { useState, type ReactNode } from 'react';
import {
  DashboardPage, Container, KpiTile, Chart, ListContainer, Drawer,
  type ChartSeries, type ListContainerColumn, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import type {
  OutletsSnapshot, OutletMixRow, MonthlyTrendRow, PnlMonthlyRow,
  TopSellerTrendRow, GlDetailRow, PosTxnRow,
} from '../lib/types';

const FALLBACK_OUTLET_COLORS = ['#1F3A2E', '#B8542A', '#B8A878', '#2E7D32', '#6E8B65', '#C8843E', '#5A5A5A', '#8FA585'];
const PENDING_FOOTNOTE = 'wire later';

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
function formatPct(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) return '0%';
  return `${n.toFixed(decimals)}%`;
}

// Helper: tile that ALWAYS shows '0' + grey + 'wire later'. Used for every
// metric whose source view isn't bridged yet. Wiring later = replace this
// call with a normal KpiTile.
function pending(label: string, footnoteExtra?: string): KpiTileProps {
  return {
    label,
    value: 0,
    size: 'sm',
    status: 'grey',
    footnote: footnoteExtra ? `${PENDING_FOOTNOTE} · ${footnoteExtra}` : PENDING_FOOTNOTE,
  };
}

export default function OutletsView({ snapshot, propertyName }: Props) {
  const {
    mtdRevenue, mtdCovers, mtdAvgCheck, topOutlet,
    byOutlet, dailyByOutlet, outletKeys, topProducts, productCount,
    daysCovered, monthLabel,
    foodRevMtd, bevRevMtd, minibarRevMtd,
    monthlyTrend, pnlMonthlyRollup, topSellerTrend, glDetail, posTransactions,
  } = snapshot;

  const [drillProduct, setDrillProduct] = useState<OutletMixRow | null>(null);

  // ─── ROW 1 · OPERATING SNAPSHOT (legacy parity) ──────────────────────────
  const operatingTiles: KpiTileProps[] = [
    pending('F&B / Occ Rn',           'needs mv_kpi_daily + outlet rev'),
    pending('Capture %',              'needs v_fnb_capture_daily'),
    { label: 'Food Rev',     value: Math.round(foodRevMtd),    currency: 'USD', size: 'sm',
      footnote: 'MTD · subdept=Food',  status: foodRevMtd > 0 ? 'green' : 'grey' },
    { label: 'Beverage Rev', value: Math.round(bevRevMtd),     currency: 'USD', size: 'sm',
      footnote: 'MTD · subdept=Beverage', status: bevRevMtd > 0 ? 'green' : 'grey' },
    pending('Staff Canteen $',        'needs v_staff_canteen_monthly'),
    pending('Canteen / Occ',          'derived from canteen view'),
  ];

  // ─── ROW 2 · USALI EFFECTIVE VIEW (legacy parity) ────────────────────────
  const usaliTiles: KpiTileProps[] = [
    pending('Breakfast alloc',  'needs v_breakfast_allocation_monthly'),
    pending('Effective F&B Rev','derived: F&B + breakfast'),
    pending('Effective GOP $',  'needs v_dept_pl_monthly'),
    pending('Effective GOP %',  'target ≥ 25%'),
    pending('Eff Labor %',      'target ≤ 35%'),
    pending('Eff Food %',       'target ≤ 30%'),
  ];

  // ─── ROW 3 · OUTLET HEADLINE (already wired) ─────────────────────────────
  const outletHeadline: KpiTileProps[] = [
    { label: 'MTD F&B Revenue', value: Math.round(mtdRevenue), currency: 'USD', size: 'sm',
      footnote: monthLabel,   status: mtdRevenue > 0 ? 'green' : 'grey' },
    { label: 'MTD Covers',      value: mtdCovers, size: 'sm',
      footnote: 'reservation-distinct', status: mtdCovers > 0 ? 'green' : 'grey' },
    { label: 'Avg Check',       value: Math.round(mtdAvgCheck), currency: 'USD', size: 'sm',
      footnote: 'MTD revenue ÷ covers', status: mtdAvgCheck > 0 ? 'green' : 'grey' },
    { label: 'Top Outlet',
      value: topOutlet ? topOutlet.name : '—',
      size: 'sm',
      footnote: topOutlet ? `${formatUSD(topOutlet.revenue)} · last 30d` : 'no outlet revenue yet',
      status: topOutlet ? 'green' : 'grey' },
  ];

  // ─── outlet series + donut data (wired) ─────────────────────────────────
  const outletSeries: ChartSeries[] = outletKeys.length > 0
    ? outletKeys.map((k, i) => ({ key: k, label: k, color: FALLBACK_OUTLET_COLORS[i % FALLBACK_OUTLET_COLORS.length] }))
    : [{ key: 'total', label: 'No outlets', color: '#8A8A8A' }];
  const donutData = byOutlet.length > 0
    ? byOutlet.map((o) => ({ name: o.outlet, value: Math.round(o.revenue) }))
    : [];

  const outletTiles: KpiTileProps[] = byOutlet.length > 0
    ? byOutlet.slice(0, 5).map((o) => ({
        label: o.outlet,
        value: Math.round(o.revenue),
        currency: 'USD' as const,
        size: 'sm' as const,
        footnote: `${formatInt(o.covers)} covers · ${formatUSD(o.avg_check)} avg check`,
        status: 'green' as const,
      }))
    : [pending('No outlet data', 'last 30 days')];

  // ─── product list columns ───────────────────────────────────────────────
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

  // ─── pending list columns (typed empty arrays so wiring is trivial) ─────
  const pnlColumns: ListContainerColumn<PnlMonthlyRow>[] = [
    { key: 'month',         label: 'Month',  align: 'left'  },
    { key: 'revenue',       label: 'Rev',    align: 'right', render: (r) => formatUSD(r.revenue) },
    { key: 'food_cost_pct', label: 'Food %', align: 'right', render: (r) => formatPct(r.food_cost_pct) },
    { key: 'bev_cost_pct',  label: 'Bev %',  align: 'right', render: (r) => formatPct(r.bev_cost_pct) },
    { key: 'labor_cost_pct',label: 'Labor %',align: 'right', render: (r) => formatPct(r.labor_cost_pct) },
    { key: 'gop_pct',       label: 'GOP %',  align: 'right', render: (r) => formatPct(r.gop_pct) },
  ];
  const glColumns: ListContainerColumn<GlDetailRow>[] = [
    { key: 'month',   label: 'Month',   align: 'left'  },
    { key: 'account', label: 'Account', align: 'left',  sortable: true },
    { key: 'amount',  label: 'Amount',  align: 'right', sortable: true, render: (r) => formatUSD(r.amount) },
  ];
  const posColumns: ListContainerColumn<PosTxnRow>[] = [
    { key: 'txn_at', label: 'When',   align: 'left',  sortable: true },
    { key: 'outlet', label: 'Outlet', align: 'left',  sortable: true },
    { key: 'item',   label: 'Item',   align: 'left',  sortable: true },
    { key: 'qty',    label: 'Qty',    align: 'right', sortable: true },
    { key: 'amount', label: 'Amount', align: 'right', sortable: true, render: (r) => formatUSD(r.amount) },
  ];

  return (
    <DashboardPage
      title="F&B Outlets"
      subtitle={`${propertyName} · last 30 days · MTD ${monthLabel}${daysCovered === 0 ? ' · no rows yet' : ''}`}
    >
      <Container title="Operating snapshot" subtitle={monthLabel} density="compact">
        <TileGrid tiles={operatingTiles} />
      </Container>

      <Container title="USALI Effective view" subtitle="targets in legacy footnotes; awaiting v_dept_pl_monthly bridge" density="compact">
        <TileGrid tiles={usaliTiles} />
      </Container>

      <Container title="Outlet headline · MTD" subtitle="from v_outlet_revenue_daily" density="compact">
        <TileGrid tiles={outletHeadline} />
      </Container>

      <Container title="Staff canteen" subtitle="employee meal + canteen materials">
        <ExplainerBody pending="needs v_staff_canteen_monthly">
          <Big>{formatUSD(snapshot.staffCanteenUsd)}</Big>
          <Body>EMPLOYEE MEAL + STAFF CANTEEN MATERIALS across all depts. By-dept breakdown lands when the canteen view bridges.</Body>
        </ExplainerBody>
      </Container>

      <Container title="Breakfast allocation · USALI" subtitle="rooms → f&b">
        <ExplainerBody pending="needs v_breakfast_allocation_monthly">
          <Big>{formatUSD(snapshot.breakfastAllocUsd)}</Big>
          <Body>pax-nights × $10/adult + $5/child (USALI fair value). Monthly QB JE: <code>DR Rooms Rev · CR Food Rev</code> — zero P&L impact, USALI-clean.</Body>
        </ExplainerBody>
      </Container>

      <Container title="Menu engineering" subtitle="coming soon">
        <ExplainerBody pending="needs inv.recipes (not ingested)">
          <Body>Stars · Plowhorses · Puzzles · Dogs. Each dish on popularity × profitability. Needs POS qty + recipe sheets in inv.recipes.</Body>
        </ExplainerBody>
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

      <Container title="Monthly trend · rev · costs · GOP%" subtitle={`wire later · needs v_dept_pl_monthly`}>
        <Chart
          variant="combo"
          data={monthlyTrend as unknown as Record<string, unknown>[]}
          xKey="month"
          series={[
            { key: 'revenue',    label: 'Revenue',    type: 'bar',  color: '#1F3A2E' },
            { key: 'total_cost', label: 'Total cost', type: 'bar',  color: '#B8542A' },
            { key: 'gop_pct',    label: 'GOP %',      type: 'line', color: '#2E7D32' },
          ]}
          height={240}
          empty={{ title: 'Monthly P&L not yet bridged', hint: 'v_dept_pl_monthly is in the next bridge batch' }}
        />
      </Container>

      <Container title="Outlet tiles · top 5" subtitle="last 30 days">
        <TileGrid tiles={outletTiles} minTile={200} />
      </Container>

      <Container title="P&L · USALI monthly rollup" subtitle={`wire later · needs v_dept_pl_monthly`}>
        <ListContainer<PnlMonthlyRow>
          title=""
          data={pnlMonthlyRollup}
          preview={5}
          rowKey={(r) => r.month}
          renderRow={(r) => (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, fontSize: 13 }}>
              <span>{r.month}</span>
              <span style={{ fontWeight: 600 }}>{formatUSD(r.revenue)}</span>
              <span style={{ color: 'var(--ink-soft, #5A5A5A)' }}>GOP {formatPct(r.gop_pct)}</span>
              <span style={{ color: 'var(--ink-soft, #5A5A5A)' }}>Labor {formatPct(r.labor_cost_pct)}</span>
            </div>
          )}
          drawerColumns={pnlColumns}
          drawerSearchKeys={['month']}
          drawerDefaultSort={{ key: 'month', direction: 'desc' }}
          empty={{ title: 'No monthly P&L rows', hint: 'v_dept_pl_monthly is in the next bridge batch' }}
        />
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
        onRowClick={(p) => setDrillProduct(p)}
        empty={{ title: 'No products this month', hint: 'v_outlet_product_mix_monthly returned 0 rows' }}
      />

      <Container title="Top sellers · trend since Jan" subtitle={`wire later · needs v_fnb_top_seller_trend_monthly`}>
        <Chart
          variant="line"
          data={topSellerTrend as unknown as Record<string, unknown>[]}
          xKey="month"
          series={[{ key: 'revenue', label: 'Revenue', color: '#1F3A2E' }]}
          height={220}
          empty={{ title: 'Top-seller trend not yet bridged' }}
        />
      </Container>

      <ListContainer<GlDetailRow>
        title="GL detail · F&B accounts"
        subtitle={`wire later · needs v_fnb_gl_breakdown_monthly`}
        data={glDetail}
        preview={5}
        rowKey={(r) => `${r.month}:${r.account}`}
        renderRow={(r) => (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 12, fontSize: 12 }}>
            <span style={{ color: 'var(--ink-soft, #5A5A5A)' }}>{r.month}</span>
            <span>{r.account}</span>
            <span style={{ fontWeight: 600 }}>{formatUSD(r.amount)}</span>
          </div>
        )}
        drawerColumns={glColumns}
        drawerSearchKeys={['account']}
        drawerDefaultSort={{ key: 'amount', direction: 'desc' }}
        empty={{ title: 'No GL rows yet' }}
      />

      <ListContainer<PosTxnRow>
        title="Raw POS transactions"
        subtitle={`wire later · needs v_fnb_pos_transactions`}
        data={posTransactions}
        preview={5}
        rowKey={(r) => `${r.txn_at}:${r.item}`}
        renderRow={(r) => (
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 12, fontSize: 12 }}>
            <span style={{ color: 'var(--ink-soft, #5A5A5A)' }}>{r.txn_at}</span>
            <span>{r.item} <span style={{ color: 'var(--ink-soft, #5A5A5A)' }}>· {r.outlet}</span></span>
            <span style={{ color: 'var(--ink-soft, #5A5A5A)' }}>×{r.qty}</span>
            <span style={{ fontWeight: 600 }}>{formatUSD(r.amount)}</span>
          </div>
        )}
        drawerColumns={posColumns}
        drawerSearchKeys={['item', 'outlet']}
        drawerDefaultSort={{ key: 'txn_at', direction: 'desc' }}
        empty={{ title: 'No POS transactions yet' }}
      />

      <Drawer
        open={drillProduct !== null}
        onClose={() => setDrillProduct(null)}
        title={drillProduct ? drillProduct.item : ''}
        subtitle={drillProduct ? `${drillProduct.outlet} · ${monthLabel}` : ''}
        width="md"
      >
        {drillProduct && (
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px' }}>
            <Dt>Outlet</Dt>           <Dd>{drillProduct.outlet}</Dd>
            <Dt>Units sold</Dt>       <Dd>{formatInt(drillProduct.units_sold)}</Dd>
            <Dt>Revenue</Dt>          <Dd>{formatUSD(drillProduct.revenue)}</Dd>
            <Dt>Avg unit price</Dt>   <Dd>{formatUSD(drillProduct.avg_unit_price)}</Dd>
            <Dt>Checks</Dt>           <Dd>{formatInt(drillProduct.check_count)}</Dd>
            <Dt>Avg check</Dt>        <Dd>{formatUSD(drillProduct.avg_check)}</Dd>
            <Dt>Month</Dt>            <Dd>{drillProduct.month}</Dd>
          </dl>
        )}
      </Drawer>
    </DashboardPage>
  );
}

function TileGrid({ tiles, minTile = 170 }: { tiles: KpiTileProps[]; minTile?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${minTile}px, 1fr))`, gap: 12 }}>
      {tiles.map((t, i) => <KpiTile key={`${t.label}-${i}`} {...t} />)}
    </div>
  );
}

function ExplainerBody({ pending, children }: { pending: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {children}
      <div style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {PENDING_FOOTNOTE} · {pending}
      </div>
    </div>
  );
}
function Big({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--ink, #1B1B1B)', fontVariantNumeric: 'tabular-nums' }}>{children}</div>;
}
function Body({ children }: { children: ReactNode }) {
  return <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft, #5A5A5A)', lineHeight: 1.45 }}>{children}</p>;
}
function Dt({ children }: { children: ReactNode }) {
  return <dt style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>{children}</dt>;
}
function Dd({ children }: { children: ReactNode }) {
  return <dd style={{ margin: 0, fontSize: 13, color: 'var(--ink, #1B1B1B)', fontVariantNumeric: 'tabular-nums' }}>{children}</dd>;
}

// Lint: imported types intentionally referenced via Generic<T> on ListContainer.
type _Unused = MonthlyTrendRow;
