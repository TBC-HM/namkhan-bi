// app/messy-data/page.tsx
// PBS 2026-05-09 #7: "we have this messy data in some areas (guest, POS
// transactions, QB account mapping). Can you make some tabs in this 'messy
// data' page and we consolidate everything which is messy here and on the
// pages from where they originate we make a link …messy data…"
//
// Single page that surfaces every known data-quality gap, grouped by source.
// Reads dq_known_issues and adds a few hand-picked Cloudbeds/QB/marketing
// gaps that are not yet logged there but visibly affect the UI today.

import Link from 'next/link';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import ArtifactActions from '@/components/page/ArtifactActions';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface DqIssue {
  id: number;
  category: string;
  severity: string;
  description: string;
  detection_query: string | null;
  fix_owner: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

interface ManualGap {
  area: 'guest' | 'finance' | 'marketing' | 'operations' | 'pricing' | 'cloudbeds';
  title: string;
  why: string;
  origin_link: { label: string; href: string };
  severity: 'critical' | 'high' | 'medium' | 'low';
  fix_owner: string;
}

// Hand-curated list of "messy data" knowns that PBS calls out repeatedly.
// Each item should disappear once its source page is fixed and the gap is
// either solved or recorded as a dq_known_issues row.
const MANUAL_GAPS: ManualGap[] = [
  {
    area: 'cloudbeds',
    title: 'Guest emails / phones not synced',
    why: 'public.reservations and guest.mv_guest_profile have NULL email/phone for most guests; Cloudbeds sync doesn\'t expose contact fields. Blocks /guest contactable + customer-profile drawer.',
    origin_link: { label: '/guest/directory', href: '/guest/directory' },
    severity: 'high',
    fix_owner: 'Cloudbeds integration',
  },
  {
    area: 'cloudbeds',
    title: 'Guest city not synced',
    why: 'guest.mv_guest_profile.city has 0 distinct values. Blocks city facet in /guest/directory.',
    origin_link: { label: '/guest/directory', href: '/guest/directory' },
    severity: 'medium',
    fix_owner: 'Cloudbeds integration',
  },
  {
    area: 'finance',
    title: 'POS transactions raw vs. classified mismatch',
    why: 'Some POS rows in public.transactions are not classified into mv_classified_transactions (USALI dept/subdept missing).',
    origin_link: { label: '/finance/pos-transactions', href: '/finance/pos-transactions' },
    severity: 'medium',
    fix_owner: 'Finance data team',
  },
  {
    area: 'finance',
    title: 'QB account mapping incomplete',
    why: 'New QB accounts appear without USALI mapping → falls into "Other / unmapped" buckets. Audit weekly.',
    origin_link: { label: '/finance/account-mapping', href: '/finance/account-mapping' },
    severity: 'medium',
    fix_owner: 'Finance data team',
  },
  {
    area: 'marketing',
    title: 'Reviews table empty',
    why: 'marketing.reviews has 0 rows; review widgets on /guest/reputation render empty.',
    origin_link: { label: '/guest/reputation', href: '/guest/reputation' },
    severity: 'high',
    fix_owner: 'Marketing data team',
  },
  {
    area: 'marketing',
    title: 'Campaigns + influencers tables empty',
    why: 'marketing.campaigns and marketing.influencers have 0 rows; calendar widgets blank.',
    origin_link: { label: '/marketing/campaigns', href: '/marketing/campaigns' },
    severity: 'medium',
    fix_owner: 'Marketing ops',
  },
  {
    area: 'operations',
    title: 'No room_status table',
    why: '/operations/housekeeping page expects public.room_status; table does not exist. Page renders empty until housekeeping cron lands.',
    origin_link: { label: '/operations/housekeeping', href: '/operations/housekeeping' },
    severity: 'high',
    fix_owner: 'Ops integrations',
  },
  {
    area: 'operations',
    title: 'Suppliers register empty',
    why: 'suppliers.suppliers has 0 rows; new /operations/suppliers tab shows empty register until populated.',
    origin_link: { label: '/operations/suppliers', href: '/operations/suppliers' },
    severity: 'medium',
    fix_owner: 'Ops procurement',
  },
];

const SEVERITY_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  critical: { bg: '#3a1f1c', fg: '#ff8a8a', label: 'critical' },
  high:     { bg: '#3a2a1c', fg: '#f4c179', label: 'high'     },
  medium:   { bg: '#2a261d', fg: '#d8cca8', label: 'medium'   },
  low:      { bg: '#1a1812', fg: '#9b907a', label: 'low'      },
};

async function getDqIssues(): Promise<DqIssue[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('dq_known_issues')
    .select('id,category,severity,description,detection_query,fix_owner,status,notes,created_at')
    .neq('status', 'fixed')
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error('getDqIssues error', error);
    return [];
  }
  return (data ?? []) as DqIssue[];
}

