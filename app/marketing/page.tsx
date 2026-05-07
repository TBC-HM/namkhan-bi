import PageHeader from '@/components/layout/PageHeader';
import DeptDropdown from '@/components/nav/DeptDropdown';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const LINKS = [
  { label: 'Campaigns',   href: '/marketing/campaigns',   desc: 'Active promotions & spend tracking' },
  { label: 'Channels',    href: '/marketing/channels',    desc: 'OTA, direct, social traffic breakdown' },
  { label: 'Content',     href: '/marketing/content',     desc: 'Asset library & DAM' },
  { label: 'Analytics',   href: '/marketing/analytics',   desc: 'Web & social performance metrics' },
];

export default function MarketingPage() {
  return (
    <main style={{ padding: '32px 40px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <PageHeader pillar="Marketing" tab="" title="Marketing" lede="Campaigns, channels, and content that convert." />
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
