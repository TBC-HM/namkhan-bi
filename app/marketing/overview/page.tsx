// app/marketing/overview/page.tsx
// PBS 2026-07-07 evening: dedicated Marketing Overview landing. The HoD chat
// cockpit stays at /marketing; Overview is the dept-wide summary with
// Info + Reports sub-tabs rendered by DashboardPage.
import Link from 'next/link';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';

export default function MarketingOverviewPage() {
  const cfg = DEPT_CFG.marketing;
  const tabs: DashboardTab[] = cfg.subPages.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/overview',
  }));

  return (
    <DashboardPage title="Marketing · Overview" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
        <Container title="Info" subtitle="reference dossier — segments, markets, taxonomy" density="compact">
          <div style={desc}>
            Everything you need to interpret the numbers below — definitions, source rules, dates.
            <div style={{ marginTop: 8 }}>
              <Link href="/marketing/library" style={btn}>Open Info →</Link>
            </div>
          </div>
        </Container>

        <Container title="Reports" subtitle="printable + shareable summaries" density="compact">
          <div style={desc}>
            Pre-built report renderers: monthly · campaign · channel mix · retreats · newsletters.
            <div style={{ marginTop: 8 }}>
              <Link href="/h/260955/reports?dept=marketing" style={btn}>Open Reports →</Link>
            </div>
          </div>
        </Container>

        <Container title="Acquisition" subtitle="where new bookings come from" density="compact">
          <div style={desc}>
            Campaigns · funnels · prospects — the demand-generation engine.
            <div style={{ marginTop: 8 }}>
              <Link href="/marketing/acquisition" style={btn}>Open Acquisition →</Link>
            </div>
          </div>
        </Container>

        <Container title="Products & Offers" subtitle="the sellable inventory" density="compact">
          <div style={desc}>
            Packages · retreats · seasonal deals — build them in Compiler.
            <div style={{ marginTop: 8 }}>
              <Link href="/marketing/offers" style={btn}>Open Products & Offers →</Link>
            </div>
          </div>
        </Container>

        <Container title="Content" subtitle="creative + distribution surfaces" density="compact">
          <div style={desc}>
            Media library + social calendars — one shelf for everything that ships.
            <div style={{ marginTop: 8 }}>
              <Link href="/marketing/content" style={btn}>Open Content →</Link>
            </div>
          </div>
        </Container>

        <Container title="Digital" subtitle="website + booking-engine funnel" density="compact">
          <div style={desc}>
            Web traffic · conversion · GBP · integrations.
            <div style={{ marginTop: 8 }}>
              <Link href="/marketing/digital" style={btn}>Open Digital →</Link>
            </div>
          </div>
        </Container>

        <Container title="Library" subtitle="brand + playbooks + docs" density="compact">
          <div style={desc}>
            Guidelines · historical decks · SOPs.
            <div style={{ marginTop: 8 }}>
              <Link href="/marketing/library" style={btn}>Open Library →</Link>
            </div>
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}

const desc: React.CSSProperties = { fontSize: 12, color: '#3A3A3A', lineHeight: 1.55, padding: '4px 2px' };
const btn: React.CSSProperties = { display: 'inline-block', padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#FFFFFF', color: '#1F3A2E', border: '1px solid #1F3A2E', borderRadius: 3, textDecoration: 'none' };
