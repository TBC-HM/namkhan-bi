// app/operations/inventory/catalog/page.tsx
//
// Catalog Admin — manager/owner view of every item in inv.items.
// Header mounts <UploadProductsButton/> for CSV bulk upload. Rest of the
// page lists current SKUs joined to category/unit names so the operator
// can verify a fresh upload landed correctly.

import PageHeader from '@/components/layout/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fmtUSD, EMPTY } from '@/lib/format';
import UploadProductsButton from '../_components/UploadProductsButton';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

interface ItemRow {
  sku: string;
  item_name: string;
  category_code: string | null;
  category_name: string | null;
  unit_code: string | null;
  last_unit_cost_usd: number | null;
  gl_account_code: string | null;
  is_perishable: boolean;
  catalog_status: string;
  is_active: boolean;
  updated_at: string | null;
}

async function getItems(): Promise<ItemRow[]> {
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
  const [itemsRes, catsRes, unitsRes] = await Promise.all([
    admin.schema('inv').from('items').select(
      'sku, item_name, category_id, uom_id, last_unit_cost_usd, gl_account_code, is_perishable, catalog_status, is_active, updated_at'
    ).order('item_name', { ascending: true }).limit(500),
    admin.schema('inv').from('categories').select('category_id, code, name'),
    admin.schema('inv').from('units').select('unit_id, code'),
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

  return (itemsRes.data ?? []).map((r: any) => {
    const cat = catMap.get(r.category_id);
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
    };
  });
}

export default async function CatalogAdminPage() {
  const items = await getItems();

  const columns: Column<ItemRow>[] = [
    {
      key: 'sku',
      header: 'SKU',
      width: '140px',
      render: (r) => <span style={{ fontFamily: 'var(--mono)' }}>{r.sku}</span>,
      sortValue: (r) => r.sku,
    },
    {
      key: 'item_name',
      header: 'Item',
      render: (r) => r.item_name,
      sortValue: (r) => r.item_name,
    },
    {
      key: 'category',
      header: 'Category',
      width: '180px',
      render: (r) => r.category_code
        ? <span title={r.category_name ?? ''} style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{r.category_code}</span>
        : EMPTY,
      sortValue: (r) => r.category_code ?? '',
    },
    {
      key: 'unit',
      header: 'UoM',
      width: '70px',
      align: 'center',
      render: (r) => r.unit_code
        ? <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{r.unit_code}</span>
        : EMPTY,
      sortValue: (r) => r.unit_code ?? '',
    },
    {
      key: 'cost',
      header: 'Last cost',
      width: '110px',
      align: 'right',
      numeric: true,
      render: (r) => r.last_unit_cost_usd != null ? fmtUSD(r.last_unit_cost_usd) : EMPTY,
      sortValue: (r) => r.last_unit_cost_usd ?? -1,
    },
    {
      key: 'gl',
      header: 'GL acct',
      width: '110px',
      render: (r) => r.gl_account_code
        ? <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{r.gl_account_code}</span>
        : EMPTY,
    },
    {
      key: 'flags',
      header: 'Flags',
      width: '120px',
      render: (r) => (
        <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>
          {r.is_perishable ? 'perishable' : ''}{r.is_perishable && !r.is_active ? ' · ' : ''}{!r.is_active ? 'inactive' : ''}
          {!r.is_perishable && r.is_active ? EMPTY : null}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      align: 'center',
      render: (r) => (
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)',
          textTransform: 'uppercase',
          color: r.catalog_status === 'approved' ? 'var(--ok, #2f6f3a)' : 'var(--ink-soft)',
        }}>{r.catalog_status}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        pillar="Operations"
        tab="Inventory · Catalog"
        title={<>Item <em style={{ color: 'var(--brass)' }}>catalog</em></>}
        lede={<>Source of truth for every product the property buys, sells, or stocks. Bulk-load via CSV; rows with existing SKU are updated, new SKUs are inserted.</>}
        rightSlot={<UploadProductsButton />}
      />

      <div style={{ marginTop: 18 }}>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.sku}
          defaultSort={{ key: 'item_name', dir: 'asc' }}
          emptyState={
            <div style={{ padding: '36px 12px', textAlign: 'center', color: 'var(--ink-soft)' }}>
              <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-lg)' }}>
                No products yet.
              </div>
              <div style={{ marginTop: 6, fontSize: 'var(--t-sm)' }}>
                Click <strong>+ Upload products</strong> to bulk-load from a Cloudbeds export CSV.
              </div>
            </div>
          }
        />
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
