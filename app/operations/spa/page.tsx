// app/operations/spa/page.tsx
// Marathon #195 child — Operations · Spa
// v_spa_today is not yet in the PostgREST allowlist;
// page renders gracefully with em-dash placeholders until the view is exposed.

import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface SpaRow {
  treatment_date?: string | null;
  treatment_name?: string | null;
  therapist?: string | null;
  guest_name?: string | null;
  duration_min?: number | null;
  revenue_usd?: number | null;
  status?: string | null;
}

export default async function SpaPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_spa_today')
    .select('*')
    .limit(100);

  const rows: SpaRow[] = data ?? [];

  // KPI derivations — computed client-side from view rows
  const totalTreatments = rows.length;
  const totalRevenue = rows.reduce((sum, r) => sum + (r.revenue_usd ?? 0), 0);
  const avgDuration =
    rows.length > 0
      ? Math.round(
          rows.reduce((sum, r) => sum + (r.duration_min ?? 0), 0) / rows.length
        )
      : null;
  const confirmedCount = rows.filter(
    (r) => (r.status ?? '').toLowerCase() === 'confirmed'
  ).length;

  const fmt = (n: number | null, prefix = '') =>
    n !== null ? `${prefix}${n.toLocaleString()}` : '—';

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'var(--font-sans, sans-serif)' }}>
      <PageHeader pillar="Operations" tab="Spa" title="Spa — Today's Schedule" />

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginTop: 24,
          marginBottom: 32,
        }}
      >
        <KpiBox
          label="Treatments Today"
          value={totalTreatments > 0 ? String(totalTreatments) : '—'}
        />
        <KpiBox
          label="Revenue (USD)"
          value={totalRevenue > 0 ? fmt(totalRevenue, '$') : '—'}
        />
        <KpiBox
          label="Avg Duration (min)"
          value={fmt(avgDuration)}
        />
        <KpiBox
          label="Confirmed Bookings"
          value={confirmedCount > 0 ? String(confirmedCount) : '—'}
        />
      </div>

      {/* Error banner — only shown when view exists but query fails */}
      {error && !data && (
        <div
          style={{
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: 6,
            padding: '10px 16px',
            marginBottom: 16,
            fontSize: 13,
            color: '#856404',
          }}
        >
          ⚠️ Could not load spa data: {error.message}. KPIs show em-dash placeholders
          until <code>v_spa_today</code> is allowlisted in PostgREST.
        </div>
      )}

      {/* Treatments table */}
      <DataTable
        columns={[
          { key: 'treatment_date', header: 'Date' },
          { key: 'treatment_name', header: 'Treatment' },
          { key: 'therapist', header: 'Therapist' },
          { key: 'guest_name', header: 'Guest' },
          { key: 'duration_min', header: 'Duration (min)' },
          { key: 'revenue_usd', header: 'Revenue (USD)' },
          { key: 'status', header: 'Status' },
        ]}
        rows={rows.map((r) => ({
          treatment_date: r.treatment_date ?? '—',
          treatment_name: r.treatment_name ?? '—',
          therapist: r.therapist ?? '—',
          guest_name: r.guest_name ?? '—',
          duration_min: r.duration_min !== null && r.duration_min !== undefined ? r.duration_min : '—',
          revenue_usd:
            r.revenue_usd !== null && r.revenue_usd !== undefined
              ? `$${r.revenue_usd.toLocaleString()}`
              : '—',
          status: r.status ?? '—',
        }))}
      />
    </main>
  );
}
