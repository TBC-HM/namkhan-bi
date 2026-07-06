// app/revenue/[stub]/page.tsx
// PBS 2026-07-06 late evening: catch-all landing stub for the new Revenue sub-tabs.
// Next.js prefers static routes over dynamic — existing pages like /revenue/pulse,
// /revenue/pace, /revenue/channels, etc. keep their own page.tsx and are unaffected.
// Only new tabs (info, acquisition, campaigns, funnels, prospects, offers, compiler,
// content, media, social, digital, web, library, docs) hit this stub.

import { notFound } from 'next/navigation';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';

export const dynamic = 'force-dynamic';

const KNOWN_STUBS: Record<string, { title: string; blurb: string }> = {
  info:        { title: 'Info',              blurb: 'Reference dossier — segments, markets, taxonomy, definitions.' },
  acquisition: { title: 'Acquisition',       blurb: 'Where new bookings come from — paid, organic, referral, direct.' },
  campaigns:   { title: 'Campaigns',         blurb: 'Campaign performance — ROAS, attributions, cohort tracking.' },
  funnels:     { title: 'Funnels',           blurb: 'Booking funnel steps — from visit to confirmed reservation.' },
  prospects:   { title: 'Prospects',         blurb: 'Lead pool that hasn\'t booked yet — enrichment + nurture.' },
  offers:      { title: 'Products & Offers', blurb: 'Packages, retreats, seasonal deals — the sellable inventory.' },
  compiler:    { title: 'Compiler',          blurb: 'Assemble briefs + creative packs for distribution.' },
  content:     { title: 'Content',           blurb: 'Content library — briefs, calendars, editorial pipeline.' },
  media:       { title: 'Media',             blurb: 'Media library — photos, videos, downloadable assets.' },
  social:      { title: 'Social',            blurb: 'Social channels performance and post scheduling.' },
  digital:     { title: 'Digital',           blurb: 'Digital surfaces — website, GBP, mobile, integrations.' },
  web:         { title: 'Web',               blurb: 'Website traffic, conversion, booking-engine funnel.' },
  library:     { title: 'Library',           blurb: 'Marketing library — brand, guidelines, historical decks.' },
  docs:        { title: 'Docs',              blurb: 'Docs & playbooks for the revenue team.' },
};

interface Props { params: { stub: string } }

export default function RevenueStubPage({ params }: Props) {
  const def = KNOWN_STUBS[params.stub];
  if (!def) notFound();

  const cfg = DEPT_CFG.revenue;
  const tabs: DashboardTab[] = cfg.subPages.map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === `/revenue/${params.stub}`,
  }));

  return (
    <DashboardPage title={`Revenue · ${def.title}`} subtitle={def.blurb} tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <div style={stub}>
          <div style={stubTitle}>{def.title}</div>
          <div>{def.blurb}</div>
          <div style={stubHint}>Landing placeholder — real page ships in a follow-up push.</div>
        </div>
      </div>
    </DashboardPage>
  );
}

const stub: React.CSSProperties = { padding: '32px 20px', background: '#FAFAF7', border: '1px dashed #E6DFCC', borderRadius: 6, textAlign: 'center', color: '#5A5A5A', fontSize: 12, lineHeight: 1.6 };
const stubTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: '#1B1B1B', marginBottom: 4 };
const stubHint: React.CSSProperties = { marginTop: 12, fontSize: 11, fontStyle: 'italic' };
