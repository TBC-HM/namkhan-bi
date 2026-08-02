// app/h/[property_id]/revenue/forecast/page.tsx
// Namkhan: Forecasting module v1 dashboard (brief module-forecasting-v1, A7).
// PBS gate ruling 2026-07-27: "Ship the dashboard now, with the rolling MAPE
// accuracy tile front and center." Accuracy is shown honestly — the model's
// tracked error leads the page; nothing is presented as more certain than it is.
//
// Data: public.v_forecast_current (latest nightly run, 365d horizon) ·
// public.v_forecast_vs_actual (every past forecast scored vs actuals) ·
// public.mv_kpi_daily (LY actual rooms). All reads via public bridges
// (claude_md §0.5). Currency layer: PMS/transaction USD (ADR-111/173).
//
// Donna branch: canonical empty-state surface, untouched (Donna deferred,
// ADR-173).
//
// §0.V3 round (2026-08-02): accuracy tile split — "current engine" coverage
// (scored rows filtered to the latest run's engine version, min-n guard 20)
// is the ship gate; the blended 90d tile remains as disclosed history.
// Requires `method` exposed in public.v_forecast_vs_actual (migration
// forecast_v1_expose_method_in_vs_actual).
//
// Extension (brief forecasting-module-v1, build/forecasting): 12-month
// statistical outlook from the deterministic TS engine in lib/forecast/
// (STLY baseline + OTB + pickup-pace projection, variance bands) rendered
// below the nightly-run sections, plus clearly-marked placeholder slots for
// the v2 LLM layers (Challenger / Insight / Scenario+Recommendation —
// recommend-never-execute, BINDING rule 1). The engine section also renders
// when the nightly run is missing, so the page degrades honestly instead of
// going dark.

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

// LLM commentary layer (forecast-commentary edge fn → forecast.run_commentary,
// read via public.v_forecast_commentary). Content is agent-written jsonb —
// every field is optional and rendered defensively. BINDING rule 1: this layer
// never alters the statistical numbers above it.
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

// ─── Fetchers ─────────────────────────────────────────────────────────────

async function getForecastCurrent(pid: number): Promise<ForecastRow[]> {
  const { data, error } = await supabase
    .from('v_forecast_current')
    .select('run_date, stay_date, days_out, otb_rooms, rooms_fc, occ_fc, adr_fc, rooms_rev_fc, p10, p90, method')
    .eq('property_id', pid)
    .order('stay_date')
    .limit(1000); // horizon is 365 rows — well under the PostgREST cap
  if (error) { console.error('[forecast] v_forecast_current', error); return []; }
  return (data ?? []) as ForecastRow[];
}

// v_forecast_vs_actual grows daily (one row per run×stay pair). Page through
// PostgREST's 1000-row window (§0.66 lesson — never trust a single fetch).
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

async function getLyRoomsByMonth(pid: number, fromIso: string, toIso: string): Promise<Map<string, number>> {
  // LY window = forecast window shifted −1 year; bucket by the FORECAST month key.
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

// ─── Statistical engine v1 section (lib/forecast) ─────────────────────────
// Monthly-grain 12-month outlook: Occupancy %, ADR, RevPAR, Rooms Revenue
// (USALI names, PMS-layer USD). Deterministic statistics only — the three
// panels after the table are PLACEHOLDER SLOTS for the v2 LLM layers and
// render no generated content in v1.

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
        placeholderNote(
          'No Challenger review yet for the latest run. The nightly forecast-commentary agent (19:00 UTC) attempts to prove the forecast wrong and adjusts confidence. It never changes the statistical numbers above.',
        )
      )}
    </Container>
  );
}

