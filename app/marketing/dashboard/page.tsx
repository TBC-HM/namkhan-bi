// app/marketing/dashboard/page.tsx
// PBS 2026-07-05: replaced legacy EngineDashboard shell with a marketing-manager landing
// that just links to the sub-tools (this old page duplicated /marketing HoD landing).
// Keeping URL alive so existing bookmarks don't 404, but pointing users to the right tools.
import Link from 'next/link';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const CREAM='#F7F0E1'; const GREEN='#084838'; const AMBER='#C28F2C';

const LINKS = [
  { label: 'Marketing HoD',   href: '/marketing',           desc: 'Attention · my reports · my tasks · bug queue' },
  { label: 'Campaigns',       href: '/marketing/campaigns', desc: 'Draft · schedule · publish campaigns' },
  { label: 'Prospects',       href: '/marketing/prospects', desc: 'Lead list + email sequences for never-stayed contacts' },
  { label: 'Guest newsletters', href: '/guest/newsletters', desc: 'Post-stay + editorial newsletters to actual guests' },
  { label: 'Growth funnels',  href: '/marketing/funnels',   desc: 'AI funnel growth cockpit (Phase 1 static)' },
  { label: 'Media library',   href: '/marketing/gallery',   desc: 'All photos + videos · tier + area filter' },
  { label: 'Docs',            href: '/marketing/docs',      desc: 'Brand · campaigns · partners · collateral' },
  { label: 'Social',          href: '/marketing/social',    desc: 'IG · FB · TikTok schedule + engagement' },
  { label: 'Web',             href: '/marketing/web',       desc: 'Website performance + funnels + SEO' },
  { label: 'Audiences',       href: '/marketing/audiences', desc: 'Segments · ICP profiles · addressable' },
  { label: 'Events',          href: '/marketing/events',    desc: 'Calendar · Baci · workshops · retreats' },
  { label: 'Agents',          href: '/marketing/agents',    desc: 'Autonomous brand + reputation agents' },
];

export default function DashboardPage_() {
  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing',
  }));
  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage title="Marketing · Dashboard" subtitle="Every marketing tool in one place · use HoD for daily attention" tabs={tabs}>
        <div style={{ gridColumn:'1 / -1', padding:'10px 14px', background:'#FFF4D6', border:'1px solid '+AMBER, borderRadius:4, fontSize:12, color:INK }}>
          <strong>Note.</strong> This page used to host the old EngineDashboard (6 legacy views). It duplicated <Link href="/marketing" style={{ color:GREEN }}>Marketing HoD</Link>. Kept alive as a directory to the current tools. Delete when nothing links here.
        </div>
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:10 }}>
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:6, padding:'14px 16px', textDecoration:'none', color:INK, display:'flex', flexDirection:'column', gap:4 }}>
              <div style={{ fontSize:13, fontWeight:600, color:GREEN }}>{l.label} →</div>
              <div style={{ fontSize:12, color:INK_M, lineHeight:1.5 }}>{l.desc}</div>
            </Link>
          ))}
        </div>
      </DashboardPage>
    </div>
  );
}
