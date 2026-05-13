// app/sales/leads/scraping/page.tsx
// PBS 2026-05-09: "IN THE LEADS AREA DESIGN THE WHOLE CONCEPT IN BACKEND AND
// FRONTEND THAT WE CAN UPLOAD LEADS WE HAVE AND THE WHOLE LEAD GENERATION
// SCRAPING CONCEPT IS INTEGRATED."
//
// Concept page that exposes the pipeline (Discover → Enrich → Score → Outreach)
// alongside live counts from sales.prospects + sales_targeting.framework so PBS
// can see what's wired and what's still TODO. Upload CTA points at the existing
// /api/sales/prospects/import endpoint.

import Link from 'next/link';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import ArtifactActions from '@/components/page/ArtifactActions';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { SALES_SUBPAGES } from '../../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface ProspectAggregates {
  total: number;
  by_status: Record<string, number>;
  by_source: Array<{ source: string; n: number }>;
  recent: Array<{ id: number; name: string | null; company: string | null; status: string | null; source: string | null; created_at: string }>;
  enriched_pct: number;
  scored_pct: number;
}

interface FrameworkAgg {
  framework: string;
  items: number;
}

async function getProspectAggregates(): Promise<ProspectAggregates> {
  const sb = getSupabaseAdmin();
  const { data, count } = await sb
    .schema('sales')
    .from('prospects')
    .select('id,name,company,status,source,enrichment_data,score,created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(500);
  const rows = (data ?? []) as Array<{ id: number; name: string | null; company: string | null; status: string | null; source: string | null; enrichment_data: any; score: number | null; created_at: string }>;
  const total = count ?? rows.length;
  const by_status: Record<string, number> = {};
  const sourceMap = new Map<string, number>();
  let enriched = 0;
  let scored = 0;
  for (const r of rows) {
    const s = r.status ?? 'unknown';
    by_status[s] = (by_status[s] ?? 0) + 1;
    const src = r.source ?? '(unknown)';
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
    if (r.enrichment_data && Object.keys(r.enrichment_data ?? {}).length > 0) enriched++;
    if (r.score != null) scored++;
  }
  return {
    total,
    by_status,
    by_source: Array.from(sourceMap.entries())
      .map(([source, n]) => ({ source, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10),
    recent: rows.slice(0, 20).map((r) => ({ id: r.id, name: r.name, company: r.company, status: r.status, source: r.source, created_at: r.created_at })),
    enriched_pct: total > 0 ? (enriched / Math.min(rows.length, total)) * 100 : 0,
    scored_pct:   total > 0 ? (scored   / Math.min(rows.length, total)) * 100 : 0,
  };
}

async function getFrameworkAgg(): Promise<FrameworkAgg[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .schema('sales_targeting')
    .from('framework')
    .select('framework');
  const m = new Map<string, number>();
  for (const r of (data ?? []) as Array<{ framework: string }>) {
    m.set(r.framework, (m.get(r.framework) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .map(([framework, items]) => ({ framework, items }))
    .sort((a, b) => b.items - a.items);
}

const PIPELINE_STAGES = [
  {
    key: 'discover',
    label: '1 · Discover',
    desc: 'ICP-driven scraping (yoga studios SEA, retreat hosts, luxury advisors). Manual upload too.',
    sources: 'Google Maps, Instagram, Mindbody, Retreat Guru, LinkedIn, agency websites.',
    status: 'wired (manual)',
  },
  {
    key: 'enrich',
    label: '2 · Enrich',
    desc: 'Add decision-maker, audience size, retreat history, price level, social handles.',
    sources: 'Website about pages, LinkedIn, social profiles, retreat platforms.',
    status: 'partial (manual, agent in design)',
  },
  {
    key: 'score',
    label: '3 · Score',
    desc: 'Fit + intent + reachable DM + audience quality + retreat alignment.',
    sources: 'sales_targeting.framework (50 items, 10 frameworks).',
    status: 'partial (rule-based)',
  },
  {
    key: 'outreach',
    label: '4 · Outreach',
    desc: 'AI-assisted draft, human approval, send. Track replies + conversion.',
    sources: 'sales.email_drafts, sales.email_messages, sales.inquiry_status.',
    status: 'wired',
  },
];

export default async function LeadScrapingPage() {
  const [agg, frameworks] = await Promise.all([getProspectAggregates(), getFrameworkAgg()]);

  return (
    <Page
      eyebrow="Sales · Leads · Scraping"
      title={<>Lead generation <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>concept</em></>}
      subPages={SALES_SUBPAGES}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={agg.total}                         unit="count" label="Prospects"        tooltip="Total rows in sales.prospects." />
        <KpiBox value={agg.by_status['contacted'] ?? 0}   unit="count" label="Contacted"        tooltip="Prospects with status = contacted." />
        <KpiBox value={agg.by_status['replied'] ?? 0}     unit="count" label="Replied"          tooltip="Prospects with status = replied." />
        <KpiBox value={agg.by_status['won'] ?? 0}         unit="count" label="Won"               tooltip="Prospects converted to a confirmed booking (status = won)." />
        <KpiBox value={agg.enriched_pct}                  unit="pct"   label="Enriched %"       tooltip="Sample of latest 500: enrichment_data ≠ {}." />
        <KpiBox value={agg.scored_pct}                    unit="pct"   label="Scored %"         tooltip="Sample of latest 500: score IS NOT NULL." />
        <KpiBox value={frameworks.reduce((s, f) => s + f.items, 0)} unit="count" label="Targeting items" tooltip="Rows in sales_targeting.framework — the AI agent's reference dictionary." />
      </div>

      <Panel
        title="Pipeline · Discover → Enrich → Score → Outreach"
        eyebrow="concept"
        actions={<ArtifactActions context={{ kind: 'panel', title: 'Lead generation pipeline', dept: 'sales' }} />}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {PIPELINE_STAGES.map((s) => (
            <div key={s.key} style={{
              background: '#0f0d0a', border: '1px solid #1f1c15', borderRadius: 6, padding: 12,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
                color: '#a8854a', fontWeight: 700,
              }}>{s.label}</div>
              <div style={{ color: 'var(--ink)', fontSize: 13 }}>{s.desc}</div>
              <div style={{ fontSize: 11, color: '#9b907a' }}>{s.sources}</div>
              <div style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 10, color: s.status.startsWith('wired') ? '#7ad790' : 'var(--brass-soft)',
                background: s.status.startsWith('wired') ? '#1a2e21' : '#2a261d',
                padding: '2px 8px', borderRadius: 3, alignSelf: 'flex-start',
                textTransform: 'uppercase', letterSpacing: '0.10em', fontWeight: 700,
              }}>{s.status}</div>
            </div>
          ))}
        </div>
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title="Quick actions" eyebrow="upload + manage">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Link href="/sales/leads" style={S.cta}>← Back to Leads</Link>
          <Link href="/sales/leads?import=1" style={S.ctaPrimary}>↑ Import CSV</Link>
          <Link href="/sales/btb" style={S.cta}>BTB partners</Link>
          <Link href="/messy-data" style={S.cta}>Data-quality gaps</Link>
        </div>
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title="Targeting framework · sales_targeting" eyebrow={`${frameworks.reduce((s, f) => s + f.items, 0)} items across ${frameworks.length} frameworks`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          {frameworks.map((f) => (
            <div key={f.framework} style={{
              background: '#0f0d0a', border: '1px solid #1f1c15', borderRadius: 6,
              padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ color: 'var(--line-soft)', fontSize: 12 }}>{f.framework}</span>
              <span style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 11, color: '#a8854a', fontWeight: 700,
              }}>{f.items}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: '#7d7565' }}>
          Read by: <code style={{ color: '#a8854a' }}>v_sales_targeting_framework</code>,{' '}
          <code style={{ color: '#a8854a' }}>v_sales_targeting_overview</code>. Used by the lead-scraping
          + outreach + brand-copy agents.
        </div>
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title="Top prospect sources (latest 500)" eyebrow="sales.prospects.source">
        {agg.by_source.length === 0 ? (
          <div style={{ padding: 24, color: '#7d7565', fontStyle: 'italic', textAlign: 'center' }}>No prospects yet. Use the Import CSV CTA to seed.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Source</th>
                  <th className="num">Prospects</th>
                </tr>
              </thead>
              <tbody>
                {agg.by_source.map((s) => (
                  <tr key={s.source}>
                    <td className="lbl">{s.source}</td>
                    <td className="num">{s.n.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title="Latest prospects" eyebrow={`${agg.recent.length} most recent`}>
        {agg.recent.length === 0 ? (
          <div style={{ padding: 24, color: '#7d7565', fontStyle: 'italic', textAlign: 'center' }}>No recent prospects.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {agg.recent.map((r) => (
                  <tr key={r.id}>
                    <td className="lbl"><strong>{r.name ?? '—'}</strong></td>
                    <td className="lbl text-mute">{r.company ?? '—'}</td>
                    <td className="lbl text-mute">{r.source ?? '—'}</td>
                    <td className="lbl">{r.status ?? '—'}</td>
                    <td className="lbl text-mute">{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Page>
  );
}

const S: Record<string, React.CSSProperties> = {
  cta: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 700,
    color: 'var(--line-soft)', background: 'transparent',
    border: '1px solid #2a2520', padding: '6px 12px', borderRadius: 4, textDecoration: 'none',
  },
  ctaPrimary: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 700,
    color: '#0a0a0a', background: '#a8854a',
    border: '1px solid #2a2520', padding: '6px 12px', borderRadius: 4, textDecoration: 'none',
  },
};