function InsightSection({ row }: { row: CommentaryRow | null }) {
  const c = (row?.content ?? null) as InsightContent | null;
  return (
    <Container
      title="Insight — findings, drivers, risks, opportunities"
      subtitle={
        row
          ? `LLM framing of run ${row.run_date} · recommendations only, humans and Vector execute · ${row.model ?? ''}`
          : 'Numbers → business findings (e.g. demand shifted later than the historical booking window)'
      }
      status={c ? undefined : 'grey'}
    >
      {c ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {c.summary ? <p style={{ margin: 0, color: 'var(--ink)', fontSize: 13, lineHeight: 1.6 }}>{c.summary}</p> : null}
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
          {listBlock('Drivers', c.drivers)}
          {listBlock('Risks', c.risks)}
          {listBlock('Opportunities', c.opportunities)}
          {(c.recommended_actions ?? []).length > 0 ? (
            <div>
              <p style={{ margin: '0 0 4px', color: 'var(--ink)', fontSize: 12.5, fontWeight: 600 }}>
                Recommended actions — recommend only, never execute
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-soft)', fontSize: 12.5, lineHeight: 1.7 }}>
                {(c.recommended_actions ?? []).map((a, i) => (
                  <li key={i}>{a.action ?? ''}{a.rationale ? ` — ${a.rationale}` : ''}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        placeholderNote(
          'No Insight yet for the latest run. The nightly forecast-commentary agent (19:00 UTC) turns the engine output into named business findings with confidence levels. Framing only — the forecast itself stays statistical.',
        )
      )}
    </Container>
  );
}

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
    <>
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
                STLY occupancy is shown against current capacity (24 → 30 rooms on 2026-07-01), so
                LY room nights read low as a percentage by design. Cancellation risk is modeled at
                daily grain by the nightly engine, not at monthly grain in v1. Confidence is always
                shown — never hidden.
              </p>
            </details>
          </div>
        ) : (
          placeholderNote(
            'Engine inputs unavailable (v_kpi_daily / v_otb_pace returned no rows). Statistical outlook cannot be computed.',
          )
        )}
      </Container>

      <Container
        title="Scenarios & recommendations — placeholder (v2 LLM slot)"
        subtitle="What-if comparisons over engine runs · options only — recommend, never execute"
        status="grey"
      >
        {placeholderNote(
          'Not yet active. In v2 the Scenario agent compares alternative futures and the Recommendation agent proposes commercial responses. Nothing here will ever execute a price, inventory or channel change — humans and Vector decide.',
        )}
      </Container>
    </>
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

  // TS engine v1 (lib/forecast) — independent of the nightly run, so the
  // statistical outlook still renders when forecast-daily-run is down.
  const todayIso = new Date().toISOString().slice(0, 10);
  const [engineRun, commentary] = await Promise.all([
    runMonthlyForecast(propertyId, fc[0]?.run_date ?? todayIso),
    getCommentary(propertyId),
  ]);

  if (fc.length === 0) {
    return (
      <DashboardPage title="Revenue · Forecast" subtitle="365-day occupancy, ADR and revenue forecast · The Namkhan" tabs={tabs}>
        <div style={{ display: 'grid', gap: 16 }}>
          <Container title="No forecast run available" status="red">
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

  // ── Current-engine coverage (verifier §0.V3 objection) ──
  // The blended 90d pool is dominated by retired-engine rows, so it can never
  // open the ship gate on time — it measures history, not the engine that is
  // actually running. Filter scored rows to the engine version of the LATEST
  // run (method strings are versioned: "v1.3 additive pickup: …") and judge
  // the live engine on its own rows, with a min-n guard so a thin sample never
  // shows green. The blended tile stays — disclosed history, never hidden.
  const engineVersion = (fc[0]?.method ?? '').match(/^v\d+(?:\.\d+)?/)?.[0] ?? null;
  const curScored = engineVersion
    ? scored.filter((r) => (r.method ?? '').startsWith(engineVersion + ' ') || r.method === engineVersion)
    : [];
  const curInBand = curScored.filter((r) => r.within_band === true).length;
  const curCoverage = curScored.length ? (100 * curInBand) / curScored.length : null;
  const CUR_MIN_N = 20; // below this the sample cannot validate the 80% band design

  const mapeStatus: KpiTileProps['status'] =
    mape90 == null ? 'grey' : mape90 <= 10 ? 'green' : mape90 <= 20 ? 'amber' : 'red';

  // ── Next-30-day outlook ──
  const next30 = fc.filter((r) => r.days_out <= 30);
  const occ30 = next30.length
    ? next30.reduce((a, r) => a + Number(r.occ_fc ?? 0), 0) / next30.length
    : 0;
  const rev30 = next30.reduce((a, r) => a + Number(r.rooms_rev_fc ?? 0), 0);

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
      label: 'Horizon · latest run',
      value: `${fc.length}d`,
      status: 'green',
      footnote: `nightly run ${runDate} · pg_cron forecast-daily-run 18:15 UTC`,
      kpiKey: 'forecast_horizon_days',
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

  // ── Accuracy by lead time (drill) ──
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
      subtitle="365-day occupancy, ADR and revenue forecast · The Namkhan"
      tabs={tabs}
    >
      <div style={{ display: 'grid', gap: 16 }}>
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
            <details>
              <summary style={{ cursor: 'pointer', color: 'var(--primary, #1F3A2E)', fontSize: 13, fontWeight: 600 }}>
                Accuracy by lead time (rolling 90 days)
              </summary>
              <div style={{ marginTop: 12 }}>
                <Chart variant="table" data={accuracyData} xKey="bucket" series={accuracySeries} />
                <p style={{ margin: '8px 0 0', color: 'var(--ink-soft)', fontSize: 12 }}>
                  A 24-room property moves ~4 occupancy points per room — judge accuracy at month
                  grain, not day grain. The model self-corrects as pace history accrues; every
                  night adds scored observations.
                </p>
              </div>
            </details>
          </div>
        </Container>

        <EngineOutlookSection run={engineRun} />
        <ChallengerSection row={commentary.challenger} />
        <InsightSection row={commentary.insight} />
      </div>
    </DashboardPage>
  );
}
