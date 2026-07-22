// app/h/[property_id]/operations/inventory/page.tsx
//
// Canonical Namkhan (+ Donna) Inventory landing.
// Registry-driven from public.v_cockpit_inventory WHERE page_slug='inventory'.
// New design system (DashboardPage + top strip via OPERATIONS_SUBPAGES,
// sub-strip auto-picked from NAV_SUBGROUPS by pathname).
//
// Server component. Client concerns (render fns, columns, ListContainer) live
// in ./InventoryStockList — passing function props from a server component to
// a "use client" ListContainer crashes RSC serialisation.

import { redirect } from 'next/navigation';
import { DashboardPage, Container, MetricRow, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import InventoryStockList, { type StockRow } from './InventoryStockList';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  params: { property_id: string };
}

interface RegistryRow {
  code: string;
  name: string;
  bound_views: string[] | null;
  chart_type: string | null;
}

const fmtInt = (n: number): string => Math.round(Number(n) || 0).toLocaleString('en-US');
const fmtUsd = (n: number): string => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

async function fetchStock(propertyId: number): Promise<StockRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_inv_stock_on_hand')
    .select('item_id, sku, item_name, category_name, total_on_hand, value_usd_estimate, locations_with_stock, last_movement_at, last_count_at')
    .eq('property_id', propertyId)
    .order('item_name', { ascending: true });
  if (error) {
    console.error('[inventory] v_inv_stock_on_hand fetch failed', error);
    return [];
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    item_id: String(r.item_id ?? ''),
    sku: (r.sku as string | null) ?? null,
    item_name: String(r.item_name ?? ''),
    category_name: (r.category_name as string | null) ?? null,
    total_on_hand: Number(r.total_on_hand ?? 0),
    value_usd_estimate: Number(r.value_usd_estimate ?? 0),
    locations_with_stock: Number(r.locations_with_stock ?? 0),
    last_movement_at: (r.last_movement_at as string | null) ?? null,
    last_count_at: (r.last_count_at as string | null) ?? null,
  }));
}

async function fetchRegistry(): Promise<RegistryRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_cockpit_inventory')
    .select('code, name, bound_views, chart_type')
    .eq('page_slug', 'inventory')
    .order('code', { ascending: true });
  if (error) {
    console.error('[inventory] v_cockpit_inventory fetch failed', error);
    return [];
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    code: String(r.code ?? ''),
    name: String(r.name ?? ''),
    bound_views: (r.bound_views as string[] | null) ?? null,
    chart_type: (r.chart_type as string | null) ?? null,
  }));
}

function ZeroStateBanner({ itemCount }: { itemCount: number }) {
  return (
    <Container title="Opening counts pending" expandable={false}>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: '#1B1B1B' }}>
        Perpetual stock engine live — <strong>{fmtInt(itemCount)}</strong> items catalogued,
        opening counts not yet entered. Live balances (units on hand, value, locations) will
        populate once counts land under the <strong>Counts</strong> sub-tab.
      </div>
    </Container>
  );
}

export default async function InventoryPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory`);
  }

  const [stock, registry] = await Promise.all([
    fetchStock(propertyId),
    fetchRegistry(),
  ]);

  const itemCount = stock.length;
  const unitsOnHand = stock.reduce((a, r) => a + (r.total_on_hand || 0), 0);
  const valueUsd = stock.reduce((a, r) => a + (r.value_usd_estimate || 0), 0);
  const locationsInUse = stock.reduce((a, r) => a + (r.locations_with_stock > 0 ? 1 : 0), 0);
  const isZeroState = unitsOnHand === 0;

  // Top strip · same OPERATIONS_SUBPAGES the Restaurant / Rooms / Spa pages use.
  // Sub-strip (Overview · Assets · Capex · Catalog · ...) is auto-picked by
  // DashboardPage from lib/nav-subgroups.ts via findSubGroup(pathname).
  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith('/inventory'),
  }));

  return (
    <DashboardPage title="Inventory" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow
          size="sm"
          tiles={[
            { label: 'Items in catalog',       value: fmtInt(itemCount),      footnote: 'Rows in v_inv_stock_on_hand' },
            { label: 'Units on hand',          value: fmtInt(unitsOnHand),    footnote: isZeroState ? 'Opening counts pending' : 'Sum across all items' },
            { label: 'Estimated value (USD)',  value: fmtUsd(valueUsd),       footnote: isZeroState ? 'Populates once counts entered' : 'Sum of value_usd_estimate' },
            { label: 'Items with stock',       value: fmtInt(locationsInUse), footnote: 'Items present in >=1 location' },
          ]}
        />
      </div>

      {isZeroState && (
        <div style={{ gridColumn: '1 / -1' }}>
          <ZeroStateBanner itemCount={itemCount} />
        </div>
      )}

      {registry.map((row) => {
        switch (row.code) {
          case 'inventory.stock_on_hand':
            return (
              <div key={row.code} style={{ gridColumn: '1 / -1' }}>
                <InventoryStockList
                  title={row.name || 'Stock on Hand'}
                  data={stock}
                  isZeroState={isZeroState}
                />
              </div>
            );
          default:
            return (
              <div key={row.code} style={{ gridColumn: '1 / -1' }}>
                <Container title={row.name || row.code} subtitle="Registry row not yet wired to a container">
                  <div style={{ fontSize: 12, color: '#5A5A5A' }}>
                    Code: <code>{row.code}</code>
                    {row.bound_views && row.bound_views.length > 0 && (
                      <> · Views: <code>{row.bound_views.join(', ')}</code></>
                    )}
                  </div>
                </Container>
              </div>
            );
        }
      })}
    </DashboardPage>
  );
}
