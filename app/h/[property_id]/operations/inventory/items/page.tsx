// app/h/[property_id]/operations/inventory/items/page.tsx
//
// Items — same source as Catalog (v_inv_stock_on_hand) but framed as an
// item explorer. Deep-linkable to /items/[item_id] via the dynamic route
// next to this page.

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

async function fetchSummary(propertyId: number) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_inv_stock_on_hand')
    .select('item_id, total_on_hand, value_usd_estimate, category_name')
    .eq('property_id', propertyId);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[inventory/items] v_inv_stock_on_hand', error);
    return { items: 0, unitsOnHand: 0, valueUsd: 0, categories: 0 };
  }
  const rows = data ?? [];
  return {
    items: rows.length,
    unitsOnHand: rows.reduce((a, r) => a + (Number(r.total_on_hand) || 0), 0),
    valueUsd: rows.reduce((a, r) => a + (Number(r.value_usd_estimate) || 0), 0),
    categories: new Set(rows.map((r) => r.category_name ?? '—')).size,
  };
}

export default async function ItemsPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory/items`);
  }

  const { items, unitsOnHand, valueUsd, categories } = await fetchSummary(propertyId);

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith('/inventory'),
  }));

  return (
    <DashboardPage title="Items" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow
          size="sm"
          tiles={[
            { label: 'Items catalogued',    value: fmtInt(items),        footnote: 'Rows in v_inv_stock_on_hand' },
            { label: 'Units on hand',       value: fmtInt(unitsOnHand),  footnote: unitsOnHand === 0 ? 'Opening counts pending' : 'Sum across items' },
            { label: 'Estimated value (USD)', value: fmtUsd(valueUsd),   footnote: unitsOnHand === 0 ? 'Populates once counts entered' : 'Sum of value_usd_estimate' },
            { label: 'Distinct categories', value: fmtInt(categories),   footnote: 'Distinct category_name' },
          ]}
        />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Item explorer" expandable={false}>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: '#1B1B1B' }}>
            {items === 0 ? (
              <>No items yet — the PMS product catalog uploads tomorrow.</>
            ) : (
              <>{fmtInt(items)} items across {fmtInt(categories)} categories. Individual item pages
              (with movement history, par status, supplier link) live at <code style={{ fontSize: 12 }}>/operations/inventory/items/&#123;item_id&#125;</code>.
              A searchable list lands in the next iteration — for now use the <strong>Catalog</strong>
              sub-tab for the full sortable table.</>
            )}
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
