// app/marketing/content/page.tsx
// PBS 2026-07-21 · Content hub — offers, compiler, campaigns, newsletter, media.
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
  { label: 'Products & Offers', href: '/marketing/offers',     footer: 'Sellable products + offer catalogue' },
  { label: 'Compiler',          href: '/marketing/compiler',   footer: 'Assemble briefs + long-form content' },
  { label: 'Campaigns',         href: '/marketing/campaigns',  footer: 'Wizard + scheduling + tracking' },
  { label: 'Newsletter',        href: '/marketing/newsletter', footer: 'Broadcast to subscribers' },
  { label: 'Media',             href: '/marketing/media',      footer: 'Photo + video library' },
];

export default function ContentHubPage() {
  const cfg = DEPT_CFG.marketing;
  const tabs: DashboardTab[] = cfg.subPages.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/content',
  }));

  return (
    <DashboardPage title="Marketing · Content" subtitle="What we ship — offers, campaigns, newsletters, media." tabs={tabs}>
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
