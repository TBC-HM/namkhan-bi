// app/marketing/audience/page.tsx
// PBS 2026-07-21 · Audience hub — links to Subscribers, Prospects, Sequences, Scrape, Candidates.
// Zero URL migrations: every card just points at an existing page.
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_S = '#5A5A5A';

interface Card { label: string; href: string; footer: string }

const CARDS: Card[] = [
  { label: 'Subscribers',     href: '/marketing/subscribers',                 footer: '827 newsletter list' },
  { label: 'Prospects',       href: '/marketing/prospects',                   footer: '1300+ outbound targets' },
  { label: 'Sequences',       href: '/marketing/prospects/sequences',         footer: 'Enrollment + preview + schedule' },
  { label: 'Scrape engine',   href: '/marketing/prospects/scrape',            footer: 'Import from URL' },
  { label: 'Candidates pool', href: '/marketing/subscribers?tab=candidates',  footer: 'Raw Gmail-extracted pool' },
];

export default function AudienceHubPage() {
  const cfg = DEPT_CFG.marketing;
  const tabs: DashboardTab[] = cfg.subPages.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/audience',
  }));

  return (
    <DashboardPage title="Marketing · Audience" subtitle="People we can reach — subscribers, prospects, sequences." tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {CARDS.map(card => (
          <a
            key={card.href}
            href={card.href}
            style={{
              display: 'block', padding: 20, background: WHITE, border: `1px solid ${HAIR}`,
              borderRadius: 4, textDecoration: 'none', color: INK,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 500 }}>{card.label}</div>
            <div style={{ fontSize: 11, color: INK_S, marginTop: 6 }}>{card.footer}</div>
          </a>
        ))}
      </div>
    </DashboardPage>
  );
}
