// app/operations/inventory/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// Shape returned by inv.v_stock_summary (assumed — adjust if columns differ)
interface StockRow {
  item_name?: string;
  category?: string;
  unit?: string;
  qty_on_hand?: number | null;
  qty_reorder_level?: number | null;
  qty_on_order?: number | null;
  last_updated?: string | null;
  status?: string | null;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Primary: inv schema view. Fallback: empty array if view/schema not yet deployed.
  const { data, error } = await supabase
    .schema('inv' as 'public')        // cast: supabase-js typegen may not know inv schema
    .from('v_stock_summary')
    .select('*')
    .limit(100);

  const rows: StockRow[] = (error ? [] : data) ?? [];

  // Aggregate KPIs
  const totalItems = rows.length;
  const belowReorder = rows.filter(
    (r) =>
      r.qty_on_hand !== null &&
      r.qty_reorder_level !== null &&
      r.qty_on_hand !== undefined &&
      r.qty_reorder_level !== undefined &&
      r.qty_on_hand < r.qty_reorder_level
  ).length;
  const onOrder = rows.filter(
    (r) => r.qty_on_order !== null && r.qty_on_order !== undefined && r.qty_on_order > 0
  ).length;
  const categories = new Set(rows.map((r) => r.category ?? '')).size;

  return (
    <main style={{ padding: '24px', fontFamily: 'inherit' }}>
      <PageHeader pillar="Operations" tab="Inventory" title="Inventory Stock Summary" />

      {/* KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiBox label="Total Items" value={totalItems} />
        <KpiBox label="Below Reorder" value={belowReorder} />
        <KpiBox label="On Order" value={onOrder} />
        <KpiBox label="Categories" value={categories} />
      </div>

      {/* Stock Table */}
      <DataTable
        columns={[
          { key: 'item_name',        header: 'Item' },
          { key: 'category',         header: 'Category' },
          { key: 'unit',             header: 'Unit' },
          { key: 'qty_on_hand',      header: 'On Hand' },
          { key: 'qty_reorder_level',header: 'Reorder At' },
          { key: 'qty_on_order',     header: 'On Order' },
          { key: 'status',           header: 'Status' },
          { key: 'last_updated',     header: 'Last Updated' },
        ]}
        rows={rows.map((r) => ({
          item_name:         r.item_name        ?? '—',
          category:          r.category         ?? '—',
          unit:              r.unit             ?? '—',
          qty_on_hand:       r.qty_on_hand      ?? '—',
          qty_reorder_level: r.qty_reorder_level ?? '—',
          qty_on_order:      r.qty_on_order     ?? '—',
          status:            r.status           ?? '—',
          last_updated:      r.last_updated
            ? new Date(r.last_updated).toISOString().slice(0, 10)
            : '—',
        }))}
      />

      {error && (
        <p style={{ marginTop: 12, color: '#888', fontSize: 12 }}>
          ⚠ inv.v_stock_summary unavailable — schema may not be deployed yet.
        </p>
      )}
    </main>
  );
}
