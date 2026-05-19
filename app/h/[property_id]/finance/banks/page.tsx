// app/h/[property_id]/finance/banks/page.tsx
// 2026-05-19 refactor onto @/app/(cockpit)/_design primitives.
// Data fetches UNCHANGED. Coverage matrix → heatmap (bespoke expandable
// component deferred until ExpandableTable primitive lands).

import { notFound } from 'next/navigation';
import {
  DashboardPage, Container, KpiTile, Chart,
  type ChartSeries, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { getBanksCfoView, type CoverageCell } from '@/lib/data-banks-cfo';
import { fmtMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_LABEL: Record<number, string> = { 260955: 'Namkhan', 1000001: 'Donna' };

function fmtInt(n: number): string { return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—'; }

export default async function PropertyFinanceBanksPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  if (!KNOWN_LABEL[propertyId]) notFound();
  const propertyLabel = KNOWN_LABEL[propertyId];
  const isDonna = propertyId === 1000001;

  const v = await getBanksCfoView(propertyId);

  // KPIs
  const tiles: KpiTileProps[] = [
    {
      label: isDonna ? 'Total cash · EUR-eq' : 'Total cash · USD-eq',
      value: isDonna
        ? `€${(v.totalCashUsd / 1.08).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
        : fmtMoney(v.totalCashUsd, 'USD'),
      size: 'sm',
      status: v.totalCashUsd > 0 ? 'green' : 'grey',
    },
    { label: 'Accounts', value: v.balances.length, size: 'sm', status: v.balances.length > 0 ? 'green' : 'grey' },
    { label: 'Data coverage', value: `${v.coverageStats.coverage_pct}%`, size: 'sm',
      status: v.coverageStats.coverage_pct >= 95 ? 'green' : v.coverageStats.coverage_pct >= 80 ? 'amber' : 'red' },
    { label: 'Missing months', value: v.coverageStats.cells_missing, size: 'sm',
      status: v.coverageStats.cells_missing === 0 ? 'green' : 'amber' },
    { label: 'Txns · 2025+', value: fmtInt(v.monthlyFlow.reduce((s, r) => s + Number(r.txn_count || 0), 0)), size: 'sm',
      status: 'green' },
  ];

  // Accounts table
  const accountRows = v.balances.map((b) => ({
    account: b.account_label,
    bank:    b.bank_name,
    currency: b.currency,
    txns:    fmtInt(Number(b.n_txn || 0)),
    movement: b.currency === 'EUR' ? `€${fmtInt(Number(b.movement_native || 0))}`
            : b.currency === 'LAK' ? `₭${fmtInt(Number(b.movement_native || 0))}`
            : `$${fmtInt(Number(b.movement_native || 0))}`,
    balance: isDonna
      ? `€${(Number(b.balance_usd || 0) / 1.08).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      : `$${fmtInt(Number(b.balance_usd || 0))}`,
    last_txn: b.last_txn_date ?? '—',
  }));

  // Coverage heatmap (account × month, value = 1 if has_data else 0)
  const heatmap = (v.coverage as CoverageCell[]).map((c) => ({
    account: `${c.account_id} · ${c.currency}`,
    month:   c.period_yyyymm,
    has:     c.has_data ? 1 : 0,
  }));
  const monthsCount = new Set(heatmap.map((h) => h.month)).size;

  // Counterparties table
  const counterpartyRows = v.topCounterparties.slice(0, 10).map((cp) => ({
    counterparty: cp.counterparty,
    category:     cp.category,
    txns:         cp.txn_count,
    inflow:       fmtMoney(Number(cp.inflow_usd || 0), 'USD'),
    outflow:      fmtMoney(Math.abs(Number(cp.outflow_usd || 0)), 'USD'),
    net:          fmtMoney(Number(cp.net_usd || 0), 'USD'),
  }));

  const accountCols: ChartSeries[] = [
    { key: 'bank',     label: 'Bank' },
    { key: 'currency', label: 'Curr' },
    { key: 'txns',     label: 'Txns' },
    { key: 'movement', label: 'Movement (native)' },
    { key: 'balance',  label: isDonna ? 'Balance · EUR-eq' : 'Balance · USD-eq' },
    { key: 'last_txn', label: 'Last txn' },
  ];
  const counterpartyCols: ChartSeries[] = [
    { key: 'category', label: 'Category' },
    { key: 'txns',     label: 'Txns' },
    { key: 'inflow',   label: 'Inflow USD' },
    { key: 'outflow',  label: 'Outflow USD' },
    { key: 'net',      label: 'Net USD' },
  ];

  return (
    <DashboardPage
      title={`Finance · Banks · ${propertyLabel}`}
      subtitle={`live balance · v_bank_* · ${v.balances.length} account${v.balances.length === 1 ? '' : 's'}`}
    >
      <Container title="Bank headline" subtitle={propertyLabel} density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      <Container title="Accounts" subtitle={`${v.balances.length} account${v.balances.length === 1 ? '' : 's'}`}>
        <Chart variant="table" data={accountRows} xKey="account" series={accountCols}
          empty={{ title: 'No accounts' }} />
      </Container>

      <Container title="Data coverage" subtitle={`${v.coverageStats.cells_missing} of ${v.coverageStats.cells_total} account-months missing · 2025-01 → today`}>
        <Chart variant="heatmap" data={heatmap} xKey="month" yKey="account"
          series={[{ key: 'has', label: 'Has data (0/1)' }]}
          height={Math.max(180, Math.min(560, new Set(heatmap.map((h) => h.account)).size * 36))}
          empty={{ title: 'No coverage data', hint: `${monthsCount} months scanned` }}
        />
      </Container>

      {counterpartyRows.length > 0 && (
        <Container title="Top counterparties · 2025+" subtitle="ranked by inflow">
          <Chart variant="table" data={counterpartyRows} xKey="counterparty" series={counterpartyCols}
            empty={{ title: 'No counterparties' }} />
        </Container>
      )}
    </DashboardPage>
  );
}
