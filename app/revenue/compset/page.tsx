// app/revenue/compset/page.tsx
//
// Comp Set v3 — recovery rewrite (2026-05-06).
//
// What changed vs the v1 stub this replaces:
//   v1 was 213 lines that imported only SourceCard + CompsetTable. The v3
//   components (CompactAgentHeader / CompsetGraphs / SetTabs / PropertyTable /
//   AgentRunHistoryTable / AnalyticsBlock + DeepViewPanel) all already exist
//   under `_components/` but were not wired. This file is the page-level
//   wiring only — no component edits.
//
// Page structure (top → bottom):
//   1. PageHeader (Revenue › Comp Set, italic brass accent)
//   2. CompactAgentHeader — agent status, last run, MTD cost, next event,
//      next-shop pills, settings links, RUN NOW
//   3. CompsetGraphs — 3-graph row (rate trend, DoW positioning, promo intensity)
//   4. SetTabs — ?set= URL param drives selectedSetId; default to is_primary
//   5. PropertyTable — set-filtered rows, expandable deep view, Namkhan baseline
//   6. AgentRunHistoryTable — last 10 runs (compset_agent + comp_discovery_agent)
//   7. AnalyticsBlock — data maturity, rate-plan landscape, plan gaps, promo tiles
//
// All data comes from public.v_compset_* proxies (revenue.* not in pgrst.db_schemas).
// Agent + run-history use governance.* via supabase.schema('governance') —
// pattern matches /revenue/parity/page.tsx.
// Events use marketing.upcoming_events via supabase.schema('marketing').
//
// Per CLAUDE.md hard rules: this is a server component, all canonical components,
// every section has an empty-state, zero hardcoded fontSize / hex / USD prefix.

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import ArtifactActions from '@/components/page/ArtifactActions';
import { createClient } from '@supabase/supabase-js';
import { REVENUE_SUBPAGES } from '../_subpages';
import CompactAgentHeader from './_components/CompactAgentHeader';
import CompsetGraphs from './_components/CompsetGraphs';
import TopInsights from './_components/TopInsights';
import SetTabs from './_components/SetTabs';
import PropertyTable from './_components/PropertyTable';
import AgentRunHistoryTable from './_components/AgentRunHistoryTable';
import AnalyticsBlock from './_components/AnalyticsBlock';
import type {
  AgentRow,
  AgentRunSummaryRow,
  CompetitorDeepData,
  CompetitorPropertyDetailRow,
  CompetitorRateMatrixRow,
  CompetitorRatePlanMixRow,
  CompetitorReviewsSummaryRow,
  CompetitorRoomMappingRow,
  DataMaturityRow,
  PromoBehaviorRow,
  PromoTileRow,
  PropertySummaryRow,
  RankingLatestRow,
  RatePlanGapRow,
  RatePlanLandscapeRow,
  RatePlanLiveRow,
  ScrapeDateRow,
  SetSummaryRow,
  UpcomingEventRow,
} from './_components/types';
import type {
  CalendarRow,
  DowRow,
  PromoTileRow as GraphsPromoTileRow,
} from './_components/graphsTypes';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

// Self-row baseline: Namkhan's comp_id (locked).
const NAMKHAN_COMP_ID = '4505b111-b2e4-413d-8a46-52c536867e0c';
const NAMKHAN_LABEL = 'The Namkhan';

interface PageProps {
  searchParams?: Promise<{ set?: string; bust?: string }>;
}

// Shape of v_compset_agent_settings — locked_by_mandate JSONB carries budget +
// MTD cost; the legacy AgentRow type expects them as flat fields, so we lift.
type CompsetAgentSettingsRow = {
  agent_id: string;
  code: string;
  name: string;
  status: string | null;
  pillar: string | null;
  runtime_settings: Record<string, unknown> | null;
  locked_by_mandate: Record<string, unknown> | null;
};

