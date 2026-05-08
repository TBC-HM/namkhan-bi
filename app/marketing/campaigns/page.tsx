// app/marketing/campaigns/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Campaign {
  id?: string | number;
  name?: string;
  channel?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  budget_usd?: number | null;
  spend_usd?: number | null;
  leads?: number | null;
  bookings?: number | null;
  revenue_usd?: number | null;
}

function fmt(n: number | null | undefined, prefix = ''): string {
  if (n == null) return '—';
  return `${prefix}${n.toLocaleString('en-US')}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return d.slice(0, 10);
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Attempt to read from marketing.v_campaigns_active; fall back to marketing.campaigns
  let rows: Campaign[] = [];

  const { data: viewData } = await supabase
    .schema('marketing')
    .from('v_campaigns_active')
    .select('*')
    .limit(100);

  if (viewData && viewData.length > 0) {
    rows = viewData as Campaign[];
  } else {
    const { data: tableData } = await supabase
      .schema('marketing')
      .from('campaigns')
      .select('*')
      .order('start_date', { ascending: false })
      .limit(100);
    rows = (tableData ?? []) as Campaign[];
  }

  // KPI aggregates
  const total = rows.length;
  const active = rows.filter(
    (r) => r.status?.toLowerCase() === 'active'
  ).length;
  const totalBudget = rows.reduce((s, r) => s + (r.budget_usd ?? 0), 0);
  const totalSpend = rows.reduce((s, r) => s + (r.spend_usd ?? 0), 0);
  const totalRevenue = rows.reduce((s, r) => s + (r.revenue_usd ?? 0), 0);
  const totalBookings = rows.reduce((s, r) => s + (r.bookings ?? 0), 0);

  const roasPct =
    totalSpend > 0
      ? `${((totalRevenue / totalSpend) * 100).toFixed(1)}%`
      : '—';

  const columns = [
    { key: 'name', header: 'Campaign' },
    { key: 'channel', header: 'Channel' },
    { key: 'status', header: 'Status' },
    { key: 'start_date', header: 'Start' },
    { key: 'end_date', header: 'End' },
    { key: 'budget_usd', header: 'Budget (USD)' },
    { key: 'spend_usd', header: 'Spend (USD)' },
    { key: 'leads', header: 'Leads' },
    { key: 'bookings', header: 'Bookings' },
    { key: 'revenue_usd', header: 'Revenue (USD)' },
  ];

  const tableRows = rows.map((r) => ({
    name: r.name ?? '—',
    channel: r.channel ?? '—',
    status: r.status ?? '—',
    start_date: fmtDate(r.start_date),
    end_date: fmtDate(r.end_date),
    budget_usd: fmt(r.budget_usd, '$'),
    spend_usd: fmt(r.spend_usd, '$'),
    leads: fmt(r.leads),
    bookings: fmt(r.bookings),
    revenue_usd: fmt(r.revenue_usd, '$'),
  }));

  return (
    <main className="p-6 space-y-6">
      <PageHeader pillar="Marketing" tab="Campaigns" title="Campaigns" />

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 16,
        }}
      >
        <KpiBox label="Total Campaigns" value={total > 0 ? String(total) : '—'} />
        <KpiBox label="Active" value={active > 0 ? String(active) : '—'} />
        <KpiBox
          label="Total Budget"
          value={totalBudget > 0 ? fmt(totalBudget, '$') : '—'}
        />
        <KpiBox
          label="Total Spend"
          value={totalSpend > 0 ? fmt(totalSpend, '$') : '—'}
        />
        <KpiBox
          label="Total Revenue"
          value={totalRevenue > 0 ? fmt(totalRevenue, '$') : '—'}
        />
        <KpiBox
          label="Total Bookings"
          value={totalBookings > 0 ? String(totalBookings) : '—'}
        />
        <KpiBox label="ROAS" value={roasPct} />
      </div>

      {/* Campaign table */}
      {tableRows.length > 0 ? (
        <DataTable columns={columns} rows={tableRows} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No campaign data available yet. Campaigns will appear here once added
          to the marketing schema.
        </p>
      )}
    </main>
  );
}
