// app/operations/inventory/stock/page.tsx
//
// Stock — on-hand · days of cover · slow movers · expiring.
// Server component reads from inv.v_inv_stock_on_hand / v_inv_days_of_cover
// / v_inv_slow_movers / v_inv_expiring_soon via service-role client.

import Page from '@/components/page/Page';
import { OPERATIONS_SUBPAGES } from '../../_subpages';
import KpiBox from '@/components/kpi/KpiBox';
import {
  getStockOnHand,
  getDaysOfCover,
  getSlowMovers,
  getExpiringSoon,
} from '../_data';
import {
  StockOnHandTable,
  DaysOfCoverTable,
  SlowMoversTable,
  ExpiringTable,
} from './_StockTablesClient';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const sectionH: React.CSSProperties = {
  marginTop: 28,
  marginBottom: 10,
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  color: 'var(--brass)',
};

export default async function StockPage() {
  const [onHand, doc, slow, expiring] = await Promise.all([
    getStockOnHand(),
    getDaysOfCover(),
    getSlowMovers(),
    getExpiringSoon(),
  ]);

  // KPI math
  const totalValue = onHand.reduce((s, r) => s + (r.value_usd_estimate ?? 0), 0);
  const skusOnHand = onHand.filter((r) => r.total_on_hand > 0).length;
  // median days-of-cover (excluding nulls and infinities)
  const docVals = doc
    .map((r) => r.days_of_cover)
    .filter((v): v is number => v != null && Number.isFinite(v) && v < 999)
    .sort((a, b) => a - b);
  const medianDoc = docVals.length === 0
    ? null
    : docVals.length % 2 === 0
      ? (docVals[docVals.length / 2 - 1] + docVals[docVals.length / 2]) / 2
      : docVals[Math.floor(docVals.length / 2)];
  const slowMoverValue = slow.reduce((s, r) => s + (r.value_usd_estimate ?? 0), 0);
  const expiring14 = expiring.filter((e) => e.days_until_expiry != null && e.days_until_expiry <= 14).length;
  const atRiskValue = expiring.reduce((s, r) => s + (r.at_risk_value_usd ?? 0), 0);

  return (
    <Page
      eyebrow="Operations · Inventory · Stock"
      title={<>Stock <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>health</em></>}
      subPages={OPERATIONS_SUBPAGES}
    >

      {/* KPI strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 12,
        marginTop: 18,
      }}>
        <KpiBox value={totalValue} unit="usd" label="Inv on hand" tooltip={`${skusOnHand} SKUs with positive on-hand`} />
        <KpiBox value={skusOnHand} unit="count" label="Active SKUs" tooltip="SKUs with quantity > 0 in any location" />
        <KpiBox value={medianDoc} unit="d" label="Median days of cover" tooltip="Median across SKUs that have both burn rate and stock; excludes ∞" state={medianDoc == null ? 'data-needed' : 'live'} needs={medianDoc == null ? 'inv.movements (no consumption recorded yet)' : undefined} />
        <KpiBox value={slow.length} unit="count" label="Slow movers" tooltip={`Tied-up $${Math.round(slowMoverValue / 1000)}k · no movement >60d, qty > 0`} />
        <KpiBox value={null} unit="count" label="Expiring ≤14d" valueText="xx" tooltip="Not wired — no movements have batch_code / expiry_date set yet. Source: inv.v_inv_expiring_soon (0 rows)." />
      </div>

      {/* Stock on hand */}
      <h2 style={sectionH}>Stock on hand · {onHand.length} SKUs · sorted by value</h2>
      <StockOnHandTable rows={onHand} />

      {/* Days of cover */}
      <h2 style={sectionH}>Days of cover · sorted by lowest first</h2>
      <DaysOfCoverTable rows={doc} />

      {/* Slow movers */}
      <h2 style={sectionH}>Slow movers · 90d window · qty &gt; 0 · sorted by tied-up $</h2>
      <SlowMoversTable rows={slow} />

      {/* Expiring soon */}
      <h2 style={sectionH}>Expiring within 30 days · {expiring.length} batches</h2>
      <ExpiringTable rows={expiring} />
    </Page>
  );
}
