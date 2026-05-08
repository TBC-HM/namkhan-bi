// app/guest/directory/page.tsx
// Marathon #195 child — Guest · Directory
// View guest.mv_guest_profile is not allowlisted; service-role fetch used directly.
// Assumption: columns match the shape defined below. Adjust column keys if schema differs.

import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface GuestProfile {
  guest_id?: string | number;
  full_name?: string;
  nationality?: string;
  email?: string;
  phone?: string;
  total_stays?: number;
  total_nights?: number;
  total_revenue?: number;
  last_stay_date?: string;
  loyalty_tier?: string;
  segment?: string;
  is_vip?: boolean;
}

export default async function GuestDirectoryPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .schema('guest')
    .from('mv_guest_profile')
    .select('*')
    .order('total_stays', { ascending: false })
    .limit(100);

  const rows: GuestProfile[] = data ?? [];

  // KPI aggregations
  const totalGuests = rows.length;
  const vipCount = rows.filter((r) => r.is_vip).length;
  const avgNights =
    totalGuests > 0
      ? (rows.reduce((s, r) => s + (r.total_nights ?? 0), 0) / totalGuests).toFixed(1)
      : '—';
  const totalRevenue = rows.reduce((s, r) => s + (r.total_revenue ?? 0), 0);
  const fmtRevenue =
    totalRevenue > 0 ? `$${totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';

  return (
    <main style={{ padding: 24 }}>
      <PageHeader pillar="Guest" tab="Directory" title="Guest Directory" />

      {error && (
        <p style={{ color: '#b91c1c', marginBottom: 16 }}>
          ⚠ Data load error: {error.message}
        </p>
      )}

      {/* KPI row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiBox label="Total Guests" value={totalGuests} />
        <KpiBox label="VIP Guests" value={vipCount} />
        <KpiBox label="Avg Nights / Guest" value={avgNights} />
        <KpiBox label="Lifetime Revenue" value={fmtRevenue} />
      </div>

      {/* Directory table */}
      <DataTable
        columns={[
          { key: 'full_name', header: 'Name' },
          { key: 'nationality', header: 'Nationality' },
          { key: 'email', header: 'Email' },
          { key: 'phone', header: 'Phone' },
          { key: 'loyalty_tier', header: 'Loyalty Tier' },
          { key: 'segment', header: 'Segment' },
          { key: 'total_stays', header: 'Stays' },
          { key: 'total_nights', header: 'Nights' },
          {
            key: 'total_revenue',
            header: 'Revenue',
            render: (v: unknown) =>
              v != null
                ? `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                : '—',
          },
          { key: 'last_stay_date', header: 'Last Stay' },
          {
            key: 'is_vip',
            header: 'VIP',
            render: (v: unknown) => (v ? '⭐ VIP' : '—'),
          },
        ]}
        rows={rows}
      />
    </main>
  );
}
