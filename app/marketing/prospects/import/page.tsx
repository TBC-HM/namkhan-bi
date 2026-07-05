// app/marketing/prospects/import/page.tsx
// PBS 2026-07-05: CSV paste import — with automatic domain-based email enrichment.
import Link from 'next/link';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../../_subpages';
import ImportClient from './_components/ImportClient';

export const dynamic = 'force-dynamic';

export default function ProspectsImportPage() {
  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/prospects',
  }));

  const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const CREAM='#F7F0E1';

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage
        title="Marketing · Prospects · Import CSV"
        subtitle="Paste your list — I'll normalise, enrich, dedupe, and tag it"
        tabs={tabs}
      >
        <div style={{ gridColumn:'1 / -1' }}>
          <Link href="/marketing/prospects" style={{ fontSize:12, color:'#084838', textDecoration:'none', fontWeight:600 }}>
            ← Back to prospects
          </Link>
        </div>

        <div style={{ gridColumn:'1 / -1', background:CREAM, border:'1px solid '+HAIR, borderRadius:6, padding:14, fontSize:12, lineHeight:1.6, color:INK }}>
          <div style={{ fontWeight:600, marginBottom:6 }}>Expected columns (any order, header row required):</div>
          <code style={{ display:'block', padding:8, background:'#FFFFFF', border:'1px solid '+HAIR, borderRadius:3, fontSize:11 }}>
            full_name, email, phone, country, company, website, notes
          </code>
          <div style={{ marginTop:10, color:INK_M }}>
            <strong>How enrichment works:</strong>
            <ul style={{ margin:'6px 0 0', paddingLeft:18 }}>
              <li>Row has a valid <code>email</code> → kept as-is</li>
              <li>Row has a <code>website</code> but no email → I guess <code>info@&lt;domain&gt;</code> and mark it unverified</li>
              <li>Row has a <code>phone</code> but no email or website → kept as phone-only contact (not enrolled in funnels)</li>
              <li>Row has none of the above → <strong>dropped</strong> and shown back to you in the summary</li>
            </ul>
          </div>
        </div>

        <div style={{ gridColumn:'1 / -1' }}>
          <ImportClient />
        </div>
      </DashboardPage>
    </div>
  );
}
