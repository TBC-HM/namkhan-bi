// app/marketing/channels/page.tsx
// PBS 2026-07-21 · Channels hub — socials, youtube, digital.
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
  { label: 'Socials', href: '/marketing/social',             footer: 'Instagram · Facebook · TikTok · X' },
  { label: 'YouTube', href: '/marketing/youtube/dashboard',  footer: 'Channel · uploads · renders' },
  { label: 'Digital', href: '/marketing/digital',            footer: 'Web · funnels · SEO' },
];

export default function ChannelsHubPage() {
  const cfg = DEPT_CFG.marketing;
  const tabs: DashboardTab[] = cfg.subPages.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/channels',
  }));

  return (
    <DashboardPage title="Marketing · Channels" subtitle="Where we show up — socials, YouTube, digital surfaces." tabs={tabs}>
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
