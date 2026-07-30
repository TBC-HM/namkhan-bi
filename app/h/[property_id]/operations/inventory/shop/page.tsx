// app/h/[property_id]/operations/inventory/shop/page.tsx
//
// HOD Shop — browse catalog, add to cart, submit purchase request.
// Interactive flow revived 2026-07-30 (inventory completion brief): the
// orphaned legacy cart components (ShopCart, ProposeNewItemButton) are
// mounted here directly with a tenant-scoped basePath; the product grid is
// the new ShopCatalog client island. Auto-approve cap reads from
// procurement.config (seeded $500), no longer hardcoded.

import { redirect } from 'next/navigation';
import { DashboardPage, Container, MetricRow, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import ShopCart from '@/app/operations/inventory/_components/ShopCart';
import ProposeNewItemButton from '@/app/operations/inventory/_components/ProposeNewItemButton';
import ShopCatalog, { type ShopItem } from './ShopCatalog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string } }

const fmtInt = (n: number): string => Math.round(Number(n) || 0).toLocaleString('en-US');

interface ItemRaw {
  item_id: string;
  sku: string | null;
  item_name: string;
  last_unit_cost_usd: number | null;
  categories: { name: string | null } | null;
  units: { code: string | null } | null;
}

async function fetchShopData(propertyId: number) {
  const sb = getSupabaseAdmin();
  const [itemsRes, catsRes, unitsRes, locsRes, cfgRes] = await Promise.all([
    sb.schema('inv').from('items')
      .select('item_id, sku, item_name, last_unit_cost_usd, categories:category_id(name), units:uom_id(code)')
      .eq('property_id', propertyId)
      .eq('catalog_status', 'approved')
      .eq('is_active', true)
      .order('item_name')
      .limit(3000),
    sb.schema('inv').from('categories').select('category_id, name').eq('is_active', true).order('name'),
    sb.schema('inv').from('units').select('unit_id, code, name').eq('is_active', true).order('name'),
    sb.schema('inv').from('locations').select('location_id, location_name').eq('property_id', propertyId).eq('is_active', true).order('location_name'),
    sb.schema('procurement').from('config').select('auto_approve_under_usd').eq('property_id', propertyId).maybeSingle(),
  ]);

  const items: ShopItem[] = ((itemsRes.data ?? []) as unknown as ItemRaw[]).map((r) => ({
    item_id: String(r.item_id),
    sku: String(r.sku ?? ''),
    item_name: String(r.item_name ?? ''),
    category_name: String(r.categories?.name ?? ''),
    unit_code: String(r.units?.code ?? ''),
    unit_cost_usd: r.last_unit_cost_usd != null ? Number(r.last_unit_cost_usd) : null,
  }));
  const categories = (catsRes.data ?? []).map((c: Record<string, unknown>) => ({ category_id: Number(c.category_id), name: String(c.name) }));
  const units = (unitsRes.data ?? []).map((u: Record<string, unknown>) => ({ unit_id: Number(u.unit_id), code: String(u.code ?? ''), name: String(u.name ?? '') }));
  const locations = (locsRes.data ?? []).map((l: Record<string, unknown>) => ({ location_id: Number(l.location_id), location_name: String(l.location_name) }));
  const cap = Number((cfgRes.data as Record<string, unknown> | null)?.auto_approve_under_usd ?? 500);

  return { items, categories, units, locations, cap };
}

export default async function ShopPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory/shop`);
  }

  const { items, categories, units, locations, cap } = await fetchShopData(propertyId);
  const basePath = `/h/${propertyId}/operations/inventory`;

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
            { label: 'Items available',    value: fmtInt(items.length),      footnote: 'Approved + active catalog items' },
            { label: 'Categories',         value: fmtInt(categories.length), footnote: 'Rows in inv.categories' },
            { label: 'Delivery locations', value: fmtInt(locations.length),  footnote: 'Rows in inv.locations' },
            { label: 'Auto-approve cap',   value: `$${fmtInt(cap)}`,         footnote: 'procurement.config · under this auto-approves' },
          ]}
        />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Catalog — add items to your request" expandable={false}>
          <ShopCatalog items={items} />
        </Container>
      </div>

      {/* Cart drawer + propose-new-item modal (client islands) */}
      <ShopCart locations={locations} basePath={basePath} autoApproveCap={cap} />
      <ProposeNewItemButton categories={categories} units={units} suppliers={[]} />
    </DashboardPage>
  );
}
