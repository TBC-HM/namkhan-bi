// app/guest/directory/page.tsx
// Marathon #195 child — Guest · Directory
// Wired to guest.mv_guest_profile via Supabase service role
// Assumption: mv_guest_profile exists with columns listed below.
// If view is missing, page renders empty state gracefully.

import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface GuestProfile {
  guest_id?: string | number;
  full_name?: string;
  nationality?: string;
  email?: string;
  phone?: string;
  loyalty_tier?: string;
  total_stays?: number;
  total_nights?: number;
  total_spend_usd?: number | null;
  last_stay_date?: string;
  first_stay_date?: string;
  vip_flag?: boolean | string;
  segment?: string;
  language?: string;
  [key: string]: unknown;
}

export default async function GuestDirectoryPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('mv_guest_profile')
    .schema('guest' as never)
    .select('*')
    .order('last_stay_date', { ascending: false })
    .limit(100);

  const rows: GuestProfile[] = data ?? [];

  // KPI aggregates
  const totalGuests = rows.length;
  const vipCount = rows.filter(
    (r) => r.vip_flag === true || r.vip_flag === 'true' || r.vip_flag === '1'
  ).length;
  const avgNights =
    totalGuests > 0
      ? (
          rows.reduce((sum, r) => sum + (Number(r.total_nights) || 0), 0) / totalGuests
        ).toFixed(1)
      : '—';
  const totalSpendUSD = rows.reduce(
    (sum, r) => sum + (Number(r.total_spend_usd) || 0),
    0
  );
  const fmtUSD = (n: number) =>
    n > 0 ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';

  const columns = [
    { key: 'full_name', header: 'Guest' },
    { key: 'nationality', header: 'Nationality' },
    { key: 'loyalty_tier', header: 'Tier' },
    { key: 'segment', header: 'Segment' },
    { key: 'total_stays', header: 'Stays' },
    { key: 'total_nights', header: 'Nights' },
    { key: 'total_spend_usd', header: 'Total Spend (USD)' },
    { key: 'last_stay_date', header: 'Last Stay' },
    { key: 'vip_flag', header: 'VIP' },
    { key: 'language', header: 'Language' },
  ];

  const displayRows = rows.map((r) => ({
    ...r,
    full_name: r.full_name ?? '—',
    nationality: r.nationality ?? '—',
    loyalty_tier: r.loyalty_tier ?? '—',
    segment: r.segment ?? '—',
    total_stays: r.total_stays ?? '—',
    total_nights: r.total_nights ?? '—',
    total_spend_usd:
      r.total_spend_usd != null
        ? `$${Number(r.total_spend_usd).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
        : '—',
    last_stay_date: r.last_stay_date?.slice(0, 10) ?? '—',
    vip_flag:
      r.vip_flag === true || r.vip_flag === 'true' || r.vip_flag === '1'
        ? '⭐ VIP'
        : '—',
    language: r.language ?? '—',
  }));

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'inherit' }}>
      <PageHeader pillar="Guest" tab="Directory" title="Guest Directory" />

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: '8px 16px',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          ⚠️ Data source unavailable: {error.message}. Displaying cached or empty state.
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiBox label="Total Guests" value={totalGuests > 0 ? String(totalGuests) : '—'} />
        <KpiBox label="VIP Guests" value={vipCount > 0 ? String(vipCount) : '—'} />
        <KpiBox label="Avg Nights / Guest" value={avgNights} />
        <KpiBox label="Total Spend (USD)" value={fmtUSD(totalSpendUSD)} />
      </div>

      <DataTable columns={columns} rows={displayRows} />
    </main>
  );
}
