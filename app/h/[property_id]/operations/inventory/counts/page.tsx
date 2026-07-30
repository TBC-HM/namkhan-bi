// app/h/[property_id]/operations/inventory/counts/page.tsx
//
// Stock counts — start a count (CountForm), review submitted counts, and
// approve + post them to inv.stock_balance via fn_inv_count_post.
// Revived 2026-07-30 (inventory completion brief). Note: inv.counts has no
// property_id column — the earlier .eq('property_id', …) filter errored
// silently; location scoping does the tenant separation.

import { redirect } from 'next/navigation';
import { DashboardPage, Container, MetricRow, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import CountsList, { type CountRow } from './CountsList';
import NewCountSection, { type CountableItem, type BalanceRow } from './NewCountSection';
import CountPostButton from './CountPostButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string } }

const fmtInt = (n: number): string => Math.round(Number(n) || 0).toLocaleString('en-US');

interface CountRaw {
  count_id: string;
  count_date: string | null;
  count_type: string | null;
  status: string | null;
  location_id: number | null;
  notes: string | null;
}

interface ItemRaw {
  item_id: string;
  sku: string | null;
  item_name: string;
  last_unit_cost_usd: number | null;
  categories: { name: string | null } | null;
}

async function fetchData(propertyId: number) {
  const sb = getSupabaseAdmin();
  const [countsRes, locsRes, itemsRes, balancesRes] = await Promise.all([
    sb.schema('inv').from('counts')
      .select('count_id, count_date, count_type, status, location_id, notes')
      .order('count_date', { ascending: false })
      .limit(500),
    sb.schema('inv').from('locations')
      .select('location_id, location_name')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('location_name'),
    sb.schema('inv').from('items')
      .select('item_id, sku, item_name, last_unit_cost_usd, categories:category_id(name)')
      .eq('property_id', propertyId)
      .eq('catalog_status', 'approved')
      .eq('is_active', true)
      .order('item_name')
      .limit(3000),
    sb.schema('inv').from('stock_balance')
      .select('item_id, location_id, quantity_on_hand')
      .limit(5000),
  ]);
  if (countsRes.error) {
    // eslint-disable-next-line no-console
    console.error('[inventory/counts] inv.counts fetch failed', countsRes.error);
  }

  const locations = (locsRes.data ?? []).map((l: Record<string, unknown>) => ({
    location_id: Number(l.location_id),
    location_name: String(l.location_name ?? ''),
  }));
  const locNames = new Map<number, string>(locations.map((l) => [l.location_id, l.location_name]));
  const locIds = new Set(locations.map((l) => l.location_id));

  // Tenant scoping via this property's locations (inv.counts has no property_id).
  const counts = ((countsRes.data ?? []) as CountRaw[])
    .filter((c) => c.location_id == null || locIds.has(Number(c.location_id)));

  const items: CountableItem[] = ((itemsRes.data ?? []) as unknown as ItemRaw[]).map((r) => ({
    item_id: String(r.item_id),
    sku: String(r.sku ?? ''),
    item_name: String(r.item_name ?? ''),
    category_name: String(r.categories?.name ?? ''),
    unit_cost_usd: r.last_unit_cost_usd != null ? Number(r.last_unit_cost_usd) : null,
  }));

  const balances: BalanceRow[] = (balancesRes.data ?? []).map((b: Record<string, unknown>) => ({
    item_id: String(b.item_id),
    location_id: Number(b.location_id),
    quantity_on_hand: Number(b.quantity_on_hand ?? 0),
  }));

  return { counts, locations, locNames, items, balances };
}

export default async function CountsPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory/counts`);
  }

  const { counts, locations, locNames, items, balances } = await fetchData(propertyId);
  const basePath = `/h/${propertyId}/operations/inventory`;

  const rows: CountRow[] = counts.map((c) => ({
    count_id: String(c.count_id ?? ''),
    count_date: c.count_date ?? '—',
    location_name: c.location_id != null ? (locNames.get(Number(c.location_id)) ?? '—') : '—',
    count_type: c.count_type ?? '—',
    status: c.status ?? '—',
  }));

  const submittedCounts = counts.filter((c) => (c.status ?? '').toLowerCase() === 'submitted');
  const total = counts.length;
  const draft = counts.filter((c) => (c.status ?? '').toLowerCase() === 'draft').length;
  const posted = counts.filter((c) => ['approved', 'adjusted'].includes((c.status ?? '').toLowerCase())).length;

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith('/inventory'),
  }));

  return (
    <DashboardPage title="Stock counts" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow
          size="sm"
          tiles={[
            { label: 'Counts on file', value: fmtInt(total),                  footnote: 'Rows in inv.counts' },
            { label: 'Submitted',      value: fmtInt(submittedCounts.length), footnote: 'Awaiting approval + posting' },
            { label: 'Draft',          value: fmtInt(draft),                  footnote: 'In progress on mobile' },
            { label: 'Posted',         value: fmtInt(posted),                 footnote: 'Approved and written to stock ledger' },
          ]}
        />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="New count" expandable={false}>
          <NewCountSection basePath={basePath} locations={locations} items={items} balances={balances} />
        </Container>
      </div>

      {submittedCounts.length > 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Awaiting approval" expandable={false}>
            <table className="inv-table">
              <thead>
                <tr><th>Date</th><th>Location</th><th>Type</th><th>Counted by</th><th></th></tr>
              </thead>
              <tbody>
                {submittedCounts.map((c) => (
                  <tr key={c.count_id}>
                    <td>{c.count_date ?? '—'}</td>
                    <td>{c.location_id != null ? (locNames.get(Number(c.location_id)) ?? '—') : '—'}</td>
                    <td>{c.count_type ?? '—'}</td>
                    <td>{c.notes?.match(/counted by: (.+)$/)?.[1] ?? '—'}</td>
                    <td><CountPostButton countId={String(c.count_id)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Container>
        </div>
      )}

      {total > 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <CountsList title="Recent counts" data={rows} />
        </div>
      )}
    </DashboardPage>
  );
}
