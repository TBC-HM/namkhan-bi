// app/marketing/page.tsx
// PBS 2026-07-05: Marketing HoD landing — new paper-white design.
// Full DashboardPage shell (mirrors HodLanding pattern) so the HARDCODED
// banner can sit inside the same page shell as the KPI tiles it warns about.
//
// Data sources:
//   • KPI tiles → DEPT_CFG.marketing.kpiTiles  (STATIC / HARDCODED — flagged)
//   • Attention · Reports (docs)               (STATIC from cfg — flagged)
//   • Tasks                                    (LIVE · v_hod_tasks_due count)
//   • Bugs                                     (LIVE · cockpit_bugs)
//   • Build-a-report                           (STATIC · cfg.reportTypes)
//
// Preserves all functional logic from the previous HodLanding wrapper.

import type { CSSProperties } from 'react';
import TenantLink from '@/components/nav/TenantLink';
import {
  DashboardPage, Container, KpiTile,
  type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { PROPERTY_ID, supabase } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import ReportBuilder from '@/app/revenue/_components/ReportBuilder';
import ReportsList   from '@/app/revenue/_components/ReportsList';
import BugsList      from '@/app/revenue/_components/BugsList';
import HodTasksList  from '@/app/revenue/_components/HodTasksList';
import AttentionList from '@/app/revenue/_components/AttentionList';
import ConclusionBlock from '@/app/_components/ConclusionBlock';
import { evaluateMarketingRules, type MarketingContext, type MarketingTargets } from '@/lib/rules/marketing';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

export default async function MarketingHodPage() {
  const slug = 'marketing' as const;
  const pid = PROPERTY_ID;
  const cfg = DEPT_CFG[slug];

  const [bugsRes, dueTasksRes] = await Promise.all([
    supabase.from('cockpit_bugs')
      .select('id, body, status, created_at, page_url')
      .not('status', 'in', '(closed,resolved,wontfix,done)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('v_hod_tasks_due')
      .select('id', { count: 'exact', head: true })
      .eq('dept_slug', slug)
      .eq('property_id', pid)
      .eq('is_due', true),
  ]);

  const bugs = (bugsRes.data ?? []) as Array<{
    id: number; body: string | null; status: string | null;
    created_at: string | null; page_url: string | null;
  }>;
  const dueTasksCount = dueTasksRes.count ?? 0;

  // PBS 2026-07-07: build marketing conclusion context.
  const sbAdmin = getSupabaseAdmin();
  const targets: MarketingTargets = {};
  try {
    const { data } = await sbAdmin
      .from('guardrails')
      .select('rule_key, threshold_val')
      .eq('property_id', pid).eq('domain', 'marketing').eq('active', true);
    for (const g of (data ?? []) as Array<{ rule_key: string; threshold_val: number | string }>) {
      const n = typeof g.threshold_val === 'string' ? Number(g.threshold_val) : g.threshold_val;
      if (!Number.isFinite(n)) continue;
      if (g.rule_key === 'campaign_cadence_days_min') targets.campaign_cadence_days_min = n;
      else if (g.rule_key === 'cost_per_lead_max') targets.cost_per_lead_max = n;
      else if (g.rule_key === 'prospect_enrichment_min') targets.prospect_enrichment_min = n;
      else if (g.rule_key === 'mx_verified_share_min') targets.mx_verified_share_min = n;
    }
  } catch { /* ignore */ }

  let daysSinceLastCampaignSend: number | null = null;
  let scheduledCampaigns = 0;
  let activeCampaigns = 0;
  try {
    const [{ data: lastSent }, { count: scheduled }, { count: active }] = await Promise.all([
      sbAdmin.from('campaigns').select('sent_at').eq('property_id', pid).not('sent_at', 'is', null).order('sent_at', { ascending: false }).limit(1),
      sbAdmin.from('campaigns').select('id', { head: true, count: 'exact' }).eq('property_id', pid).eq('status', 'scheduled'),
      sbAdmin.from('campaigns').select('id', { head: true, count: 'exact' }).eq('property_id', pid).in('status', ['draft', 'scheduled', 'sending']),
    ]);
    const iso = (lastSent?.[0] as { sent_at?: string } | undefined)?.sent_at;
    if (iso) daysSinceLastCampaignSend = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    scheduledCampaigns = scheduled ?? 0;
    activeCampaigns = active ?? 0;
  } catch { /* ignore */ }

  const mktCtx: MarketingContext = {
    currencySymbol: pid === 1000001 ? '€' : '$',
    daysSinceLastCampaignSend,
    costPerLead: null,
    prospectEnrichmentPct: null,
    mxVerifiedSharePct: null,
    activeCampaigns,
    scheduledCampaigns,
    targets,
  };
  const insights = evaluateMarketingRules(mktCtx);
  const activeTargetsLabel = Object.entries(targets).map(([k, v]) => `${k}=${v}`).join(' · ') || 'no DB targets';

  const tiles: KpiTileProps[] = (cfg.kpiTiles ?? []).map((k) => ({
    label: k.k, value: k.v, size: 'sm', footnote: k.d,
  }));
  const attn        = cfg.defaultAttn  ?? [];
  const docs        = cfg.defaultDocs  ?? [];
  const reportTypes = cfg.reportTypes  ?? [];

  const tabs: DashboardTab[] = (cfg.subPages ?? []).map((s: any) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.label === 'HoD',
  }));

  const chatHref = `/cockpit/chat?dept=${slug}`;

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title={`Marketing · ${cfg.hodName}`}
        subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        tabs={tabs}
        action={<TenantLink href={chatHref} style={primaryBtn}>{`Ask ${cfg.hodName} →`}</TenantLink>}
      >
        {/* HARDCODED honesty banner — see PBS design contract. */}
        <div style={{ ...fullRow, ...banner }}>
          <span style={bannerTag}>HARDCODED DATA</span>
          <span style={{ marginLeft: 8 }}>
            Headline KPIs · Attention list · My Reports come from static
            <code style={code}>DEPT_CFG.marketing</code> — not yet wired to a live
            marketing metric feed. Tasks + Bugs are live.
          </span>
        </div>

        {/* 1 · Headline KPI tiles */}
        {tiles.length > 0 && (
          <div style={fullRow}>
            <Container title="Headline" subtitle="static snapshot · from cfg" density="compact">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
              </div>
            </Container>
          </div>
        )}

        {/* 2 · Attention / My Reports / My Tasks / Bugs */}
        <div style={{ ...fullRow, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
          <Container title="Attention" subtitle={`${attn.length} item${attn.length === 1 ? '' : 's'} · dismiss with ×`} density="compact">
            <AttentionList items={attn} storageKey={`attn:${slug}:${pid}`} />
          </Container>
          <Container title="My Reports" subtitle={`${docs.length} item${docs.length === 1 ? '' : 's'} · red = unseen · dismiss with ×`} density="compact">
            <ReportsList items={docs} storageKey={`reports:${slug}:${pid}`} />
          </Container>
          <Container title="My Tasks" subtitle={dueTasksCount > 0 ? `🔴 ${dueTasksCount} due · add / due-date / repeat / delete` : 'add / due-date / repeat / delete · per property'} density="compact">
            <HodTasksList deptSlug={slug} propertyId={pid} />
          </Container>
          <Container title="Bugs" subtitle={`${bugs.length} open · + to add · /cockpit/bugs for full inbox`} density="compact">
            <BugsList deptSlug={slug} propertyId={pid} initial={bugs} />
          </Container>
        </div>

        {/* 3 · Conclusions container — rule-based signals from lib/rules/marketing.ts */}
        <div style={fullRow}>
          <ConclusionBlock
            insights={insights}
            title="CONCLUSIONS · campaigns · funnels · deliverability"
            subtitle={`Live: ${activeCampaigns} active · ${scheduledCampaigns} scheduled · DB targets: ${activeTargetsLabel}`}
            emptyText="Everything nominal. No marketing alarms firing."
            storageKey={`marketing_hod_signals:${pid}`}
            maxRender={12}
          />
        </div>

        {/* 4 · Build-a-Report */}
        {reportTypes.length > 0 && (
          <div style={fullRow}>
            <Container title="Build a report" subtitle="pick a type · narrow with chips · open print-ready render" density="compact">
              <ReportBuilder reportTypes={reportTypes} hrefPrefix="" />
            </Container>
          </div>
        )}
      </DashboardPage>
    </div>
  );
}

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const FOREST= '#084838';
const CREAM = '#F7F0E1';

const fullRow: CSSProperties = { gridColumn: '1 / -1' };
const primaryBtn: CSSProperties = {
  fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
  padding: '6px 14px', borderRadius: 4,
  background: FOREST, color: WHITE, textDecoration: 'none',
};
const banner: CSSProperties = {
  background: CREAM, border: '1px solid ' + HAIR, borderLeft: '3px solid #B03826',
  borderRadius: 6, padding: '8px 12px', fontSize: 11, color: INK,
  display: 'flex', alignItems: 'baseline', flexWrap: 'wrap',
};
const bannerTag: CSSProperties = {
  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700,
  color: '#B03826',
};
const code: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 10,
  background: WHITE, color: INK_M, border: '1px solid ' + HAIR,
  padding: '1px 5px', borderRadius: 3, margin: '0 3px',
};