export default async function CompsetPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};

  // --------------------------------------------------------------------------
  // Parallel data fetch — all queries kicked off together.
  // 2026-05-09 PBS regression hunt: shared `lib/supabase` prefers service-role,
  // but service_role currently LACKS SELECT on the underlying revenue.*
  // tables/views (anon + authenticated have it). PostgREST therefore returns
  // [] silently for service-role on every v_compset_* view → "wiring is gone"
  // empty page. Anon, in contrast, sees all rows (verified via SQL with
  // SET LOCAL ROLE anon: 4 sets, 14 props, 240 rates).
  //
  // Until the schema-side grants are fixed (out of scope for this UI session),
  // pin the compset page to a local anon client. No secrets in repo; uses the
  // same NEXT_PUBLIC_SUPABASE_ANON_KEY everything else uses.
  // --------------------------------------------------------------------------
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const setSummaryP = supabase
    .from('v_compset_set_summary')
    .select('*');

  const propertySummaryP = supabase
    .from('v_compset_property_summary')
    .select('*');

  // Deep-view sources — assembled into Map<comp_id, CompetitorDeepData> below.
  const detailP = supabase
    .from('v_compset_competitor_property_detail')
    .select('*');
  // PBS 2026-05-09: explicitly fetch up to 5000 rows so a wide comp set does
  // not get truncated under PostgREST default limit. Was the cause of empty
  // chart rendering even though data existed in the view.
  const rateMatrixP = supabase
    .from('v_compset_competitor_rate_matrix')
    .select('*')
    .limit(5000);
  const ratePlanMixP = supabase
    .from('v_compset_competitor_rate_plan_mix')
    .select('*');
  const roomMappingP = supabase
    .from('v_compset_competitor_room_mapping')
    .select('*');
  const rankingsP = supabase
    .from('v_compset_ranking_latest')
    .select('*');
  const reviewsP = supabase
    .from('v_compset_competitor_reviews_summary')
    .select('*');
  const ratePlansLatestP = supabase
    .from('v_compset_rate_plans_latest')
    .select('*');

  // Analytics block sources.
  const maturityP = supabase
    .from('v_compset_data_maturity')
    .select('*')
    .maybeSingle();
  const promoBehaviorP = supabase
    .from('v_compset_promo_behavior_signals')
    .select('*');
  const promoTilesP = supabase
    .from('v_compset_promo_tiles')
    .select('*');
  const ratePlanGapsP = supabase
    .from('v_compset_rate_plan_gaps')
    .select('*')
    .order('easy_win_score', { ascending: false });
  const ratePlanLandscapeP = supabase
    .from('v_compset_rate_plan_landscape')
    .select('*');

  // Agent + run history — use governance schema directly, mirrors parity page.
  const agentSettingsP = supabase
    .from('v_compset_agent_settings')
    .select('*')
    .eq('code', 'compset_agent')
    .maybeSingle();
  const runHistoryP = supabase
    .schema('governance')
    .from('agent_run_summary')
    .select('*')
    .in('agent_code', ['compset_agent', 'comp_discovery_agent'])
    .order('started_at', { ascending: false })
    .limit(10);

  // Events — marketing schema is exposed via pgrst.db_schemas.
  const eventsP = supabase
    .schema('marketing')
    .from('upcoming_events')
    .select('*')
    .order('date_start', { ascending: true })
    .limit(20);

  // Picker dates RPC — public.compset_pick_scrape_dates(8, 120, 40).
  const pickDatesP = supabase.rpc('compset_pick_scrape_dates', {
    p_max_dates: 8,
    p_horizon_days: 120,
    p_min_score: 40,
  });

  const [
    setSummaryR,
    propertySummaryR,
    detailR,
    rateMatrixR,
    ratePlanMixR,
    roomMappingR,
    rankingsR,
    reviewsR,
    ratePlansLatestR,
    maturityR,
    promoBehaviorR,
    promoTilesR,
    ratePlanGapsR,
    ratePlanLandscapeR,
    agentSettingsR,
    runHistoryR,
    eventsR,
    pickDatesR,
  ] = await Promise.all([
    setSummaryP,
    propertySummaryP,
    detailP,
    rateMatrixP,
    ratePlanMixP,
    roomMappingP,
    rankingsP,
    reviewsP,
    ratePlansLatestP,
    maturityP,
    promoBehaviorP,
    promoTilesP,
    ratePlanGapsP,
    ratePlanLandscapeP,
    agentSettingsP,
    runHistoryP,
    eventsP,
    pickDatesP,
  ]);

  // --------------------------------------------------------------------------
  // Normalise rows. Falls back to [] / null on any view miss so the page still
  // renders an empty state rather than 500ing.
  // --------------------------------------------------------------------------
  const sets: SetSummaryRow[] = (setSummaryR.data ?? []) as SetSummaryRow[];
  const allProps: PropertySummaryRow[] =
    (propertySummaryR.data ?? []) as PropertySummaryRow[];

  // Selected set — URL param wins, else primary set, else first set.
  const orderedSets = [...sets].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.set_name.localeCompare(b.set_name);
  });
  const primarySet = orderedSets.find((s) => s.is_primary) ?? orderedSets[0] ?? null;
  const selectedSetId =
    (params.set && orderedSets.find((s) => s.set_id === params.set)?.set_id) ??
    primarySet?.set_id ??
    '';

  // Property rows scoped to selected set.
  const setRows: PropertySummaryRow[] = allProps.filter(
    (p) => p.set_id === selectedSetId,
  );

  // ---- Deep-view assembly: keyed Map<comp_id, CompetitorDeepData> ----
  const detail = (detailR.data ?? []) as CompetitorPropertyDetailRow[];
  const rateMatrix = (rateMatrixR.data ?? []) as CompetitorRateMatrixRow[];
  const ratePlanMix = (ratePlanMixR.data ?? []) as CompetitorRatePlanMixRow[];
  const roomMapping = (roomMappingR.data ?? []) as CompetitorRoomMappingRow[];
  const rankings = (rankingsR.data ?? []) as RankingLatestRow[];
  const reviews = (reviewsR.data ?? []) as CompetitorReviewsSummaryRow[];
  const ratePlansLatest = (ratePlansLatestR.data ?? []) as RatePlanLiveRow[];

  const deepDataMap: Record<string, CompetitorDeepData> = {};
  // Seed each comp_id present anywhere with an empty payload; fill in pieces.
  const seedCompIds = new Set<string>();
  detail.forEach((d) => seedCompIds.add(d.comp_id));
  setRows.forEach((p) => seedCompIds.add(p.comp_id));
  for (const cid of seedCompIds) {
    deepDataMap[cid] = {
      detail: detail.find((d) => d.comp_id === cid) ?? null,
      roomMappings: roomMapping.filter((r) => r.comp_id === cid),
      ratePlanMix: ratePlanMix.filter((r) => r.comp_id === cid),
      rateMatrix: rateMatrix.filter((r) => r.comp_id === cid),
      rankings: rankings.filter((r) => r.comp_id === cid),
      reviewsSummary: reviews.find((r) => r.comp_id === cid) ?? null,
      ratePlansLive: ratePlansLatest.filter((r) => r.comp_id === cid),
    };
  }
  // Namkhan baseline: own rate-matrix rows for overlay in any comp's deep view.
  const namkhanRateMatrix: CompetitorRateMatrixRow[] = rateMatrix.filter(
    (r) => r.comp_id === NAMKHAN_COMP_ID,
  );

  // ---- Analytics block rows ----
  const maturity: DataMaturityRow | null =
    (maturityR.data as DataMaturityRow | null) ?? null;
  const promo: PromoBehaviorRow[] =
    (promoBehaviorR.data ?? []) as PromoBehaviorRow[];
  const tiles: PromoTileRow[] = (promoTilesR.data ?? []) as PromoTileRow[];
  const gaps: RatePlanGapRow[] =
    (ratePlanGapsR.data ?? []) as RatePlanGapRow[];
  const landscape: RatePlanLandscapeRow[] =
    (ratePlanLandscapeR.data ?? []) as RatePlanLandscapeRow[];

  // ---- Agent + last run + run history ----
  const agentSettings =
    (agentSettingsR.data as CompsetAgentSettingsRow | null) ?? null;
  // Lift mandate-locked budget + MTD cost into the flat AgentRow shape that
  // CompactAgentHeader expects. Nested as locked_by_mandate.{monthly_budget_usd,
  // month_to_date_cost_usd} per v_compset_agent_settings.
  const lockedMandate = (agentSettings?.locked_by_mandate ?? {}) as Record<
    string,
    unknown
  >;
  const runtimeSettings = (agentSettings?.runtime_settings ?? {}) as Record<
    string,
    unknown
  >;
  const agent: AgentRow | null = agentSettings
    ? {
        agent_id: agentSettings.agent_id,
        code: agentSettings.code,
        name: agentSettings.name,
        status: agentSettings.status ?? null,
        schedule_human:
          (runtimeSettings['cron_schedule_human'] as string | undefined) ??
          null,
        model_id: null,
        monthly_budget_usd:
          (lockedMandate['monthly_budget_usd'] as number | undefined) ?? null,
        month_to_date_cost_usd:
          (lockedMandate['month_to_date_cost_usd'] as number | undefined) ??
          null,
        last_run_at: null,
        runtime_settings: runtimeSettings,
      }
    : null;

  const runHistory: AgentRunSummaryRow[] =
    (runHistoryR.data ?? []) as AgentRunSummaryRow[];
  const lastRun: AgentRunSummaryRow | null =
    runHistory.find((r) => r.agent_code === 'compset_agent') ?? null;

  // ---- Events ----
  const events: UpcomingEventRow[] =
    (eventsR.data ?? []) as UpcomingEventRow[];
  const nextEvent: UpcomingEventRow | null = events[0] ?? null;

  // ---- Pick dates (RPC) ----
  // Returns rows with stay_date + score breakdown matching ScrapeDateRow.
  const pickDates: ScrapeDateRow[] =
    ((pickDatesR.data ?? []) as ScrapeDateRow[]) ?? [];

  // --------------------------------------------------------------------------
  // Graphs data (CompsetGraphs needs CalendarRow / DowRow / PromoTileRow).
  //
  // TODO(2026-05-06): when revenue.v_compset_calendar / v_compset_dow views
  // exist, switch to those. For now we derive what we can:
  //   - calendar: build from rateMatrix where comp_id = Namkhan vs comp median
  //   - dow:      bucket calendar rows by day-of-week
  //   - tiles:    map promo tiles to the lighter PromoTileRow graphs shape
  // Components render an empty state on [] so this is safe even if the source
  // is sparse.
  // --------------------------------------------------------------------------
  const calendar: CalendarRow[] = (() => {
    // Group rateMatrix by stay_date → namkhan_usd + median_usd of all comps.
    const byDate = new Map<string, { namkhan: number | null; comps: number[] }>();
    for (const m of rateMatrix) {
      if (!m.stay_date || m.rate_usd == null) continue;
      const v = byDate.get(m.stay_date) ?? { namkhan: null, comps: [] };
      if (m.comp_id === NAMKHAN_COMP_ID) {
        v.namkhan = Number(m.rate_usd);
      } else {
        v.comps.push(Number(m.rate_usd));
      }
      byDate.set(m.stay_date, v);
    }
    const rows: CalendarRow[] = [];
    for (const [stay_date, v] of byDate) {
      const sorted = [...v.comps].sort((a, b) => a - b);
      const median =
        sorted.length === 0
          ? null
          : sorted.length % 2 === 1
            ? sorted[(sorted.length - 1) / 2]
            : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
      rows.push({
        stay_date,
        namkhan_usd: v.namkhan,
        median_usd: median,
        min_usd: sorted[0] ?? null,
        max_usd: sorted[sorted.length - 1] ?? null,
      });
    }
    return rows;
  })();

  const dow: DowRow[] = (() => {
    // Bucket calendar rows by day-of-week (1=Mon...7=Sun, ISO).
    const buckets = new Map<
      number,
      { namkhan: number[]; median: number[]; min: number[]; max: number[] }
    >();
    const dowLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (const c of calendar) {
      const d = new Date(c.stay_date + 'T00:00:00Z');
      const jsDow = d.getUTCDay(); // 0=Sun..6=Sat
      const isoDow = jsDow === 0 ? 7 : jsDow; // 1=Mon..7=Sun
      const v = buckets.get(isoDow) ?? {
        namkhan: [],
        median: [],
        min: [],
        max: [],
      };
      if (c.namkhan_usd != null) v.namkhan.push(Number(c.namkhan_usd));
      if (c.median_usd != null) v.median.push(Number(c.median_usd));
      if (c.min_usd != null) v.min.push(Number(c.min_usd));
      if (c.max_usd != null) v.max.push(Number(c.max_usd));
      buckets.set(isoDow, v);
    }
    const avg = (xs: number[]): number | null =>
      xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;
    const rows: DowRow[] = [];
    for (let i = 1; i <= 7; i++) {
      const v = buckets.get(i);
      rows.push({
        dow: i,
        dow_label: dowLabels[i - 1],
        avg_namkhan_usd: v ? avg(v.namkhan) : null,
        avg_comp_median_usd: v ? avg(v.median) : null,
        avg_comp_cheapest_usd: v ? avg(v.min) : null,
        avg_comp_dearest_usd: v ? avg(v.max) : null,
      });
    }
    return rows;
  })();

  // CompsetGraphs's PromoTileRow is a slim subset of types.PromoTileRow.
  const graphTiles: GraphsPromoTileRow[] = tiles.map((t) => ({
    comp_id: t.comp_id,
    property_name: t.property_name,
    is_self: t.is_self,
    promo_frequency_pct: t.promo_frequency_pct,
  }));

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  const ctx = (kind: 'panel' | 'kpi' | 'brief' | 'table', title: string) => ({ kind, title, dept: 'revenue' as const });

  return (
    <Page
      eyebrow="Revenue · Comp Set"
      title={
        <>
          See who is moving the{' '}
          <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>
            price line
          </em>
          , before they do.
        </>
      }
      subPages={REVENUE_SUBPAGES}
    >
      <Panel title="Comp-set agent" eyebrow="status · last run · next shop" actions={<ArtifactActions context={ctx('panel', 'Comp-set agent status')} />}>
        <CompactAgentHeader
          agent={agent}
          lastRun={lastRun}
          nextEvent={nextEvent}
          pickDates={pickDates}
          events={events}
          settingsLinks={[
            { href: '/revenue/compset/scoring-settings', label: 'Scoring' },
            { href: '/revenue/compset/agent-settings', label: 'Agent' },
          ]}
        />
      </Panel>

      <div style={{ height: 14 }} />

      <Panel
        title="Top insights"
        eyebrow="rates · last 30 stay-dates · namkhan vs comp set"
        actions={<ArtifactActions context={ctx('panel', 'Top insights · compset rate trend')} />}
      >
        <TopInsights
          propertyRows={allProps}
          rateMatrix={rateMatrix}
          namkhanCompId={NAMKHAN_COMP_ID}
        />
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title="Rate trend · DoW · promo intensity" eyebrow="hero" actions={<ArtifactActions context={ctx('panel', 'Comp-set graphs')} />}>
        <CompsetGraphs calendar={calendar} dow={dow} tiles={graphTiles} />
      </Panel>

      {/* SET TABS — ?set= URL param. Hidden when zero sets. */}
      {orderedSets.length > 0 ? (
        <SetTabs sets={orderedSets} selectedSetId={selectedSetId} />
      ) : (
        <div style={emptyCard}>
          No comp sets defined yet. Create one via the comp-set editor.
        </div>
      )}

      {/* PROPERTY TABLE — set-filtered rows, expandable deep view. */}
      {selectedSetId && (
        <section style={tableSection}>
          {/* Tiny set-context strip. */}
          <div style={legend}>
            {primarySet?.set_id === selectedSetId ? '★ PRIMARY SET · ' : ''}
            {setRows.length} {setRows.length === 1 ? 'property' : 'properties'}
            {' · CLICK A ROW TO EXPAND'}
          </div>
          <PropertyTable
            rows={setRows}
            deepDataMap={deepDataMap}
            namkhanRateMatrix={namkhanRateMatrix}
            namkhanLabel={NAMKHAN_LABEL}
          />
        </section>
      )}

      <div style={{ height: 14 }} />

      <Panel title="Agent run history · last 10" eyebrow="compset_agent · comp_discovery_agent" actions={<ArtifactActions context={ctx('table', 'Agent run history')} />}>
        <AgentRunHistoryTable rows={runHistory} />
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title="Analytics" eyebrow="data maturity · landscape · gaps · promo" actions={<ArtifactActions context={ctx('panel', 'Comp-set analytics')} />}>
        <AnalyticsBlock
          maturity={maturity}
          landscape={landscape}
          gaps={gaps}
          promo={promo}
          tiles={tiles}
        />
      </Panel>
    </Page>
  );
}

// -----------------------------------------------------------------------------
// LIGHTWEIGHT SECTION STYLES
// All values come from CSS variables — zero hardcoded fontSize / hex.
// -----------------------------------------------------------------------------
const tableSection: React.CSSProperties = {
  marginTop: 18,
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  padding: '18px 22px',
};

const sectionHeader: React.CSSProperties = {
  marginBottom: 14,
};

const sectionTitle: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontStyle: 'italic',
  fontWeight: 500,
  fontSize: 'var(--t-xl)',
  marginTop: 6,
};

const legend: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  color: 'var(--brass)',
  marginBottom: 10,
};

const emptyCard: React.CSSProperties = {
  marginTop: 18,
  padding: '24px 22px',
  background: 'var(--paper-warm)',
  border: '1px dashed var(--paper-deep)',
  borderRadius: 8,
  color: 'var(--ink-mute)',
  fontSize: 'var(--t-sm)',
  textAlign: 'center',
};
