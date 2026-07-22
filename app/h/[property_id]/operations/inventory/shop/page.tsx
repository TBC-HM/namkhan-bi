// app/h/[property_id]/operations/inventory/shop/page.tsx
//
// HOD Shop — browse catalog, add to cart, submit purchase request.
// The interactive cart / propose-new-item flow lives at the legacy
// /operations/inventory/shop route; this tenant mount gives the design
// system chrome + a summary. Full mobile-first cart lands in the next
// iteration on the new primitives.

import { redirect } from 'next/navigation';
import { DashboardPage, Container, MetricRow, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string } }

const fmtInt = (n: number): string => Math.round(Number(n) || 0).toLocaleString('en-US');

async function fetchCounts(propertyId: number) {
  const sb = getSupabaseAdmin();
  const [itemsRes, catsRes, locsRes] = await Promise.all([
    sb.from('v_inv_stock_on_hand').select('item_id, category_name', { count: 'exact', head: true }).eq('property_id', propertyId),
    sb.schema('inv').from('categories').select('category_id', { count: 'exact', head: true }),
    sb.schema('inv').from('locations').select('location_id', { count: 'exact', head: true }).eq('property_id', propertyId),
  ]);
  return {
    items: itemsRes.count ?? 0,
    categories: catsRes.count ?? 0,
    locations: locsRes.count ?? 0,
  };
}

export default async function ShopPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory/shop`);
  }

  const { items, categories, locations } = await fetchCounts(propertyId);

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith('/inventory'),
  }));

  return (
    <DashboardPage title="Shop · HOD request" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow
          size="sm"
          tiles={[
            { label: 'Items available',   value: fmtInt(items),      footnote: 'Rows in v_inv_stock_on_hand' },
            { label: 'Categories',        value: fmtInt(categories), footnote: 'Rows in inv.categories' },
            { label: 'Delivery locations', value: fmtInt(locations), footnote: 'Rows in inv.locations' },
            { label: 'Auto-approve cap',  value: '$500',             footnote: 'HOD requests under $500 auto-approve' },
          ]}
        />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Interactive shop pending redesign" expandable={false}>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: '#1B1B1B' }}>
            The cart-based HOD request flow (search, filter, add-to-cart, submit,
            propose-new-item) lives at the legacy <code style={{ fontSize: 12 }}>/operations/inventory/shop</code>
            route until the primitives (cart drawer, quantity stepper, propose-item modal)
            land in the design system. Once shipped this page mounts them directly.
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
