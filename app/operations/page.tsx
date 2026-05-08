// app/operations/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch active reservations (check-ins today / in-house)
  const { data: reservations } = await supabase
    .from('reservations')
    .select('status, room_type_name, check_in, check_out, guest_name')
    .in('status', ['checked_in', 'confirmed'])
    .limit(50);

  const rows = reservations ?? [];

  const checkedIn = rows.filter((r) => r.status === 'checked_in').length;
  const arrivals = rows.filter((r) => r.status === 'confirmed').length;
  const totalActive = rows.length;

  // Pillars for the operations hub — link cards
  const pillars: { label: string; href: string; description: string }[] = [
    {
      label: 'Housekeeping',
      href: '/operations/housekeeping',
      description: 'Room status, assignments, and turn-around.',
    },
    {
      label: 'Maintenance',
      href: '/operations/maintenance',
      description: 'Open work orders, priority faults, and history.',
    },
    {
      label: 'Front Office',
      href: '/operations/frontoffice',
      description: 'Arrivals, departures, and in-house guest list.',
    },
    {
      label: 'F&B',
      href: '/operations/fnb',
      description: 'Outlet covers, revenue, and reservations.',
    },
    {
      label: 'Activities',
      href: '/operations/activities',
      description: 'Tour bookings and on-property experience schedule.',
    },
    {
      label: 'Staff Roster',
      href: '/operations/roster',
      description: 'Shift schedule and department headcount.',
    },
  ];

  return (
    <main style={{ padding: '24px 32px', background: '#000', minHeight: '100vh', color: '#fff' }}>
      <PageHeader pillar="Operations" tab="Hub" title="Operations Hub" />

      {/* KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          marginTop: 24,
          marginBottom: 40,
        }}
      >
        <KpiBox label="In-House Guests" value={checkedIn} />
        <KpiBox label="Today's Arrivals" value={arrivals} />
        <KpiBox label="Active Reservations" value={totalActive} />
      </div>

      {/* Pillar Nav Cards */}
      <h2 style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', color: '#9ca3af', marginBottom: 16, textTransform: 'uppercase' }}>
        Departments
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {pillars.map((p) => (
          <a
            key={p.href}
            href={p.href}
            style={{
              display: 'block',
              background: '#111',
              border: '1px solid #222',
              borderRadius: 8,
              padding: '20px 24px',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'border-color 0.15s',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: '#f9fafb', marginBottom: 6 }}>
              {p.label}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
              {p.description}
            </div>
          </a>
        ))}
      </div>

      {/* Active Reservations Table */}
      <h2
        style={{
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: '#9ca3af',
          marginBottom: 16,
          marginTop: 48,
          textTransform: 'uppercase',
        }}
      >
        Active Reservations
      </h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #222' }}>
              {['Guest', 'Room Type', 'Check-in', 'Check-out', 'Status'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '10px 12px',
                    textAlign: 'left',
                    color: '#9ca3af',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '20px 12px', textAlign: 'center', color: '#6b7280' }}>
                  —
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: '1px solid #1a1a1a', background: i % 2 === 0 ? 'transparent' : '#0d0d0d' }}
                >
                  <td style={{ padding: '10px 12px', color: '#f9fafb' }}>{r.guest_name ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#d1d5db' }}>{r.room_type_name ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#d1d5db' }}>{r.check_in ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#d1d5db' }}>{r.check_out ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 600,
                        background: r.status === 'checked_in' ? '#14532d' : '#1e3a5f',
                        color: r.status === 'checked_in' ? '#86efac' : '#93c5fd',
                        textTransform: 'capitalize',
                      }}
                    >
                      {r.status ?? '—'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
