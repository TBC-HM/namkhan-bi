// app/operations/restaurant/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';
import StatusPill from '@/components/ui/StatusPill';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function RestaurantPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Attempt to load restaurant/F&B data from ops schema
  // Fallback: query ops.daily_summary or related tables if v_restaurant_today not yet created
  const { data: restaurantData } = await supabase
    .from('v_restaurant_today')
    .select('*')
    .limit(50);

  // Fallback: try ops schema transactions for F&B
  const { data: txData } = await supabase
    .from('transactions')
    .select('id, date, description, amount_usd, category, sub_category, source')
    .ilike('category', '%food%')
    .order('date', { ascending: false })
    .limit(50);

  // Fallback: try ops.fnb or ops.restaurant tables
  const { data: fnbData } = await supabase
    .from('fnb_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  // Use whatever returned data we have, in priority order
  const rows: Record<string, unknown>[] = restaurantData ?? fnbData ?? txData ?? [];

  // Compute summary KPIs from available rows
  const totalCovers = rows.reduce((acc, r) => acc + (Number(r.covers) || Number(r.pax) || 0), 0);
  const totalRevUsd = rows.reduce((acc, r) => acc + (Number(r.revenue_usd) || Number(r.amount_usd) || 0), 0);
  const totalRevLak = rows.reduce((acc, r) => acc + (Number(r.revenue_lak) || 0), 0);
  const avgSpendUsd = totalCovers > 0 ? (totalRevUsd / totalCovers).toFixed(2) : null;
  const orderCount = rows.length;

  const hasData = rows.length > 0;

  // Build table columns based on what data we have
  const isRestaurantView = !!restaurantData && restaurantData.length > 0;
  const isTxView = !isRestaurantView && !!txData && txData.length > 0;

  const restaurantColumns = [
    { key: 'date', header: 'Date' },
    { key: 'meal_period', header: 'Period' },
    { key: 'covers', header: 'Covers' },
    { key: 'revenue_usd', header: 'Revenue (USD)' },
    { key: 'revenue_lak', header: 'Revenue (LAK)' },
    { key: 'avg_spend_usd', header: 'Avg Spend' },
    { key: 'source', header: 'Source' },
  ];

  const txColumns = [
    { key: 'date', header: 'Date' },
    { key: 'description', header: 'Description' },
    { key: 'amount_usd', header: 'Amount (USD)' },
    { key: 'category', header: 'Category' },
    { key: 'sub_category', header: 'Sub-Category' },
    { key: 'source', header: 'Source' },
  ];

  const genericColumns = [
    { key: 'date', header: 'Date' },
    { key: 'description', header: 'Description' },
    { key: 'amount_usd', header: 'Amount (USD)' },
    { key: 'category', header: 'Category' },
  ];

  const columns = isRestaurantView
    ? restaurantColumns
    : isTxView
    ? txColumns
    : genericColumns;

  // Normalise rows so empty cells show em-dash
  const normalisedRows = rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const col of columns) {
      const val = r[col.key];
      out[col.key] = val !== null && val !== undefined && val !== '' ? val : '—';
    }
    return out;
  });

  return (
    <main>
      <PageHeader
        pillar="Operations"
        tab="Restaurant"
        title="Restaurant & F&B"
        lede="Daily food & beverage performance — covers, revenue and average spend."
      />

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          padding: '16px 24px',
        }}
      >
        <KpiBox
          label="Today's Covers"
          value={hasData && totalCovers > 0 ? String(totalCovers) : '—'}
        />
        <KpiBox
          label="F&B Revenue (USD)"
          value={hasData && totalRevUsd > 0 ? `$${totalRevUsd.toFixed(2)}` : '—'}
        />
        <KpiBox
          label="F&B Revenue (LAK)"
          value={hasData && totalRevLak > 0 ? `₭${totalRevLak.toLocaleString()}` : '—'}
        />
        <KpiBox
          label="Avg Spend / Cover"
          value={avgSpendUsd ? `$${avgSpendUsd}` : '—'}
        />
        <KpiBox
          label="Orders / Transactions"
          value={hasData ? String(orderCount) : '—'}
        />
      </div>

      {/* Data status pill */}
      <div style={{ padding: '0 24px 12px' }}>
        {hasData ? (
          <StatusPill tone="positive">Live data</StatusPill>
        ) : (
          <StatusPill tone="pending">Data needed — v_restaurant_today view not yet created</StatusPill>
        )}
      </div>

      {/* Detail table */}
      <div style={{ padding: '0 24px 32px' }}>
        {hasData ? (
          <DataTable columns={columns} rows={normalisedRows} />
        ) : (
          <div
            style={{
              border: '1px dashed var(--color-border, #d4cfc8)',
              borderRadius: 8,
              padding: 32,
              textAlign: 'center',
              color: 'var(--color-text-muted, #888)',
            }}
          >
            <p style={{ margin: 0, fontSize: 14 }}>
              No F&amp;B data available yet. The <code>v_restaurant_today</code> view or
              underlying tables have not been populated. Once created, this page will display
              covers, revenue, and average spend automatically.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