export default async function MessyDataPage() {
  const dqIssues = await getDqIssues();

  const totalGaps = MANUAL_GAPS.length + dqIssues.length;
  const critical =
    MANUAL_GAPS.filter((g) => g.severity === 'critical').length +
    dqIssues.filter((i) => i.severity === 'critical').length;
  const high =
    MANUAL_GAPS.filter((g) => g.severity === 'high').length +
    dqIssues.filter((i) => i.severity === 'high').length;
  const byArea = MANUAL_GAPS.reduce<Record<string, number>>((acc, g) => {
    acc[g.area] = (acc[g.area] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Page
      eyebrow="Cross-cutting · Data quality"
      title={<>Messy <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>data</em></>}
    >
      <div style={{ marginBottom: 14, fontSize: 13, color: '#9b907a', maxWidth: 760 }}>
        One page for every known gap that visibly breaks a tile, table, or chart elsewhere in the
        dashboard. Each row links back to the page it originates from. Add formal entries to
        <code style={{ margin: '0 4px', color: '#d8cca8' }}>public.dq_known_issues</code>
        once an owner accepts ownership.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={totalGaps} unit="count" label="Open gaps"      tooltip="dq_known_issues + curated manual list" />
        <KpiBox value={critical}  unit="count" label="Critical"       tooltip="severity = critical" />
        <KpiBox value={high}      unit="count" label="High"           tooltip="severity = high" />
        <KpiBox value={Object.keys(byArea).length} unit="count" label="Areas affected" tooltip="Distinct affected areas across both lists (Cloudbeds, finance, marketing, ops, pricing)." />
        <KpiBox value={MANUAL_GAPS.length} unit="count" label="Manual gaps"     tooltip="Curated cross-page gaps known to Claude — see panel below for origin links." />
        <KpiBox value={dqIssues.length}    unit="count" label="dq_known_issues" tooltip="Open rows in public.dq_known_issues (status != fixed)." />
      </div>

      <Panel
        title="Curated cross-page gaps"
        eyebrow="manual list · linked back to origin page"
        actions={<ArtifactActions context={{ kind: 'panel', title: 'Messy data · curated', dept: 'finance' }} />}
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Area</th>
                <th>Title</th>
                <th>Why it matters</th>
                <th>Origin</th>
                <th>Severity</th>
                <th>Fix owner</th>
              </tr>
            </thead>
            <tbody>
              {MANUAL_GAPS.map((g) => {
                const tone = SEVERITY_TONE[g.severity];
                return (
                  <tr key={`${g.area}-${g.title}`}>
                    <td className="lbl">
                      <span style={{
                        background: '#1a1812', color: '#a8854a',
                        padding: '2px 8px', borderRadius: 4,
                        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                        textTransform: 'uppercase', letterSpacing: '0.10em',
                      }}>{g.area}</span>
                    </td>
                    <td className="lbl"><strong>{g.title}</strong></td>
                    <td className="lbl text-mute" style={{ maxWidth: 480 }}>{g.why}</td>
                    <td className="lbl">
                      <Link href={g.origin_link.href} style={{ color: 'var(--brass)', textDecoration: 'none', fontWeight: 600 }}>
                        {g.origin_link.label} →
                      </Link>
                    </td>
                    <td className="lbl">
                      <span style={{
                        background: tone.bg, color: tone.fg,
                        padding: '2px 8px', borderRadius: 4,
                        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                        textTransform: 'uppercase', letterSpacing: '0.10em', fontWeight: 600,
                      }}>{tone.label}</span>
                    </td>
                    <td className="lbl text-mute">{g.fix_owner}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div style={{ height: 14 }} />

      <Panel
        title="dq_known_issues · live registry"
        eyebrow={`${dqIssues.length} open`}
        actions={<ArtifactActions context={{ kind: 'panel', title: 'Messy data · dq_known_issues', dept: 'finance' }} />}
      >
        {dqIssues.length === 0 ? (
          <div style={{ padding: 24, color: '#7d7565', fontStyle: 'italic', textAlign: 'center' }}>
            No formal DQ issues recorded.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Description</th>
                  <th>Owner</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {dqIssues.map((i) => {
                  const tone = SEVERITY_TONE[i.severity] ?? SEVERITY_TONE.medium;
                  return (
                    <tr key={i.id}>
                      <td className="lbl text-mute">{i.category}</td>
                      <td className="lbl">
                        <span style={{
                          background: tone.bg, color: tone.fg,
                          padding: '2px 8px', borderRadius: 4,
                          fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                          textTransform: 'uppercase', letterSpacing: '0.10em', fontWeight: 600,
                        }}>{tone.label}</span>
                      </td>
                      <td className="lbl" style={{ maxWidth: 640 }}>{i.description}</td>
                      <td className="lbl text-mute">{i.fix_owner ?? '—'}</td>
                      <td className="lbl text-mute">{i.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Page>
  );
}
