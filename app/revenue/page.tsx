import PageHeader from '@/components/layout/PageHeader';
import DeptDropdown from '@/components/nav/DeptDropdown';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const LINKS = [
  { label: 'Pulse',      href: '/revenue/pulse',      desc: 'Daily OCC · ADR · RevPAR snapshot' },
  { label: 'Compset',    href: '/revenue/compset',     desc: 'Competitive rate benchmarking' },
  { label: 'Parity',     href: '/revenue/parity',      desc: 'Channel rate parity monitoring' },
  { label: 'Forecast',   href: '/revenue/forecast',    desc: 'Pick-up & demand forecasting' },
];

export default function RevenuePage() {
  return (
    <main style={{ padding: '32px 40px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <PageHeader pillar="Revenue" tab="" title="Revenue" lede="Occupancy, rate, and channel performance at a glance." />
        <DeptDropdown />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginTop: 32 }}>
        {LINKS.map(l => (
          <a key={l.href} href={l.href} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '20px 24px',
              transition: 'box-shadow .15s',
            }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-xl)', fontStyle: 'italic', color: 'var(--brass)', marginBottom: 6 }}>
                {l.label}
              </div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 'var(--t-sm)', color: 'var(--muted)' }}>
                {l.desc}
              </div>
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
