// app/h/[property_id]/operations/inventory/page.tsx
//
// Canonical Namkhan (+ Donna) Inventory landing.
// Registry-driven from public.v_cockpit_inventory WHERE page_slug='inventory'.
// New design system (DashboardPage / Container / ListContainer / KpiTile / MetricRow).
//
// Data:
//   - Headline strip: aggregates from public.v_inv_stock_on_hand (PostgREST view).
//   - Stock-on-hand list: rows from same view, sorted by item_name asc.
//   - Registry loop: `SELECT ... FROM v_cockpit_inventory WHERE page_slug='inventory'`.
//     Today = 1 row (inventory.stock_on_hand) -> maps to the ListContainer below.
//     A `switch(code)` dispatch keeps future rows additive.
//
// Sub-tab strip is wired via NAV_SUBGROUPS (parentHref '/operations/inventory'),
// so DashboardPage picks up the 12 tabs (Overview . Assets . Capex . Catalog .
// Counts . Items . Orders . Par . Requests . Shop . Stock . Suppliers)
// automatically -- no local sub-nav wiring needed.

import { redirect } from 'next/navigation';
import { DashboardPage, Container, ListContainer, KpiTile, MetricRow, type ListContainerColumn } from '@/app/(cockpit)/_design';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  params: { property_id: string };
}

interface StockRow {
  item_id: string;
  sku: string | null;
  item_name: string;
  category_name: string | null;
  total_on_hand: number;
  value_usd_estimate: number;
  locations_with_stock: number;
  last_movement_at: string | null;
  last_count_at: string | null;
}

interface RegistryRow {
  code: string;
  name: string;
  bound_views: string[] | null;
  chart_type: string | null;
}

const fmtInt = (n: number): string => Math.round(Number(n) || 0).toLocaleString('en-US');
const fmtUsd = (n: number): string => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

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

// Column definitions for the Stock-on-Hand ListContainer.
const STOCK_COLUMNS: ListContainerColumn<StockRow>[] = [
  { key: 'sku',                  label: 'SKU',           width: 140,
    render: (r) => (
      <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>
        {r.sku ?? '—'}
      </span>
    ) },
  { key: 'item_name',            label: 'Item',
    render: (r) => <span>{r.item_name}</span> },
  { key: 'category_name',        label: 'Category',      width: 180,
    render: (r) => (
      <span style={{ color: '#5A5A5A', fontSize: 12 }}>{r.category_name ?? '—'}</span>
    ) },
  { key: 'total_on_hand',        label: 'On hand',       align: 'right', width: 90,
    render: (r) => <span>{fmtInt(r.total_on_hand)}</span> },
  { key: 'value_usd_estimate',   label: 'Value (USD)',   align: 'right', width: 110,
    render: (r) => <span>{fmtUsd(r.value_usd_estimate)}</span> },
  { key: 'locations_with_stock', label: 'Locations',     align: 'right', width: 90,
    render: (r) => <span>{fmtInt(r.locations_with_stock)}</span> },
  { key: 'last_movement_at',     label: 'Last movement', align: 'right', width: 120,
    render: (r) => <span style={{ color: '#5A5A5A', fontSize: 12 }}>{fmtDate(r.last_movement_at)}</span> },
  { key: 'last_count_at',        label: 'Last count',    align: 'right', width: 120,
    render: (r) => <span style={{ color: '#5A5A5A', fontSize: 12 }}>{fmtDate(r.last_count_at)}</span> },
];

function renderStockPeekRow(r: StockRow) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 180px 90px 110px', gap: 12, alignItems: 'baseline', padding: '2px 0' }}>
      <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, color: '#5A5A5A' }}>
        {r.sku ?? '—'}
      </span>
      <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {r.item_name}
      </span>
      <span style={{ fontSize: 12, color: '#5A5A5A' }}>{r.category_name ?? '—'}</span>
      <span style={{ fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {fmtInt(r.total_on_hand)}
      </span>
      <span style={{ fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {fmtUsd(r.value_usd_estimate)}
      </span>
    </div>
  );
}

function ZeroStateBanner({ itemCount }: { itemCount: number }) {
  return (
    <Container title="Opening counts pending" expandable={false}>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: '#1B1B1B' }}>
        Perpetual stock engine live —{' '}
        <strong>{fmtInt(itemCount)}</strong> items catalogued, opening counts not yet entered.
        Live balances (units on hand, value, locations) will populate once counts land under the{' '}
        <strong>Counts</strong> sub-tab.
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

  return (
    <DashboardPage title="Inventory">
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

      {/* Registry-driven loop. Today: 1 row -> maps to Stock-on-Hand ListContainer.
          Adding a new registry row later means adding a `case` here, not
          rewriting the page. */}
      {registry.map((row) => {
        switch (row.code) {
          case 'inventory.stock_on_hand':
            return (
              <div key={row.code} style={{ gridColumn: '1 / -1' }}>
                <ListContainer<StockRow>
                  title={row.name || 'Stock on Hand'}
                  subtitle={`${fmtInt(itemCount)} items · sorted by name`}
                  data={stock}
                  preview={10}
                  rowKey={(r) => r.item_id}
                  renderRow={renderStockPeekRow}
                  drawerColumns={STOCK_COLUMNS}
                  drawerDefaultSort={{ key: 'item_name', direction: 'asc' }}
                  drawerSearchKeys={['sku', 'item_name', 'category_name']}
                  showAllLabel={`Show all ${fmtInt(itemCount)}`}
                  empty={
                    isZeroState
                      ? {
                          title: 'All items currently at zero',
                          hint: 'Awaiting opening counts. Enter counts under the Counts sub-tab.',
                        }
                      : { title: 'No items', hint: 'v_inv_stock_on_hand returned no rows for this property.' }
                  }
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
