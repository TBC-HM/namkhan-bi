// app/h/[property_id]/revenue/forecast/page.tsx
// Namkhan: Forecasting module v1.1 — narrative-first redesign (brief
// forecasting-module-v1 §V1.1, owner findings 7-8: "UI is a dead fish").
//
// The page now answers the owner MD's four questions, in order, at the top:
//   What will probably happen · Why · How confident (and WHY that confidence,
//   per the MD Confidence Model components) · What could improve the outcome.
// Then: risks / opportunities / recommended actions (with accept·dismiss·
// executed tracking — MD success metric), the statistical sections, the
// Scenario Engine comparison (deterministic recompute, recommend-never-
// execute), forecast error history + calibration, learning-journal lessons,
// and the reforecast-trigger timeline. A findings button files straight into
// governance.module_findings (rule 729).
//
// BINDING rule 1 intact: every number on this page is deterministic
// (nightly SQL engine, lib/forecast TS engine, scenario SQL engine).
// LLM layers (Challenger/Insight) narrate; they never compute the numbers.
//
// Data: public.v_forecast_current · v_forecast_vs_actual · mv_kpi_daily ·
// v_forecast_commentary · v_forecast_scenarios · v_forecast_scenario_runs ·
// v_forecast_recommendations (+stats) · v_forecast_learning_journal ·
// v_forecast_reforecast_log. All reads via public bridges (claude_md §0.5).
// Currency layer: PMS/transaction USD (ADR-111/173).
//
// Donna branch: canonical empty-state surface, untouched (ADR-173).

import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import {
  DashboardPage,
  Container,
  Chart,
  MetricRow,
  type DashboardTab,
  type KpiTileProps,
  type ChartSeries,
} from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';
import { capacityRnRange } from '@/lib/capacity';
import { REVENUE_SUBPAGES } from '@/app/revenue/_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import DonnaRevenueCanonical from '../_DonnaRevenueCanonical';
import { REVENUE_SURFACES } from '../_surfaces';
import { runMonthlyForecast, type EngineRun } from '@/lib/forecast';
import {
  RecommendationList,
  ScenarioRunButtons,
  CustomScenarioForm,
  FindingButton,
  type RecommendationRow,
  type ScenarioDef,
} from './ForecastActions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Types ────────────────────────────────────────────────────────────────

interface ForecastRow {
  run_date: string;
  stay_date: string;
  days_out: number;
  otb_rooms: number | null;
  rooms_fc: number | null;
  occ_fc: number | null;
  adr_fc: number | null;
  rooms_rev_fc: number | null;
  p10: number | null;
  p90: number | null;
  method: string | null;
}

interface ScoredRow {
  days_out: number;
  occ_ape_pct: number | null;
  occ_abs_err_pp: number | null;
  within_band: boolean | null;
  method: string | null;
}

// LLM commentary layer (forecast-commentary edge fn → forecast.run_commentary).
// Content is agent-written jsonb — every field optional, rendered defensively.
interface CommentaryRow {
  run_date: string;
  kind: 'challenger' | 'insight';
  content: Record<string, unknown> | null;
  model: string | null;
  confidence_adjustment: number | null;
}

interface ChallengerContent {
  verdict?: string;
  summary?: string;
  challenges?: Array<{ issue?: string; severity?: string; detail?: string }>;
  stale_data_flags?: string[];
}

interface InsightContent {
  summary?: string;
  findings?: Array<{ title?: string; detail?: string; confidence?: string }>;
  drivers?: string[];
  risks?: string[];
  opportunities?: string[];
  recommended_actions?: Array<{ action?: string; rationale?: string }>;
}

interface ScenarioRunRow {
  scenario_id: number;
  base_run_date: string;
  horizon_days: number;
  outputs: Record<string, unknown> | null;
  method: string;
  narrative: string | null;
  created_at: string;
}

interface JournalRow {
  period_start: string;
  grain: string;
  metric: string;
  forecast_value: number | null;
  actual_value: number | null;
  variance_pct: number | null;
  classification: string | null;
  reason: string | null;
  lesson: string | null;
}

interface ReforecastRow {
  checked_at: string;
  reasons: unknown;
  rows_written: number | null;
}

// ─── Fetchers ─────────────────────────────────────────────────────────────

async function getForecastCurrent(pid: number): Promise<ForecastRow[]> {
  const { data, error } = await supabase
    .from('v_forecast_current')
    .select('run_date, stay_date, days_out, otb_rooms, rooms_fc, occ_fc, adr_fc, rooms_rev_fc, p10, p90, method')
    .eq('property_id', pid)
    .order('stay_date')
    .limit(1000);
  if (error) { console.error('[forecast] v_forecast_current', error); return []; }
  return (data ?? []) as ForecastRow[];
}

