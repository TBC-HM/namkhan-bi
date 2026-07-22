// app/h/[property_id]/operations/inventory/stock/page.tsx
//
// Stock health — same v_inv_stock_on_hand source as Catalog, framed as
// health monitoring (days-of-cover, slow movers, expiring). Detailed
// tables land once movements arrive; today only totals are meaningful.

import { redirect } from 'next/navigation';
import { DashboardPage, Container, MetricRow, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string } }

const fmtInt = (n: number): string => Math.round(Number(n) || 0).toLocaleString('en-US');
const fmtUsd = (n: number): string => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

async function fetchStockSummary(propertyId: number) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_inv_stock_on_hand')
    .select('total_on_hand, value_usd_estimate, locations_with_stock')
    .eq('property_id', propertyId);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[inventory/stock] v_inv_stock_on_hand', error);
    return { items: 0, unitsOnHand: 0, valueUsd: 0, itemsWithStock: 0 };
  }
  const rows = data ?? [];
  return {
    items: rows.length,
    unitsOnHand: rows.reduce((a, r) => a + (Number(r.total_on_hand) || 0), 0),
    valueUsd: rows.reduce((a, r) => a + (Number(r.value_usd_estimate) || 0), 0),
    itemsWithStock: rows.filter((r) => Number(r.locations_with_stock) > 0).length,
  };
}

export default async function StockPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory/stock`);
  }

  const { items, unitsOnHand, valueUsd, itemsWithStock } = await fetchStockSummary(propertyId);
  const zero = unitsOnHand === 0;

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith('/inventory'),
  }));

  return (
    <DashboardPage title="Stock health" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow
          size="sm"
          tiles={[
            { label: 'Inv on hand (USD)', value: fmtUsd(valueUsd),       footnote: `${fmtInt(itemsWithStock)} items with positive on-hand` },
            { label: 'Active SKUs',       value: fmtInt(itemsWithStock), footnote: 'Items in >=1 location' },
            { label: 'Median days of cover', value: 'N/A',              footnote: zero ? 'No movements recorded yet' : 'Needs consumption history' },
            { label: 'Total items',       value: fmtInt(items),          footnote: 'Rows in v_inv_stock_on_hand' },
          ]}
        />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={zero ? 'Stock health pending consumption data' : 'Stock health'} expandable={false}>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: '#1B1B1B' }}>
            {zero
              ? <>All items currently at zero on-hand — opening counts land tomorrow. Once counts and
                movements accumulate, this page shows days-of-cover, slow movers (&gt;60d idle) and
                expiring batches (&le;30d).</>
              : <>Full days-of-cover / slow-mover / expiring tables land in the next iteration; the totals
                above are live from v_inv_stock_on_hand.</>
            }
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
