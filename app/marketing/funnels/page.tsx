// app/marketing/funnels/page.tsx
// PBS 2026-07-05: restored — Growth funnels / CRO dashboard (was hijacked by email sequences by mistake).
// Email sequences moved to /marketing/prospects/sequences. This page is the growth cockpit,
// currently Phase-1 hardcoded until GA4 + Cloudbeds funnel wiring lands.
import Link from 'next/link';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

export default function GrowthFunnelsPage() {
  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/funnels',
  }));

  const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const CREAM='#F7F0E1'; const AMBER='#C28F2C';

  const tiles: KpiTileProps[] = [
    { label: 'Website CVR',  value: '2.7 %', size: 'sm', footnote: 'session → lead' },
    { label: 'Booking CVR',  value: '8.8 %', size: 'sm', footnote: 'lead → booking' },
    { label: 'Mobile share', value: '64 %',  size: 'sm', footnote: 'of sessions' },
    { label: 'Revenue leak', value: '12 %',  size: 'sm', status: 'red', footnote: 'estimate' },
    { label: 'Active tests', value: 3,        size: 'sm' },
    { label: 'Code fixes',   value: 8,        size: 'sm', footnote: 'queued' },
  ];

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage
        title="Marketing · Growth funnels"
        subtitle="Website → lead → booking · Phase 1 hardcoded until GA4 + Cloudbeds wiring lands"
        tabs={tabs}
      >
        <div style={{ gridColumn:'1 / -1', padding:'10px 14px', background:'#FFF4D6', border:'1px solid '+AMBER, borderRadius:4, fontSize:12, color:INK, lineHeight:1.6 }}>
          <strong>HARDCODED DATA · Phase 1.</strong> Numbers below are placeholders. Live wiring needs GA4 (sessions, CVR, mobile share) + Cloudbeds booking-engine attribution + Search Console for SEO signals. If you want to nurture email leads (never-stayed prospects), that lives at <Link href="/marketing/prospects" style={{ color:'#084838' }}>Prospects → Sequences</Link>.
        </div>

        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        <div style={{ gridColumn:'1 / -1', border:'1px solid '+HAIR, borderRadius:6, padding:14, background:'#FFFFFF' }}>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:INK_M, marginBottom:8 }}>
            Customer journey
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:10, fontSize:12 }}>
            {[
              ['Awareness', 'Social · SEO · PR', '84k sessions'],
              ['Consideration', 'Room detail views · Retreat pages', '22k'],
              ['Lead', 'Enquiry · Newsletter signup', '600'],
              ['Booking', 'BE-completed reservation', '53'],
              ['Repeat', 'Post-stay return code', '9'],
            ].map(([stage, source, n]) => (
              <div key={stage} style={{ padding:10, background:CREAM, border:'1px solid '+HAIR, borderRadius:4 }}>
                <div style={{ fontWeight:600 }}>{stage}</div>
                <div style={{ color:INK_M, marginTop:2 }}>{source}</div>
                <div style={{ marginTop:4, fontVariantNumeric:'tabular-nums' }}>{n}</div>
              </div>
            ))}
          </div>
        </div>
      </DashboardPage>
    </div>
  );
}
