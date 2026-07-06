// app/marketing/prospects/scrape/page.tsx
// PBS 2026-07-06: One-click scraper — pick actor, enter keywords/URLs, results land in prospects.
import Link from 'next/link';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import ScrapeForm from './_components/ScrapeForm';

export const dynamic = 'force-dynamic';

export default function ScrapePage() {
  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/prospects',
  }));

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage
        title="Marketing · Prospects · Scrape"
        subtitle="Pick an actor · enter keywords or URLs · results land in prospects automatically"
        tabs={tabs}
      >
        <div style={{ gridColumn:'1 / -1' }}>
          <Link href="/marketing/prospects" style={{ fontSize:12, color:'#084838', textDecoration:'none', fontWeight:600 }}>
            ← Back to prospects
          </Link>
        </div>
        <div style={{ gridColumn:'1 / -1' }}>
          <ScrapeForm />
        </div>
      </DashboardPage>
    </div>
  );
}