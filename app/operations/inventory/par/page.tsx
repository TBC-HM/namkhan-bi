// app/operations/inventory/par/page.tsx
//
// Par levels — items below par + reorder $ value, by location.
// Source: inv.v_inv_par_status (joined to suppliers.suppliers for vendor name).

import Page from '@/components/page/Page';
import KpiBox from '@/components/kpi/KpiBox';
import { getParStatus } from '../_data';
import ParTableClient from './_ParTableClient';
import { OPERATIONS_SUBPAGES } from '../../_subpages';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function ParPage() {
  const rows = await getParStatus();

  // KPIs
  const belowPar = rows.filter((r) => ['below_par', 'below_min', 'out_of_stock'].includes(r.par_status)).length;
  const reorderTotal = rows
    .filter((r) => r.short_quantity != null && r.short_quantity > 0)
    .reduce((s, r) => s + (r.reorder_value_usd ?? 0), 0);
  const avgPctOfPar = rows.length === 0
    ? null
    : rows.reduce((s, r) => s + (r.pct_of_par ?? 0), 0) / rows.length;
  const overMax = rows.filter((r) => ['over_max', 'overstocked'].includes(r.par_status)).length;
  const totalRows = rows.length;

  return (
    <Page
      eyebrow="Operations · Inventory · Par levels"
      title={<>Par <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>discipline</em></>}
      subPages={OPERATIONS_SUBPAGES}
    >

      {/* KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 12,
        marginTop: 18,
      }}>
        <KpiBox value={belowPar} unit="count" label="Below par" tooltip="Items at or under reorder point in any location" />
        <KpiBox value={reorderTotal} unit="usd" label="Reorder $ value" tooltip="Sum of reorder_value_usd for items below par" />
        <KpiBox value={avgPctOfPar} unit="pct" label="Avg % of par" dp={0} tooltip="Mean of pct_of_par across all par-tracked rows" />
        <KpiBox value={overMax} unit="count" label="Over max" tooltip="Items above max — overstock candidates" />
        <KpiBox value={totalRows} unit="count" label="Par rules tracked" tooltip="Rows in inv.par_levels" />
      </div>

      <div style={{ marginTop: 22 }}>
        <ParTableClient rows={rows} />
      </div>
    </Page>
  );
}
