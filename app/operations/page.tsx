import PageHeader from '@/components/layout/PageHeader';
import DeptDropdown from '@/components/nav/DeptDropdown';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const LINKS = [
  { label: 'Housekeeping', href: '/operations/housekeeping', desc: 'Room status, task completion & scores' },
  { label: 'Maintenance',  href: '/operations/maintenance',  desc: 'Open work orders & preventive schedule' },
  { label: 'Restaurant',   href: '/operations/restaurant',   desc: 'F&B revenue, cost & covers' },
  { label: 'Payroll',      href: '/operations/payroll',      desc: 'Headcount, wages & benefits by dept' },
];

export default function OperationsPage() {
  return (
    <main style={{ padding: '32px 40px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <PageHeader pillar="Operations" tab="" title="Operations" lede="Rooms, restaurant, and team — all in one view." />
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