// v_forecast_vs_actual grows daily — page through PostgREST's 1000-row window.
async function getScored90d(pid: number, todayIso: string): Promise<ScoredRow[]> {
  const from = shiftDays(todayIso, -90);
  const out: ScoredRow[] = [];
  const PAGE = 1000;
  for (let offset = 0; offset < 40000; offset += PAGE) {
    const { data, error } = await supabase
      .from('v_forecast_vs_actual')
      .select('days_out, occ_ape_pct, occ_abs_err_pp, within_band, method')
      .eq('property_id', pid)
      .gte('stay_date', from)
      .range(offset, offset + PAGE - 1);
    if (error) { console.error('[forecast] v_forecast_vs_actual', error); break; }
    const rows = (data ?? []) as ScoredRow[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

async function getCommentary(pid: number): Promise<{ challenger: CommentaryRow | null; insight: CommentaryRow | null }> {
  const { data, error } = await supabase
    .from('v_forecast_commentary')
    .select('run_date, kind, content, model, confidence_adjustment')
    .eq('property_id', pid)
    .order('run_date', { ascending: false })
    .limit(6);
  if (error) { console.error('[forecast] v_forecast_commentary', error); return { challenger: null, insight: null }; }
  const rows = (data ?? []) as CommentaryRow[];
  return {
    challenger: rows.find((r) => r.kind === 'challenger') ?? null,
    insight: rows.find((r) => r.kind === 'insight') ?? null,
  };
}

async function getScenarios(pid: number): Promise<ScenarioDef[]> {
  const { data, error } = await supabase
    .from('v_forecast_scenarios')
    .select('id, scenario_kind, title, description')
    .eq('property_id', pid)
    .eq('active', true)
    .order('id');
  if (error) { console.error('[forecast] v_forecast_scenarios', error); return []; }
  return (data ?? []) as ScenarioDef[];
}

async function getLatestScenarioRuns(pid: number): Promise<Map<number, ScenarioRunRow>> {
  const { data, error } = await supabase
    .from('v_forecast_scenario_runs')
    .select('scenario_id, base_run_date, horizon_days, outputs, method, narrative, created_at')
    .eq('property_id', pid)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) { console.error('[forecast] v_forecast_scenario_runs', error); return new Map(); }
  const out = new Map<number, ScenarioRunRow>();
  for (const r of (data ?? []) as ScenarioRunRow[]) {
    if (!out.has(r.scenario_id)) out.set(r.scenario_id, r); // newest first
  }
  return out;
}

async function getRecommendations(pid: number): Promise<RecommendationRow[]> {
  const { data, error } = await supabase
    .from('v_forecast_recommendations')
    .select('id, run_date, action, rationale, status, acted_by')
    .eq('property_id', pid)
    .order('run_date', { ascending: false })
    .order('id')
    .limit(30);
  if (error) { console.error('[forecast] v_forecast_recommendations', error); return []; }
  return (data ?? []) as RecommendationRow[];
}

async function getRecommendationStats(pid: number): Promise<{ total: number; accepted: number; executed: number; dismissed: number; acceptance_rate_pct: number | null } | null> {
  const { data, error } = await supabase
    .from('v_forecast_recommendation_stats')
    .select('total, accepted, executed, dismissed, acceptance_rate_pct')
    .eq('property_id', pid)
    .maybeSingle();
  if (error) { console.error('[forecast] v_forecast_recommendation_stats', error); return null; }
  return data as { total: number; accepted: number; executed: number; dismissed: number; acceptance_rate_pct: number | null } | null;
}

async function getLearningJournal(pid: number): Promise<JournalRow[]> {
  const { data, error } = await supabase
    .from('v_forecast_learning_journal')
    .select('period_start, grain, metric, forecast_value, actual_value, variance_pct, classification, reason, lesson')
    .eq('property_id', pid)
    .order('period_start', { ascending: false })
    .limit(14);
  if (error) { console.error('[forecast] v_forecast_learning_journal', error); return []; }
  return (data ?? []) as JournalRow[];
}

async function getReforecastLog(pid: number): Promise<ReforecastRow[]> {
  const { data, error } = await supabase
    .from('v_forecast_reforecast_log')
    .select('checked_at, reasons, rows_written')
    .eq('property_id', pid)
    .order('checked_at', { ascending: false })
    .limit(12);
  if (error) { console.error('[forecast] v_forecast_reforecast_log', error); return []; }
  return (data ?? []) as ReforecastRow[];
}

async function getLyRoomsByMonth(pid: number, fromIso: string, toIso: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('mv_kpi_daily')
    .select('night_date, rooms_sold')
    .eq('property_id', pid)
    .gte('night_date', shiftYears(fromIso, -1))
    .lte('night_date', shiftYears(toIso, -1))
    .limit(1000);
  if (error) { console.error('[forecast] mv_kpi_daily LY', error); return new Map(); }
  const out = new Map<string, number>();
  for (const r of (data ?? []) as Array<{ night_date: string; rooms_sold: number | null }>) {
    const fcMonth = shiftYears(String(r.night_date), 1).slice(0, 7);
    out.set(fcMonth, (out.get(fcMonth) ?? 0) + Number(r.rooms_sold ?? 0));
  }
  return out;
}

// ─── Date helpers (UTC, ISO date strings) ─────────────────────────────────

function shiftDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function shiftYears(iso: string, years: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[(m ?? 1) - 1]} ${String(y).slice(2)}`;
}
function monthEnd(ym: string): string {
  const d = new Date(ym + '-01T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + 1);
  return new Date(d.getTime() - 86400000).toISOString().slice(0, 10);
}
function daysBetween(aIso: string, bIso: string): number {
  return Math.round((new Date(bIso + 'T00:00:00Z').getTime() - new Date(aIso + 'T00:00:00Z').getTime()) / 86400000);
}

// ─── Confidence Model (owner MD) — deterministic components ───────────────
// "Confidence is calculated from: historical accuracy, data freshness, signal
//  quality, agreement between models, data completeness, current volatility.
//  Confidence is always shown. Never hide uncertainty." — and never hide WHY.
// Every component below is computed from data already on this page; the
// composite formula is disclosed in the UI. The LLM Challenger's adjustment is
// applied last and shown separately — it never rewrites the components.

interface ConfidenceComponent { name: string; score: number; note: string }

function computeConfidence(args: {
  curMape: number | null;
  blendMape: number | null;
  curCoverage: number | null;
  curN: number;
  blendCoverage: number | null;
  runAgeDays: number;
  completenessPct: number;
  agreementGapPp: number | null;
  reforecasts7d: number;
  challengerAdj: number | null;
}): { components: ConfidenceComponent[]; base: number; adjusted: number } {
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  const mape = args.curN >= 6 ? args.curMape : args.blendMape;
  const mapeSrc = args.curN >= 6 ? 'live engine' : 'all engines (live sample too thin)';
  const cov = args.curN >= 6 ? args.curCoverage : args.blendCoverage;

  const components: ConfidenceComponent[] = [
    {
      name: 'Historical accuracy',
      score: mape == null ? 50 : clamp(100 - mape * 2),
      note: mape == null ? 'no scored forecasts yet' : `${mape.toFixed(1)}% occupancy MAPE, ${mapeSrc} · score = 100 − 2×MAPE`,
    },
    {
      name: 'Data freshness',
      score: args.runAgeDays <= 1 ? 100 : args.runAgeDays <= 2 ? 70 : args.runAgeDays <= 4 ? 40 : 10,
      note: `latest engine run is ${args.runAgeDays} day${args.runAgeDays === 1 ? '' : 's'} old (nightly cadence expected)`,
    },
    {
      name: 'Signal quality (calibration)',
      score: cov == null ? 50 : clamp(cov),
      note: cov == null ? 'no band-coverage evidence yet' : `${cov.toFixed(0)}% of actuals landed inside the stated p10–p90 band (target 80%)`,
    },
    {
      name: 'Model agreement',
      score: args.agreementGapPp == null ? 50 : clamp(100 - args.agreementGapPp * 5),
      note: args.agreementGapPp == null
        ? 'second model unavailable this run'
        : `nightly SQL engine vs independent TS engine differ by ${args.agreementGapPp.toFixed(1)} occupancy points over the next 30 days`,
    },
    {
      name: 'Data completeness',
      score: clamp(args.completenessPct),
      note: `${args.completenessPct.toFixed(0)}% of forecast rows carry full ADR + revenue values`,
    },
    {
      name: 'Current volatility',
      score: clamp(100 - args.reforecasts7d * 15),
      note: args.reforecasts7d === 0
        ? 'no event-driven reforecasts in the last 7 days — demand is stable'
        : `${args.reforecasts7d} event-driven reforecast${args.reforecasts7d === 1 ? '' : 's'} in the last 7 days (pickup/cancellation shocks)`,
    },
  ];
  const base = Math.round(components.reduce((a, c) => a + c.score, 0) / components.length);
  const adjusted = clamp(base + (args.challengerAdj ?? 0));
  return { components, base, adjusted };
}

// ─── Shared display helpers (module scope — §0.60) ────────────────────────

function placeholderNote(text: string) {
  return (
    <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 12.5, lineHeight: 1.6, fontStyle: 'italic' }}>
      {text}
    </p>
  );
}

function listBlock(label: string, items: string[] | undefined) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p style={{ margin: '0 0 4px', color: 'var(--ink)', fontSize: 12.5, fontWeight: 600 }}>{label}</p>
      <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-soft)', fontSize: 12.5, lineHeight: 1.7 }}>
        {items.map((it, i) => (<li key={i}>{it}</li>))}
      </ul>
    </div>
  );
}

const fmtNum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '—');
const fmtSigned = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${Math.round(v).toLocaleString('en-US')}` : '—';

// ─── Executive summary (the four MD questions, in order) ──────────────────

function ExecutiveSummary({
  insight,
  challenger,
  conf,
  runDate,
  occ30,
  rev30,
  occ90,
}: {
  insight: CommentaryRow | null;
  challenger: CommentaryRow | null;
  conf: { components: ConfidenceComponent[]; base: number; adjusted: number };
  runDate: string;
  occ30: number;
  rev30: number;
  occ90: number;
}) {
  const ic = (insight?.content ?? null) as InsightContent | null;
  const cc = (challenger?.content ?? null) as ChallengerContent | null;
  const verdict = String(cc?.verdict ?? '');
  const confStatus = conf.adjusted >= 70 ? 'green' : conf.adjusted >= 45 ? 'amber' : 'red';

  const improve: string[] = [
    ...(ic?.opportunities ?? []).slice(0, 3),
    ...((cc?.challenges ?? []).slice(0, 2).map((ch) => (ch.issue ? `Investigate: ${ch.issue}${ch.detail ? ` — ${ch.detail}` : ''}` : '')).filter(Boolean) as string[]),
  ];

  return (
    <Container
      title="Executive summary — what will probably happen, and why"
      subtitle={`Engine run ${runDate} · statistical numbers, LLM narration · confidence always shown, never hidden`}
      status={confStatus as 'green' | 'amber' | 'red'}
      action={<FindingButton />}
    >
      <div style={{ display: 'grid', gap: 14 }}>
        {/* 1 · What will probably happen */}
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            What will probably happen
          </p>
          <p style={{ margin: 0, color: 'var(--ink)', fontSize: 13.5, lineHeight: 1.65 }}>
            {ic?.summary ??
              `Next 30 days: ${(occ30 * 100).toFixed(0)}% occupancy forecast, $${Math.round(rev30).toLocaleString('en-US')} rooms revenue. Next 90 days: ${(occ90 * 100).toFixed(0)}% occupancy. The nightly Insight narration has not landed for this run yet — numbers above are the raw statistical forecast.`}
          </p>
        </div>

        {/* 2 · Why */}
        {ic?.drivers && ic.drivers.length > 0 ? (
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Why — major drivers
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink)', fontSize: 12.5, lineHeight: 1.7 }}>
              {ic.drivers.map((d, i) => (<li key={i}>{d}</li>))}
            </ul>
          </div>
        ) : null}

        {/* 3 · How confident — and WHY that confidence */}
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            How confident — {conf.adjusted}%{verdict ? ` · challenger verdict: ${verdict}` : ''}
          </p>
          <div style={{ display: 'grid', gap: 4 }}>
            {conf.components.map((c) => (
              <div key={c.name} style={{ display: 'grid', gridTemplateColumns: '170px 44px 1fr', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink)' }}>{c.name}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: c.score >= 70 ? 'var(--status-green, #2E7D32)' : c.score >= 45 ? 'var(--sand, #B8A878)' : 'var(--terracotta, #B8542A)' }}>
                  {c.score}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{c.note}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--ink-soft)' }}>
            Composite = mean of the six components ({conf.base}){typeof challenger?.confidence_adjustment === 'number' && challenger.confidence_adjustment !== 0 ? ` ${challenger.confidence_adjustment > 0 ? '+' : ''}${challenger.confidence_adjustment} challenger adjustment` : ''} → {conf.adjusted}%. Deterministic formula — the Challenger may adjust, never rewrite.
          </p>
        </div>

        {/* 4 · What could improve the outcome */}
        {improve.length > 0 ? (
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              What could improve the outcome
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink)', fontSize: 12.5, lineHeight: 1.7 }}>
              {improve.map((d, i) => (<li key={i}>{d}</li>))}
            </ul>
          </div>
        ) : null}
      </div>
    </Container>
  );
}

// ─── Risks · opportunities · findings (Insight narration) ─────────────────

function InsightSection({ row }: { row: CommentaryRow | null }) {
  const c = (row?.content ?? null) as InsightContent | null;
  return (
    <Container
      title="Findings, risks & opportunities"
      subtitle={
        row
          ? `LLM framing of run ${row.run_date} · narration only — the forecast itself stays statistical · ${row.model ?? ''}`
          : 'Numbers → business findings (e.g. demand shifted later than the historical booking window)'
      }
      status={c ? undefined : 'grey'}
    >
      {c ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {(c.findings ?? []).length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-soft)', fontSize: 12.5, lineHeight: 1.7 }}>
              {(c.findings ?? []).map((f, i) => (
                <li key={i}>
                  <strong style={{ color: 'var(--ink)' }}>{f.title ?? 'finding'}</strong>
                  {f.confidence ? ` (${f.confidence} confidence)` : ''}{f.detail ? ` — ${f.detail}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
          {listBlock('Risks', c.risks)}
          {listBlock('Opportunities', c.opportunities)}
        </div>
      ) : (
        placeholderNote(
          'No Insight yet for the latest run. The nightly forecast-commentary agent (19:00 UTC) turns the engine output into named business findings with confidence levels.',
        )
      )}
    </Container>
  );
}

// ─── Challenger ───────────────────────────────────────────────────────────

function ChallengerSection({ row }: { row: CommentaryRow | null }) {
  const c = (row?.content ?? null) as ChallengerContent | null;
  const verdict = String(c?.verdict ?? '');
  const status = !c ? 'grey' : verdict === 'sound' ? 'green' : verdict === 'caution' ? 'amber' : verdict === 'unreliable' ? 'red' : 'grey';
  return (
    <Container
      title={`Forecast Challenger${verdict ? ` — verdict: ${verdict}` : ''}`}
      subtitle={
        row
          ? `Adversarial LLM review of run ${row.run_date} · never changes the statistical numbers · ${row.model ?? ''}`
          : 'Adversarial review: stale data, unrealistic assumptions, unusual pace → confidence adjustment'
      }
      status={status as 'green' | 'amber' | 'red' | 'grey'}
    >
      {c ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {c.summary ? <p style={{ margin: 0, color: 'var(--ink)', fontSize: 13, lineHeight: 1.6 }}>{c.summary}</p> : null}
          {(c.challenges ?? []).length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-soft)', fontSize: 12.5, lineHeight: 1.7 }}>
              {(c.challenges ?? []).map((ch, i) => (
                <li key={i}>
                  <strong style={{ color: 'var(--ink)' }}>{ch.issue ?? 'issue'}</strong>
                  {ch.severity ? ` (${ch.severity})` : ''}{ch.detail ? ` — ${ch.detail}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
          {typeof row?.confidence_adjustment === 'number' && row.confidence_adjustment !== 0 ? (
            <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 12.5 }}>
              Confidence adjustment: {row.confidence_adjustment} pp — read the stated bands that much wider.
            </p>
          ) : null}
          {listBlock('Stale-data flags', c.stale_data_flags)}
        </div>
      ) : (
        placeholderNote('No Challenger review yet for the latest run. The nightly forecast-commentary agent (19:00 UTC) attempts to prove the forecast wrong and adjusts confidence.')
      )}
    </Container>
  );
}

// ─── Scenario Engine comparison ───────────────────────────────────────────

function ScenarioSection({
  propertyId,
  scenarios,
  latestRuns,
}: {
  propertyId: number;
  scenarios: ScenarioDef[];
  latestRuns: Map<number, ScenarioRunRow>;
}) {
  const base = scenarios.find((s) => s.scenario_kind === 'no_intervention');
  const baseRun = base ? latestRuns.get(base.id) : undefined;
  const baseOut = (baseRun?.outputs ?? null) as Record<string, unknown> | null;

  const rows = scenarios.map((s) => {
    const run = latestRuns.get(s.id);
    const o = (run?.outputs ?? null) as Record<string, unknown> | null;
    return {
      scenario: s.title,
      occ: o ? `${o['occ_scenario_pct'] ?? '—'}%` : '—',
      adr: o ? `$${fmtNum(o['adr_scenario'])}` : '—',
      revenue: o ? `$${fmtNum(o['revenue_scenario'])}` : '—',
      rev_delta: o ? `$${fmtSigned(o['revenue_delta'])}` : '—',
      gop_impact: o ? `$${fmtSigned(o['gop_impact'])}` : '—',
      confidence: o ? `${o['confidence_pct'] ?? '—'}%` : 'not run yet',
      run_date: run ? run.base_run_date.slice(0, 10) : '—',
    };
  });
  const series: ChartSeries[] = [
    { key: 'occ', label: 'Occupancy' },
    { key: 'adr', label: 'ADR' },
    { key: 'revenue', label: 'Rooms revenue' },
    { key: 'rev_delta', label: 'Δ revenue vs base' },
    { key: 'gop_impact', label: 'GOP impact' },
    { key: 'confidence', label: 'Confidence' },
    { key: 'run_date', label: 'Base run' },
  ];

  const anyRun = Array.from(latestRuns.values())[0];
  const risks = scenarios
    .map((s) => {
      const o = (latestRuns.get(s.id)?.outputs ?? null) as Record<string, unknown> | null;
      return o && typeof o['risk'] === 'string' && s.scenario_kind !== 'no_intervention'
        ? `${s.title}: ${o['risk']}`
        : null;
    })
    .filter(Boolean) as string[];

  return (
    <Container
      title="Scenario Engine — alternative futures, compared"
      subtitle={`Deterministic recompute over the current statistical forecast (${anyRun ? `horizon ${anyRun.horizon_days}d` : 'no runs yet'}) · simulations only — recommend, never execute`}
      status={latestRuns.size > 0 ? undefined : 'grey'}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        {rows.length > 0 ? (
          <Chart variant="table" data={rows} xKey="scenario" series={series} />
        ) : (
          placeholderNote('No scenarios defined for this property yet.')
        )}
        {baseOut ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-soft)' }}>
            Base ({base?.title}): {String(baseOut['occ_base_pct'] ?? '—')}% occupancy · ${fmtNum(baseOut['revenue_base'])} rooms revenue over the horizon. Every scenario line above is measured against this.
          </p>
        ) : null}
        {risks.length > 0 ? listBlock('Scenario risks — read before acting', risks) : null}
        {(() => {
          // Scenario Agent narration — LLM narrates finished deterministic runs
          // (owner MD Scenario Agent element; numbers never come from the model).
          const narrated = scenarios
            .map((s) => {
              const run = latestRuns.get(s.id);
              return run ? { title: s.title, narrative: run.narrative } : null;
            })
            .filter(Boolean) as Array<{ title: string; narrative: string | null }>;
          if (narrated.length === 0) return null;
          const pendingCount = narrated.filter((n) => !n.narrative).length;
          return (
            <div style={{ display: 'grid', gap: 8 }}>
              {narrated
                .filter((n) => n.narrative)
                .map((n) => (
                  <div
                    key={n.title}
                    style={{
                      padding: '8px 10px',
                      border: '1px solid var(--hairline, #E6DFCC)',
                      borderRadius: 8,
                      background: 'var(--paper, #FFFFFF)',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--ink, #1B1B1B)' }}>{n.title}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-soft, #5A5A5A)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                      {n.narrative}
                    </p>
                  </div>
                ))}
              {pendingCount > 0 ? (
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
                  {pendingCount} run{pendingCount > 1 ? 's' : ''} awaiting Scenario Agent narration (hourly sweep) — the numbers above are final either way.
                </p>
              ) : null}
            </div>
          );
        })()}
        <ScenarioRunButtons propertyId={propertyId} scenarios={scenarios} />
        <CustomScenarioForm propertyId={propertyId} />
        {anyRun ? (
          <details>
            <summary style={{ cursor: 'pointer', color: 'var(--primary, #1F3A2E)', fontSize: 13, fontWeight: 600 }}>
              Method — transparent formula, no black box
            </summary>
            <p style={{ margin: '8px 0 0', color: 'var(--ink-soft)', fontSize: 12, lineHeight: 1.7, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              {anyRun.method}
            </p>
          </details>
        ) : null}
      </div>
    </Container>
  );
}

// ─── Error history · calibration · learning journal ───────────────────────

function ErrorHistorySection({
  scored,
  journal,
  accuracyData,
  accuracySeries,
}: {
  scored: ScoredRow[];
  journal: JournalRow[];
  accuracyData: Array<Record<string, string>>;
  accuracySeries: ChartSeries[];
}) {
  const journalRows = journal.map((j) => ({
    period: j.period_start.slice(0, 10),
    grain: j.grain,
    metric: j.metric,
    forecast: fmtNum(j.forecast_value),
    actual: fmtNum(j.actual_value),
    variance: j.variance_pct == null ? '—' : `${Number(j.variance_pct) >= 0 ? '+' : ''}${Number(j.variance_pct).toFixed(1)}%`,
    classification: j.classification ?? '—',
  }));
  const journalSeries: ChartSeries[] = [
    { key: 'grain', label: 'Grain' },
    { key: 'metric', label: 'Metric' },
    { key: 'forecast', label: 'Forecast' },
    { key: 'actual', label: 'Actual' },
    { key: 'variance', label: 'Variance' },
    { key: 'classification', label: 'Cause' },
  ];
  const lessons = journal.map((j) => j.lesson ?? j.reason).filter((x): x is string => !!x && x.length > 3).slice(0, 5);

  return (
    <Container
      title="Forecast error history & calibration"
      subtitle={`${scored.length.toLocaleString('en-US')} scored forecasts, rolling 90 days · every night's prediction is graded against reality — nothing is forgotten`}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <Chart variant="table" data={accuracyData} xKey="bucket" series={accuracySeries} />
        <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 12 }}>
          A 24-room property moves ~4 occupancy points per room — judge accuracy at month grain, not
          day grain. Coverage = how often actuals landed inside the stated p10–p90 band (design target 80%).
        </p>
        {journalRows.length > 0 ? (
          <div>
            <p style={{ margin: '0 0 6px', color: 'var(--ink)', fontSize: 12.5, fontWeight: 600 }}>
              Learning journal — forecast vs actual vs lesson (append-only)
            </p>
            <Chart variant="table" data={journalRows} xKey="period" series={journalSeries} />
            {lessons.length > 0 ? <div style={{ marginTop: 8 }}>{listBlock('Lessons the engine has recorded', lessons)}</div> : null}
          </div>
        ) : (
          placeholderNote('Learning journal is empty — the nightly writer (18:40 UTC) appends one scored lesson per completed period.')
        )}
      </div>
    </Container>
  );
}

// ─── Reforecast trigger timeline ──────────────────────────────────────────

function reasonToWords(r: unknown): string {
  if (typeof r === 'string') return r;
  if (r && typeof r === 'object') {
    const o = r as Record<string, unknown>;
    const kind = String(o['kind'] ?? o['reason'] ?? 'trigger');
    const label =
      kind === 'big_pickup' ? 'Large pickup — demand arrived faster than forecast'
      : kind === 'large_cancellation' ? 'Large cancellation — booked rooms fell away'
      : kind === 'group_booking_spike' ? 'Group booking spike — a single night jumped'
      : kind;
    const detail = o['stay_date'] ? ` (${String(o['stay_date']).slice(0, 10)}${o['delta'] != null ? `, ${fmtSigned(Number(o['delta']))} RN` : ''})` : '';
    return label + detail;
  }
  return 'trigger';
}

function ReforecastTimeline({ rows }: { rows: ReforecastRow[] }) {
  return (
    <Container
      title="Event-driven reforecasts — what shook the forecast, in words"
      subtitle="Large cancellations, group bookings and pickup spikes re-run the engine within the hour (6h debounce)"
      status={rows.length > 0 ? undefined : 'grey'}
    >
      {rows.length === 0 ? (
        placeholderNote('No event-driven reforecasts yet — the hourly trigger check has not seen a threshold breach. Quiet is a valid state.')
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {rows.map((r, i) => {
            const reasons = Array.isArray(r.reasons) ? r.reasons : [r.reasons];
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 10, alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontVariantNumeric: 'tabular-nums' }}>
                  {String(r.checked_at).slice(0, 16).split('T').join(' ')} UTC
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.6 }}>
                  {reasons.map(reasonToWords).join(' · ')}
                  {r.rows_written ? ` → engine re-ran, ${Number(r.rows_written).toLocaleString('en-US')} forecast rows rewritten` : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Container>
  );
}

// ─── 12-month statistical outlook (TS engine, module scope) ───────────────

function EngineOutlookSection({ run }: { run: EngineRun | null }) {
  const fmtUsd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;

  const engineTable = (run?.months ?? []).map((m) => ({
    month: monthLabel(m.month),
    occ_fc: `${m.occupancyPctForecast.toFixed(0)}% (${m.occupancyP10.toFixed(0)}–${m.occupancyP90.toFixed(0)}%)`,
    adr_fc: m.roomsForecast > 0 ? fmtUsd(m.adrForecast) : '—',
    revpar_fc: m.capacityRoomNights > 0 ? fmtUsd(m.revparForecast) : '—',
    rooms_rev_fc: fmtUsd(m.roomsRevenueForecast),
    otb: Math.round(m.otbRooms).toLocaleString('en-US'),
    stly: m.stlyRooms > 0 ? Math.round(m.stlyRooms).toLocaleString('en-US') : '—',
    basis: m.basis,
  }));
  const engineTableSeries: ChartSeries[] = [
    { key: 'occ_fc', label: 'Occupancy % fc (p10–p90)' },
    { key: 'adr_fc', label: 'ADR fc' },
    { key: 'revpar_fc', label: 'RevPAR fc' },
    { key: 'rooms_rev_fc', label: 'Rooms Revenue fc' },
    { key: 'otb', label: 'OTB RN' },
    { key: 'stly', label: 'STLY RN' },
    { key: 'basis', label: 'Basis' },
  ];

  const engineChart = (run?.months ?? []).map((m) => ({
    month: monthLabel(m.month),
    occ_fc: Number(m.occupancyPctForecast.toFixed(1)),
    p10: Number(m.occupancyP10.toFixed(1)),
    p90: Number(m.occupancyP90.toFixed(1)),
    stly_occ:
      m.capacityRoomNights > 0 && m.stlyRooms > 0
        ? Number(((100 * m.stlyRooms) / m.capacityRoomNights).toFixed(1))
        : 0,
  }));
  const engineChartSeries: ChartSeries[] = [
    { key: 'occ_fc', label: 'Occupancy % forecast', color: 'var(--primary, #1F3A2E)', type: 'line' },
    { key: 'p10', label: 'p10 (low)', color: 'var(--hairline, #E6DFCC)', type: 'line' },
    { key: 'p90', label: 'p90 (high)', color: 'var(--hairline, #E6DFCC)', type: 'line' },
    { key: 'stly_occ', label: 'STLY occupancy % (vs current capacity)', color: 'var(--status-grey, #8A8A8A)', type: 'line' },
  ];

  return (
    <Container
      title="12-month statistical outlook — engine v1 (monthly grain)"
      subtitle={
        run
          ? `Deterministic TS engine (lib/forecast) · run ${run.runDate} · pace ratio ${run.pace.ratio.toFixed(2)} over ${run.pace.observedDays}d · USALI metrics · PMS layer USD`
          : 'Deterministic TS engine (lib/forecast) — no inputs available'
      }
    >
      {run ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <Chart variant="combo" data={engineChart} xKey="month" series={engineChartSeries} height={260} />
          <Chart variant="table" data={engineTable} xKey="month" series={engineTableSeries} />
          <details>
            <summary style={{ cursor: 'pointer', color: 'var(--primary, #1F3A2E)', fontSize: 13, fontWeight: 600 }}>
              Method — transparent formula, no black box
            </summary>
            <p style={{ margin: '8px 0 0', color: 'var(--ink-soft)', fontSize: 12, lineHeight: 1.7, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              {run.method}
            </p>
            <p style={{ margin: '8px 0 0', color: 'var(--ink-soft)', fontSize: 12, lineHeight: 1.6 }}>
              STLY occupancy is shown against current capacity (24 → 30 rooms on 2026-07-01), so LY
              room nights read low as a percentage by design. Confidence is always shown — never hidden.
            </p>
          </details>
        </div>
      ) : (
        placeholderNote('Engine inputs unavailable (v_kpi_daily / v_otb_pace returned no rows). Statistical outlook cannot be computed.')
      )}
    </Container>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function RevenueForecastPage({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: { win?: string; cmp?: string };
}) {
  const propertyId = Number(params.property_id);

  if (propertyId !== NAMKHAN_PROPERTY_ID) {
    return (
      <DonnaRevenueCanonical
        propertyId={propertyId}
        win={searchParams?.win}
        cmp={searchParams?.cmp}
        cfg={REVENUE_SURFACES.forecast}
      />
    );
  }

  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, propertyId);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith('/forecast'),
  }));

  const fc = await getForecastCurrent(propertyId);
  const todayIso = new Date().toISOString().slice(0, 10);

  const [engineRun, commentary, scenarios, latestRuns, recommendations, recStats, journal, reforecasts] =
    await Promise.all([
      runMonthlyForecast(propertyId, fc[0]?.run_date ?? todayIso),
      getCommentary(propertyId),
      getScenarios(propertyId),
      getLatestScenarioRuns(propertyId),
      getRecommendations(propertyId),
      getRecommendationStats(propertyId),
      getLearningJournal(propertyId),
      getReforecastLog(propertyId),
    ]);

  if (fc.length === 0) {
    return (
      <DashboardPage title="Revenue · Forecast" subtitle="365-day occupancy, ADR and revenue forecast · The Namkhan" tabs={tabs}>
        <div style={{ display: 'grid', gap: 16 }}>
          <Container title="No forecast run available" status="red" action={<FindingButton />}>
            <p style={{ margin: 0, color: 'var(--ink)', fontSize: 14 }}>
              The nightly job <code>forecast-daily-run</code> has not produced a current run.
              Check pg_cron job status and <code>public.v_forecast_current</code>.
              The monthly statistical outlook below is computed live and does not depend on it.
            </p>
          </Container>
          <EngineOutlookSection run={engineRun} />
          <ChallengerSection row={commentary.challenger} />
          <InsightSection row={commentary.insight} />
        </div>
      </DashboardPage>
    );
  }

  const runDate = fc[0].run_date;
  const scored = await getScored90d(propertyId, runDate);

  // ── Accuracy (rolling 90d, all lead times — the honest headline) ──
  const apes = scored.map((r) => Number(r.occ_ape_pct)).filter((v) => Number.isFinite(v));
  const mape90 = apes.length ? apes.reduce((a, b) => a + b, 0) / apes.length : null;
  const inBand = scored.filter((r) => r.within_band === true).length;
  const coverage90 = scored.length ? (100 * inBand) / scored.length : null;

  // ── Current-engine coverage (ship gate, §0.V3) ──
  const engineVersion = (fc[0]?.method ?? '').match(/^v\d+(?:\.\d+)?/)?.[0] ?? null;
  const curScored = engineVersion
    ? scored.filter((r) => (r.method ?? '').startsWith(engineVersion + ' ') || r.method === engineVersion)
    : [];
  const curInBand = curScored.filter((r) => r.within_band === true).length;
  const curCoverage = curScored.length ? (100 * curInBand) / curScored.length : null;
  const curApes = curScored.map((r) => Number(r.occ_ape_pct)).filter((v) => Number.isFinite(v));
  const curMape = curApes.length ? curApes.reduce((a, b) => a + b, 0) / curApes.length : null;
  const CUR_MIN_N = 20;

  const mapeStatus: KpiTileProps['status'] =
    mape90 == null ? 'grey' : mape90 <= 10 ? 'green' : mape90 <= 20 ? 'amber' : 'red';

  // ── Outlook aggregates ──
  const next30 = fc.filter((r) => r.days_out <= 30);
  const occ30 = next30.length ? next30.reduce((a, r) => a + Number(r.occ_fc ?? 0), 0) / next30.length : 0;
  const rev30 = next30.reduce((a, r) => a + Number(r.rooms_rev_fc ?? 0), 0);
  const next90 = fc.filter((r) => r.days_out <= 90);
  const occ90 = next90.length ? next90.reduce((a, r) => a + Number(r.occ_fc ?? 0), 0) / next90.length : 0;

  // ── Confidence Model components (owner MD) ──
  const complete = fc.filter((r) => r.adr_fc != null && r.rooms_rev_fc != null).length;
  const completenessPct = fc.length ? (100 * complete) / fc.length : 0;
  const engineMonth1Occ = engineRun?.months?.[0]?.occupancyPctForecast ?? null;
  const agreementGapPp = engineMonth1Occ != null && next30.length ? Math.abs(occ30 * 100 - engineMonth1Occ) : null;
  const reforecasts7d = reforecasts.filter((r) => daysBetween(String(r.checked_at).slice(0, 10), todayIso) <= 7).length;
  const conf = computeConfidence({
    curMape,
    blendMape: mape90,
    curCoverage,
    curN: curScored.length,
    blendCoverage: coverage90,
    runAgeDays: Math.max(0, daysBetween(runDate, todayIso)),
    completenessPct,
    agreementGapPp,
    reforecasts7d,
    challengerAdj: commentary.challenger?.confidence_adjustment ?? null,
  });

  const tiles: KpiTileProps[] = [
    {
      label: 'Forecast accuracy · rolling 90d MAPE',
      value: mape90 == null ? '—' : `${mape90.toFixed(1)}%`,
      status: mapeStatus,
      footnote: `occupancy APE, all lead times · ${scored.length.toLocaleString('en-US')} scored forecasts · lower is better`,
      kpiKey: 'forecast_accuracy_pct',
    },
    {
      label: `Band coverage · current engine${engineVersion ? ` (${engineVersion})` : ''}`,
      value:
        curCoverage == null
          ? '—'
          : curScored.length < CUR_MIN_N
            ? 'calibrating'
            : `${curCoverage.toFixed(0)}%`,
      status:
        curCoverage == null || curScored.length < CUR_MIN_N
          ? 'grey'
          : curCoverage >= 75 ? 'green' : curCoverage >= 60 ? 'amber' : 'red',
      footnote:
        curCoverage == null
          ? 'no scored rows from the live engine yet — forecasts need a few nights to mature'
          : curScored.length < CUR_MIN_N
            ? `n=${curScored.length} live-engine scored rows (needs ≥${CUR_MIN_N}) · interim coverage ${curCoverage.toFixed(0)}% · ship gate ≥75%`
            : `${curScored.length.toLocaleString('en-US')} live-engine scored rows · ship gate ≥75%`,
      kpiKey: 'forecast_confidence_band',
    },
    {
      label: 'Band coverage · 90d all engines',
      value: coverage90 == null ? '—' : `${coverage90.toFixed(0)}%`,
      status: coverage90 != null && coverage90 >= 80 ? 'green' : coverage90 != null && coverage90 >= 60 ? 'amber' : 'red',
      footnote: 'actuals inside p10–p90, every engine version ever run · disclosed history, includes retired engines',
    },
    {
      label: 'Next 30 days · occupancy forecast',
      value: `${(occ30 * 100).toFixed(0)}%`,
      status: 'grey',
      footnote: `rooms revenue forecast $${Math.round(rev30).toLocaleString('en-US')} · PMS layer USD`,
      kpiKey: 'pickup_vs_forecast',
    },
    {
      label: 'Recommendation acceptance',
      value: recStats?.acceptance_rate_pct == null ? '—' : `${recStats.acceptance_rate_pct}%`,
      status: recStats?.acceptance_rate_pct == null ? 'grey' : 'green',
      footnote: recStats
        ? `${recStats.total} proposed · ${recStats.accepted} accepted · ${recStats.executed} executed · ${recStats.dismissed} dismissed`
        : 'no recommendations tracked yet',
    },
  ];

  // ── Monthly buckets, next 12 months ──
  const fromIso = fc[0].stay_date;
  const toIso = fc[fc.length - 1].stay_date;
  const lyByMonth = await getLyRoomsByMonth(propertyId, fromIso, toIso);

  const months = new Map<string, { otb: number; fcr: number; p10: number; p90: number }>();
  for (const r of fc) {
    const key = r.stay_date.slice(0, 7);
    const cur = months.get(key) ?? { otb: 0, fcr: 0, p10: 0, p90: 0 };
    cur.otb += Number(r.otb_rooms ?? 0);
    cur.fcr += Number(r.rooms_fc ?? 0);
    cur.p10 += Number(r.p10 ?? 0);
    cur.p90 += Number(r.p90 ?? 0);
    months.set(key, cur);
  }
  const monthKeys = Array.from(months.keys()).sort().slice(0, 12);

  const chartData = monthKeys.map((key) => {
    const m = months.get(key)!;
    return {
      month: monthLabel(key),
      otb: Math.round(m.otb),
      forecast: Math.round(m.fcr),
      p10: Math.round(m.p10),
      p90: Math.round(m.p90),
      ly: Math.round(lyByMonth.get(key) ?? 0),
    };
  });

  const chartSeries: ChartSeries[] = [
    { key: 'otb', label: 'On the books', color: 'var(--sand, #B8A878)' },
    { key: 'forecast', label: 'Forecast', color: 'var(--primary, #1F3A2E)', type: 'line' },
    { key: 'p10', label: 'p10 (low)', color: 'var(--hairline, #E6DFCC)', type: 'line' },
    { key: 'p90', label: 'p90 (high)', color: 'var(--hairline, #E6DFCC)', type: 'line' },
    { key: 'ly', label: 'Last year actual', color: 'var(--status-grey, #8A8A8A)', type: 'line' },
  ];

  // ── Pickup-needed table ──
  const tableData = monthKeys.map((key) => {
    const m = months.get(key)!;
    const winFrom = key + '-01' < fromIso ? fromIso : key + '-01';
    const winTo = monthEnd(key) > toIso ? toIso : monthEnd(key);
    const cap = capacityRnRange(winFrom, winTo, propertyId);
    const pickup = Math.max(0, Math.round(m.fcr) - Math.round(m.otb));
    return {
      month: monthLabel(key),
      capacity: cap.toLocaleString('en-US'),
      otb: Math.round(m.otb).toLocaleString('en-US'),
      forecast: Math.round(m.fcr).toLocaleString('en-US'),
      pickup_needed: pickup.toLocaleString('en-US'),
      ly_actual: Math.round(lyByMonth.get(key) ?? 0).toLocaleString('en-US'),
      occ_fc: cap > 0 ? `${((100 * m.fcr) / cap).toFixed(0)}%` : '—',
    };
  });

  const tableSeries: ChartSeries[] = [
    { key: 'capacity', label: 'Capacity RN' },
    { key: 'otb', label: 'On the books' },
    { key: 'forecast', label: 'Forecast RN' },
    { key: 'pickup_needed', label: 'Pickup needed' },
    { key: 'ly_actual', label: 'LY actual' },
    { key: 'occ_fc', label: 'Occ forecast' },
  ];

  // ── Accuracy by lead time (error-history panel) ──
  const buckets: Array<{ label: string; min: number; max: number }> = [
    { label: '0–7 days out', min: 0, max: 7 },
    { label: '8–14 days out', min: 8, max: 14 },
    { label: '15–30 days out', min: 15, max: 30 },
    { label: '31–60 days out', min: 31, max: 60 },
    { label: '61+ days out', min: 61, max: 10000 },
  ];
  const accuracyData = buckets.map((b) => {
    const rows = scored.filter((r) => r.days_out >= b.min && r.days_out <= b.max);
    const bApes = rows.map((r) => Number(r.occ_ape_pct)).filter((v) => Number.isFinite(v));
    const bMaes = rows.map((r) => Number(r.occ_abs_err_pp)).filter((v) => Number.isFinite(v));
    const bIn = rows.filter((r) => r.within_band === true).length;
    return {
      bucket: b.label,
      n: rows.length.toLocaleString('en-US'),
      mae_pp: bMaes.length ? `${(bMaes.reduce((a, v) => a + v, 0) / bMaes.length).toFixed(1)} pp` : '—',
      mape_pct: bApes.length ? `${(bApes.reduce((a, v) => a + v, 0) / bApes.length).toFixed(1)}%` : '—',
      coverage: rows.length ? `${((100 * bIn) / rows.length).toFixed(0)}%` : '—',
    };
  });
  const accuracySeries: ChartSeries[] = [
    { key: 'n', label: 'Scored' },
    { key: 'mae_pp', label: 'MAE (occ pts)' },
    { key: 'mape_pct', label: 'MAPE' },
    { key: 'coverage', label: 'In band' },
  ];

  const method = fc[0].method ?? '';

  return (
    <DashboardPage
      title="Revenue · Forecast"
      subtitle="What will happen, why, how confident — and what could improve it · The Namkhan"
      tabs={tabs}
    >
      <div style={{ display: 'grid', gap: 16 }}>
        {/* 1 · The four MD questions, answered in plain language */}
        <ExecutiveSummary
          insight={commentary.insight}
          challenger={commentary.challenger}
          conf={conf}
          runDate={runDate}
          occ30={occ30}
          rev30={rev30}
          occ90={occ90}
        />

        {/* 2 · Findings, risks, opportunities as narrative */}
        <InsightSection row={commentary.insight} />

        {/* 3 · Recommended actions with acceptance tracking (MD success metric) */}
        <Container
          title="Recommended actions — options only, humans and Vector execute"
          subtitle="Accept / dismiss / mark executed — acceptance and execution feed the module's success metrics"
        >
          <RecommendationList rows={recommendations} />
        </Container>

        {/* 4 · The numbers: tiles + forecast band + pickup */}
        <MetricRow tiles={tiles} />

        <Container
          title="Next 12 months — on the books, forecast band, last year"
          subtitle={`Room nights per month · latest run ${runDate} · PMS layer USD`}
        >
          <Chart variant="combo" data={chartData} xKey="month" series={chartSeries} height={320} />
        </Container>

        <Container
          title="Pickup needed by month"
          subtitle="Forecast room nights minus on the books — what the hotel still has to sell"
        >
          <Chart variant="table" data={tableData} xKey="month" series={tableSeries} />
        </Container>

        {/* 5 · Scenario Engine comparison */}
        <ScenarioSection propertyId={propertyId} scenarios={scenarios} latestRuns={latestRuns} />

        {/* 6 · Error history, calibration, learning journal */}
        <ErrorHistorySection scored={scored} journal={journal} accuracyData={accuracyData} accuracySeries={accuracySeries} />

        {/* 7 · Reforecast triggers in words */}
        <ReforecastTimeline rows={reforecasts} />

        {/* 8 · Transparency: how the forecast is computed */}
        <Container
          title="How this forecast is computed"
          subtitle="Transparent formula — no black box. Every component reads a named view."
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <p style={{ margin: 0, color: 'var(--ink)', fontSize: 13, lineHeight: 1.6 }}>
              <strong>rooms = OTB × (1 − cancel rate × w) + w × seasonal baseline × trend</strong>,
              capped at capacity. <em>w</em> is the share of business that typically books inside
              the remaining window, learned from the hotel&apos;s own pace snapshots. Bands (p10–p90)
              come from historical occupancy dispersion by month and day of week.
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-soft)', fontSize: 12.5, lineHeight: 1.8 }}>
              <li>On the books + cancellations → <code>public.v_otb_pace</code> · <code>plan.otb_snapshots</code> (nightly capture)</li>
              <li>Seasonal month × day-of-week baseline (trailing 730d) → <code>kpi.v_kpi_daily</code></li>
              <li>Seasonality index (repaired, 100 = average month) → <code>kpi.v_seasonal_index</code></li>
              <li>Expected cancellations → <code>kpi.v_cancellation_analytics_daily</code></li>
              <li>Capacity per night → <code>core.fn_property_capacity</code></li>
              <li>Every night&apos;s run is scored against actuals → <code>public.v_forecast_vs_actual</code></li>
            </ul>
            <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 12 }}>
              Engine method string (stored on every forecast row): {method}
            </p>
          </div>
        </Container>

        {/* 9 · Independent second model + adversarial review */}
        <EngineOutlookSection run={engineRun} />
        <ChallengerSection row={commentary.challenger} />
      </div>
    </DashboardPage>
  );
}
