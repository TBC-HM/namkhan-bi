// app/h/[property_id]/revenue/forecast/scenarios/page.tsx
// F8: Scenario Engine subtab within forecasting surface (PBS 2026-08-04)
// Deterministic what-if recompute over the current statistical forecast.
// Recommend-never-execute (Commercial DNA).

import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import {
  DashboardPage,
  Container,
  Chart,
  type ChartSeries,
  type DashboardTab,
} from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';
import { REVENUE_SUBPAGES } from '@/app/revenue/_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import DonnaRevenueCanonical from '../../_DonnaRevenueCanonical';
import { REVENUE_SURFACES } from '../../_surfaces';
import {
  ScenarioRunButtons,
  CustomScenarioForm,
  type ScenarioDef,
} from '../ForecastActions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ScenarioRunRow {
  scenario_id: number;
  base_run_date: string;
  horizon_days: number;
  outputs: Record<string, unknown> | null;
  method: string;
  narrative: string | null;
  created_at: string;
}

// ─── Fetchers ─────────────────────────────────────────────────────────────

async function getScenarios(pid: number): Promise<ScenarioDef[]> {
  const { data, error } = await supabase
    .from('v_forecast_scenarios')
    .select('id, property_id, scenario_kind, title, parameters')
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
    .order('scenario_id')
    .order('created_at', { ascending: false });
  if (error) { console.error('[forecast] v_forecast_scenario_runs', error); return new Map(); }
  const rows = (data ?? []) as ScenarioRunRow[];
  const m = new Map<number, ScenarioRunRow>();
  rows.forEach((r) => { if (!m.has(r.scenario_id)) m.set(r.scenario_id, r); });
  return m;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const fmtNum = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '—';
const fmtSigned = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v)
    ? `${v >= 0 ? '+' : ''}${Math.round(v).toLocaleString('en-US')}`
    : '—';

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

// ─── Scenario Section (moved from parent page) ────────────────────────────

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

// ─── Main page ────────────────────────────────────────────────────────────

export default async function RevenueForecastScenariosPage({
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

  const [scenarios, latestRuns] = await Promise.all([
    getScenarios(propertyId),
    getLatestScenarioRuns(propertyId),
  ]);

  return (
    <DashboardPage
      title="Revenue · Scenarios"
      subtitle="What-if alternatives over the current forecast · The Namkhan"
      tabs={tabs}
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <ScenarioSection propertyId={propertyId} scenarios={scenarios} latestRuns={latestRuns} />
      </div>
    </DashboardPage>
  );
}
