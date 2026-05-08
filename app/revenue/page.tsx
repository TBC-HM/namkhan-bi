// app/revenue/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function RevenuePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Pull latest KPI snapshot from reservations
  const { data: kpiRows } = await supabase
    .from('reservations')
    .select('room_rate, status, check_in, check_out')
    .gte('check_in', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
    .limit(500);

  const rows = kpiRows ?? [];

  // Derive KPIs from raw reservations
  const confirmed = rows.filter((r) => r.status !== 'cancelled');
  const totalRevenue = confirmed.reduce((sum, r) => sum + (r.room_rate ?? 0), 0);
  const totalRoomNights = confirmed.length;
  const adr = totalRoomNights > 0 ? totalRevenue / totalRoomNights : 0;

  const fmt = (n: number) =>
    n === 0 ? '—' : `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const fmtN = (n: number) => (n === 0 ? '—' : n.toLocaleString('en-US'));

  // Revenue section nav cards
  const sections = [
    { href: '/revenue/pulse', label: '📈 Pulse', desc: 'Daily OCC · ADR · RevPAR snapshot' },
    { href: '/revenue/channels', label: '🔗 Channels', desc: 'OTA breakdown · Booking.com analytics' },
    { href: '/revenue/compset', label: '🏨 Compset', desc: 'Competitor rate intelligence' },
    { href: '/revenue/parity', label: '⚖️ Parity', desc: 'Rate parity monitoring' },
    { href: '/revenue/forecast', label: '🔮 Forecast', desc: 'Pickup & pace vs last year' },
  ] as const;

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'var(--font-sans, system-ui)', maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader pillar="Revenue" tab="Overview" title="Revenue" />

      {/* MTD KPI strip */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
          Month-to-date
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <KpiBox label="MTD Revenue" value={fmt(totalRevenue)} />
          <KpiBox label="ADR" value={fmt(adr)} />
          <KpiBox label="Room Nights" value={fmtN(totalRoomNights)} />
        </div>
      </section>

      {/* Section navigation */}
      <section>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
          Revenue modules
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {sections.map((s) => (
            <a
              key={s.href}
              href={s.href}
              style={{
                display: 'block',
                padding: '20px 24px',
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                background: '#ffffff',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'box-shadow 0.15s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 8 }}>{s.label.split(' ')[0]}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                {s.label.split(' ').slice(1).join(' ')}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.4 }}>{s.desc}</div>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
