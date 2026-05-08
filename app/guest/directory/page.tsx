// app/guest/directory/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_guest_directory')
    .select('*')
    .limit(100);

  const rows = data ?? [];

  const totalGuests = rows.length;
  const vipGuests = rows.filter((r: Record<string, unknown>) => r.vip_flag || r.is_vip).length;
  const returningGuests = rows.filter((r: Record<string, unknown>) => r.returning || r.is_returning).length;

  return (
    <main style={{ minHeight: '100vh', background: 'var(--black, #000)', color: 'var(--white, #fff)', padding: '0' }}>
      <PageHeader pillar="Guest" tab="Directory" title="Directory" />

      {error && (
        <p style={{ color: 'var(--brass, #b08d57)', padding: '16px 24px', fontSize: 'var(--t-sm)' }}>
          ⚠ View unavailable — showing em-dash placeholders
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: '24px 24px 0' }}>
        <KpiBox label="Total Guests" value={totalGuests > 0 ? String(totalGuests) : '—'} />
        <KpiBox label="VIP Guests" value={vipGuests > 0 ? String(vipGuests) : '—'} />
        <KpiBox label="Returning Guests" value={returningGuests > 0 ? String(returningGuests) : '—'} />
        <KpiBox label="Avg Stay (nights)" value={rows[0]?.avg_stay_nights != null ? String(rows[0].avg_stay_nights) : '—'} />
      </div>

      <div style={{ padding: '24px' }}>
        <DataTable
          columns={[
            { key: 'guest_name',    header: 'Guest Name' },
            { key: 'nationality',   header: 'Nationality' },
            { key: 'email',         header: 'Email' },
            { key: 'check_in',      header: 'Check-In' },
            { key: 'check_out',     header: 'Check-Out' },
            { key: 'room_number',   header: 'Room' },
            { key: 'vip_flag',      header: 'VIP' },
            { key: 'total_stays',   header: 'Total Stays' },
            { key: 'total_spend',   header: 'Total Spend' },
          ]}
          rows={rows.map((r: Record<string, unknown>) => ({
            guest_name:   r.guest_name   ?? r.name          ?? '—',
            nationality:  r.nationality  ?? r.country       ?? '—',
            email:        r.email                           ?? '—',
            check_in:     r.check_in     ?? r.arrival_date  ?? '—',
            check_out:    r.check_out    ?? r.departure_date ?? '—',
            room_number:  r.room_number  ?? r.room          ?? '—',
            vip_flag:     (r.vip_flag || r.is_vip) ? 'Yes' : '—',
            total_stays:  r.total_stays  != null ? String(r.total_stays)                        : '—',
            total_spend:  r.total_spend  != null ? `$${Number(r.total_spend).toLocaleString()}` : '—',
          }))}
        />
      </div>
    </main>
  );
}
