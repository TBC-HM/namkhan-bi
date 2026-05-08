// app/operations/spa/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface SpaRow {
  treatment_date?: string;
  therapist_name?: string;
  treatment_name?: string;
  duration_min?: number;
  guest_name?: string;
  room_number?: string | number;
  revenue_usd?: number;
  revenue_lak?: number;
  status?: string;
  booked_at?: string;
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

  // Derive KPIs from rows
  const totalAppointments = rows.length;
  const confirmedRows = rows.filter((r) => r.status?.toLowerCase() === 'confirmed');
  const totalRevenueUsd = rows.reduce((acc, r) => acc + (r.revenue_usd ?? 0), 0);
  const uniqueTherapists = new Set(rows.map((r) => r.therapist_name).filter(Boolean)).size;

  const fmt = (n: number, prefix = '') =>
    n === 0 ? '—' : `${prefix}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const columns = [
    { key: 'treatment_date',  header: 'Date' },
    { key: 'therapist_name',  header: 'Therapist' },
    { key: 'treatment_name',  header: 'Treatment' },
    { key: 'duration_min',    header: 'Duration (min)' },
    { key: 'guest_name',      header: 'Guest' },
    { key: 'room_number',     header: 'Room' },
    { key: 'revenue_usd',     header: 'Revenue (USD)' },
    { key: 'status',          header: 'Status' },
  ];

  // Normalise rows for display
  const displayRows = rows.map((r) => ({
    treatment_date: r.treatment_date ?? '—',
    therapist_name: r.therapist_name ?? '—',
    treatment_name: r.treatment_name ?? '—',
    duration_min:   r.duration_min != null ? String(r.duration_min) : '—',
    guest_name:     r.guest_name ?? '—',
    room_number:    r.room_number != null ? String(r.room_number) : '—',
    revenue_usd:    r.revenue_usd != null ? `$${r.revenue_usd.toFixed(2)}` : '—',
    status:         r.status ?? '—',
  }));

  return (
    <main style={{ padding: '24px', fontFamily: 'sans-serif' }}>
      <PageHeader pillar="Operations" tab="Spa" title="Spa — Today" />

      {error && (
        <p style={{ color: '#b91c1c', marginBottom: 16 }}>
          ⚠ Data unavailable: {error.message}
        </p>
      )}

      {/* KPI Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Appointments Today" value={String(totalAppointments)} />
        <KpiBox label="Confirmed" value={String(confirmedRows.length)} />
        <KpiBox
          label="Revenue (USD)"
          value={totalRevenueUsd > 0 ? `$${fmt(totalRevenueUsd)}` : '—'}
        />
        <KpiBox label="Active Therapists" value={uniqueTherapists > 0 ? String(uniqueTherapists) : '—'} />
      </div>

      {/* Appointments Table */}
      <DataTable columns={columns} rows={displayRows} />
    </main>
  );
}
