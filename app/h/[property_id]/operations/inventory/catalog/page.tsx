// app/h/[property_id]/operations/inventory/catalog/page.tsx
//
// Item catalog — 602 approved items (1,381 dishes/services deprecated 2026-07-24).
// Renders MetricRow + AddItemForm + ListContainer.
// PBS 2026-07-24: added AddItemForm so staff can enter non-POS supply items
// (maintenance, housekeeping, eco farm, activities, spa) directly from the UI.

import { redirect } from 'next/navigation';
import { DashboardPage, Container, MetricRow, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import CatalogList, { type CatalogItemRow } from './CatalogList';
import AddItemForm, { type DropdownOption } from './AddItemForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string } }

const fmtInt = (n: number): string => Math.round(Number(n) || 0).toLocaleString('en-US');
const fmtUsd = (n: number): string => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

interface StockRaw {
  item_id: string;
  sku: string | null;
  item_name: string;
  category_name: string | null;
  total_on_hand: number;
  value_usd_estimate: number;
  last_movement_at: string | null;
}

async function fetchFormOptions() {
  const sb = getSupabaseAdmin();
  const [catsRes, unitsRes, locsRes] = await Promise.all([
    sb.schema('inv').from('categories').select('category_id, name').eq('is_active', true).order('name'),
    sb.schema('inv').from('units').select('unit_id, name, code').eq('is_active', true).order('name'),
    sb.schema('inv').from('locations').select('location_id, location_name').eq('is_active', true).order('location_name'),
  ]);
  const categories: DropdownOption[] = (catsRes.data ?? []).map((r: Record<string,unknown>) => ({ id: Number(r.category_id), name: String(r.name) }));
  const units: DropdownOption[] = (unitsRes.data ?? []).map((r: Record<string,unknown>) => ({ id: Number(r.unit_id), name: String(r.name), code: String(r.code ?? '') }));
  const locations: DropdownOption[] = (locsRes.data ?? []).map((r: Record<string,unknown>) => ({ id: Number(r.location_id), name: String(r.location_name) }));
  return { categories, units, locations };
}

async function fetchCatalog(propertyId: number): Promise<StockRaw[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_inv_stock_on_hand')
    .select('item_id, sku, item_name, category_name, total_on_hand, value_usd_estimate, last_movement_at')
    .eq('property_id', propertyId)
    .order('item_name', { ascending: true });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[inventory/catalog] v_inv_stock_on_hand', error);
    return [];
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    item_id: String(r.item_id ?? ''),
    sku: (r.sku as string | null) ?? null,
    item_name: String(r.item_name ?? ''),
    category_name: (r.category_name as string | null) ?? null,
    total_on_hand: Number(r.total_on_hand ?? 0),
    value_usd_estimate: Number(r.value_usd_estimate ?? 0),
    last_movement_at: (r.last_movement_at as string | null) ?? null,
  }));
}

export default async function CatalogPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory/catalog`);
  }

  const [raw, formOptions] = await Promise.all([fetchCatalog(propertyId), fetchFormOptions()]);
  const rows: CatalogItemRow[] = raw.map((r) => ({
    item_id: r.item_id,
    sku: r.sku ?? '—',
    item_name: r.item_name,
    category_name: r.category_name ?? '—',
    on_hand: fmtInt(r.total_on_hand),
    value_usd: fmtUsd(r.value_usd_estimate),
    last_movement: fmtDate(r.last_movement_at),
  }));

  const itemCount = rows.length;
  const unitsOnHand = raw.reduce((a, r) => a + (r.total_on_hand || 0), 0);
  const valueUsd = raw.reduce((a, r) => a + (r.value_usd_estimate || 0), 0);
  const categories = new Set(raw.map((r) => r.category_name ?? '—')).size;

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith('/inventory'),
  }));

  return (
    <DashboardPage title="Item catalog" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow
          size="sm"
          tiles={[
            { label: 'Items in catalog',    value: fmtInt(itemCount),    footnote: 'Rows in v_inv_stock_on_hand' },
            { label: 'Units on hand',       value: fmtInt(unitsOnHand),  footnote: unitsOnHand === 0 ? 'Opening counts pending' : 'Sum across items' },
            { label: 'Estimated value (USD)', value: fmtUsd(valueUsd),   footnote: unitsOnHand === 0 ? 'Populates once counts entered' : 'Sum of value_usd_estimate' },
            { label: 'Distinct categories', value: fmtInt(categories),   footnote: 'Distinct category_name' },
          ]}
        />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <AddItemForm
          propertyId={propertyId}
          categories={formOptions.categories}
          units={formOptions.units}
          locations={formOptions.locations}
        />
      </div>

      {itemCount === 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Catalog is empty" expandable={false}>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: '#1B1B1B' }}>
              Upload the PMS product CSV (Manage → Items → export → map to sku,
              item_name, category_code, unit_code) via the legacy /catalog upload button.
              Once loaded, live rows appear here.
            </div>
          </Container>
        </div>
      )}

      {itemCount > 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <CatalogList title="Catalog" data={rows} />
        </div>
      )}
    </DashboardPage>
  );
}
