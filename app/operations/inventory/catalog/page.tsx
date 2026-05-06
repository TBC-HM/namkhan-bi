// app/operations/inventory/catalog/page.tsx
//
// Catalog Admin — manager/owner view of every item in inv.items.
// Header mounts <UploadProductsButton/> for CSV bulk upload. Rest of the
// page lists current SKUs joined to category/unit names so the operator
// can verify a fresh upload landed correctly.
//
// Server component fetches; client subcomponent renders the DataTable
// because column render/sortValue fns can't cross the server→client boundary.

import PageHeader from '@/components/layout/PageHeader';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import UploadProductsButton from '../_components/UploadProductsButton';
import SyncCloudbedsButton from '../_components/SyncCloudbedsButton';
import SyncPosterPosButton from '../_components/SyncPosterPosButton';
import CatalogTableClient, { type CatalogRow } from './_CatalogTableClient';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

async function getItems(): Promise<CatalogRow[]> {
  // Use service-role client because anon has no grants on inv.* tables.
  // Same model as /api/marketing/upload and /api/operations/inventory/items.
  // Dashboard is password-gated at the frontend per single-owner v1 model.
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[inventory/catalog] supabaseAdmin', e);
    return [];
  }
  const [itemsRes, catsRes, unitsRes, salesRes] = await Promise.all([
    admin.schema('inv').from('items').select(
      'sku, item_name, category_id, uom_id, last_unit_cost_usd, gl_account_code, is_perishable, catalog_status, is_active, updated_at'
    ).order('item_name', { ascending: true }).limit(2500),
    admin.schema('inv').from('categories').select('category_id, code, name'),
    admin.schema('inv').from('units').select('unit_id, code'),
    // Per-item sales aggregates from public.transactions (Cloudbeds/Poster POS feed).
    // View matches by lowercased trimmed description ↔ item_name.
    admin.from('v_inv_item_sales').select('desc_key, last_sold_at, ytd_usd'),
  ]);

  if (itemsRes.error) {
    // eslint-disable-next-line no-console
    console.error('[inventory/catalog] getItems items', itemsRes.error);
    return [];
  }
  const catMap = new Map<number, { code: string; name: string }>();
  (catsRes.data ?? []).forEach((c: any) => { catMap.set(c.category_id, { code: c.code, name: c.name }); });
  const unitMap = new Map<number, string>();
  (unitsRes.data ?? []).forEach((u: any) => { unitMap.set(u.unit_id, u.code); });
  const salesMap = new Map<string, { last_sold_at: string | null; ytd_usd: number | null }>();
  (salesRes.data ?? []).forEach((s: any) => {
    salesMap.set(s.desc_key, {
      last_sold_at: s.last_sold_at,
      ytd_usd: s.ytd_usd != null ? Number(s.ytd_usd) : null,
    });
  });

  return (itemsRes.data ?? []).map((r: any) => {
    const cat = catMap.get(r.category_id);
    const sale = salesMap.get(String(r.item_name ?? '').trim().toLowerCase());
    return {
      sku: r.sku,
      item_name: r.item_name,
      category_code: cat?.code ?? null,
      category_name: cat?.name ?? null,
      unit_code: unitMap.get(r.uom_id) ?? null,
      last_unit_cost_usd: r.last_unit_cost_usd != null ? Number(r.last_unit_cost_usd) : null,
      gl_account_code: r.gl_account_code,
      is_perishable: !!r.is_perishable,
      catalog_status: r.catalog_status,
      is_active: !!r.is_active,
      updated_at: r.updated_at,
      last_sold_at: sale?.last_sold_at ?? null,
      ytd_sales_usd: sale?.ytd_usd ?? null,
    };
  });
}

export default async function CatalogAdminPage() {
  const items = await getItems();

  return (
    <>
      <PageHeader
        pillar="Operations"
        tab="Inventory · Catalog"
        title={<>Item <em style={{ color: 'var(--brass)' }}>catalog</em></>}
        lede={<>Source of truth for every product the property buys, sells, or stocks. Bulk-load via CSV; rows with existing SKU are updated, new SKUs are inserted.</>}
        rightSlot={<><SyncPosterPosButton /><SyncCloudbedsButton /><UploadProductsButton /></>}
      />

      <div style={{ marginTop: 18 }}>
        <CatalogTableClient rows={items} />
      </div>

      <div style={{
        marginTop: 18,
        padding: '12px 14px',
        background: 'var(--paper-deep, #f6f3ec)',
        borderLeft: '2px solid var(--brass)',
        fontSize: 'var(--t-xs)',
        color: 'var(--ink-soft)',
        lineHeight: 1.6,
      }}>
        <div style={{
          fontFamily: 'var(--mono)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--ls-extra)',
          color: 'var(--brass)',
          fontSize: 'var(--t-xs)',
          marginBottom: 6,
        }}>Cloudbeds export → CSV</div>
        In Cloudbeds: <strong>Manage</strong> → <strong>Items</strong> → filter to &quot;products we sell&quot; → export CSV.
        Then map columns to: <code style={{ fontFamily: 'var(--mono)' }}>sku</code>,&nbsp;
        <code style={{ fontFamily: 'var(--mono)' }}>item_name</code>,&nbsp;
        <code style={{ fontFamily: 'var(--mono)' }}>category_code</code>&nbsp;(use codes shown in this table),&nbsp;
        <code style={{ fontFamily: 'var(--mono)' }}>unit_code</code>&nbsp;(default <code style={{ fontFamily: 'var(--mono)' }}>ea</code>),&nbsp;and any optional fields.
      </div>
    </>
  );
}
