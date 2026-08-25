// app/h/[property_id]/revenue/cockpit/page.tsx
// Revenue Cockpit v1 (brief revenue-module-v1) — the rate desk action surface.
// Answers the owner's 4 questions in order:
//   1. How are we pacing vs LY and vs forecast (next 90d) — and why?
//   2. Where is rate action needed this week, and what exactly is proposed?
//   3. What did the compset do, how exposed are we on OTA mix vs the 40% guardrail?
//   4. What rate decisions were taken, by whom, with what outcome (decision ledger)?
//
// Data: public.v_revenue_cockpit (pace+forecast+compset per stay-date, pace
// numbers PASS-THROUGH from v_otb_pace — no re-derivation drift) ·
// public.v_rate_actions (decision ledger + pickup-since-proposal outcome) ·
// public.v_ota_share_30d (vs leakage_ota_share guardrail) · public.v_dq_posture
// (never render stale silently). All reads via public bridges (L5).
// Writes only through /api/revenue/rate-action → SECURITY DEFINER fns; v1
// NEVER writes to Cloudbeds — execution of an approved rate stays MANUAL,
// logged via 'Mark executed' (PMS write-back is its own future ADR).
// Property-scoped per L6: no hardcoded property ids — route param only.

import { notFound } from 'next/navigation';
import {
  DashboardPage,
  Container,
  Chart,
  MetricRow,
  type DashboardTab,
  type KpiTileProps,
  type StatusTone,
} from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';
import { REVENUE_SUBPAGES } from '@/app/revenue/_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { ActionQueue, ProposeForm, FindingButton, type RateActionRow } from './RateActionPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Types ────────────────────────────────────────────────────────────────

interface CockpitRow {
  property_id: number;
  stay_date: string;
  otb_rooms: number;
  otb_revenue: number;
  cancelled_rooms: number;
  ly_rooms: number | null;
  ly_revenue: number | null;
  ly_adr: number | null;
  rooms_fc: number | null;
  occ_fc: number | null;
  adr_fc: number | null;
  occ_p10: number | null;
  occ_p90: number | null;
  fc_method: string | null;
  fc_run_date: string | null;
  comp_median_usd: number | null;
  comp_min_usd: number | null;
  comp_max_usd: number | null;
  comp_quotes: number | null;
  pressure: 'behind' | 'on_track' | 'ahead' | 'no_forecast';
}

interface OtaShareRow {
  property_id: number;
  ota_share_pct: number | null;
  net_revenue_30d: number | null;
  ota_share_guardrail: number | null;
}

interface DqRow {
  source: string;
  label: string;
  status: string;
  age_minutes: number | null;
}

// Decision ledger row (bridge public.v_rate_action_outcomes — outcome vs the
// at-proposal baseline, verdicts computed in SQL, measures_on for pending).
interface RateActionOutcomeRow {
  id: number;
  property_id: number;
  stay_date_start: string;
  stay_date_end: string;
  current_rate: number | null;
  proposed_rate: number;
  currency: string | null;
  rationale: string | null;
  rationale_ref: { scenario_id?: string | number } | null;
  status: string;
  proposed_by: string | null;
  decided_by: string | null;
  decided_at: string | null;
  executed_at: string | null;
  executed_by: string | null;
  otb_rooms_at_proposal: number | null;
  otb_revenue_at_proposal: number | null;
  outcome_measured_at: string | null;
  d14_pickup_rooms: number | null;
  d14_pickup_revenue: number | null;
  d30_pickup_rooms: number | null;
  d30_pickup_revenue: number | null;
  d14_verdict: string | null;
  d30_verdict: string | null;
  d14_measures_on: string | null;
  d30_measures_on: string | null;
}

interface JournalRefRow {
  id: number;
  reason: string | null;
}

interface GuardrailStatusRow {
  property_id: number;
  rule_key: string;
  threshold_kind: string;
  threshold_val: number;
  observed_val: number | null;
  status: 'ok' | 'breach' | 'unknown';
  last_evaluated: string;
  notes: string | null;
}

// ─── Reads (public bridges only, L5) ──────────────────────────────────────

async function getCockpit(pid: number): Promise<CockpitRow[]> {
  const { data, error } = await supabase
    .from('v_revenue_cockpit')
    .select('*')
    .eq('property_id', pid)
    .order('stay_date');
  if (error) throw new Error(`v_revenue_cockpit: ${error.message}`);
  return (data ?? []) as CockpitRow[];
}

async function getRateActions(pid: number): Promise<RateActionRow[]> {
  const { data, error } = await supabase
    .from('v_rate_actions')
    .select('*')
    .eq('property_id', pid)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(`v_rate_actions: ${error.message}`);
  return (data ?? []) as RateActionRow[];
}

// Decision ledger: decided actions with measured outcome vs at-proposal
// baseline (learning loop — brief revenue-module-v1-slice-outcome-learning-loop).
async function getActionOutcomes(pid: number): Promise<RateActionOutcomeRow[]> {
  const { data, error } = await supabase
    .from('v_rate_action_outcomes')
    .select('*')
    .eq('property_id', pid)
    .neq('status', 'proposed')
    .order('id', { ascending: false })
    .limit(100);
  if (error) throw new Error(`v_rate_action_outcomes: ${error.message}`);
  return (data ?? []) as RateActionOutcomeRow[];
}

// Journal back-links: which rate actions already have a learning-journal entry
// (fn_rate_action_journal_outcomes encodes "rate_action_id=<id>" in reason).
async function getJournaledActionIds(pid: number): Promise<Set<number>> {
  const { data, error } = await supabase
    .from('v_forecast_learning_journal')
    .select('id, reason')
    .eq('property_id', pid)
    .eq('engine_method', 'rate_action')
    .limit(500);
  if (error) return new Set();
  const ids = new Set<number>();
  ((data ?? []) as JournalRefRow[]).forEach((j) => {
    const m = /rate_action_id=(\d+)/.exec(j.reason ?? '');
    if (m) ids.add(Number(m[1]));
  });
  return ids;
}

async function getOtaShare(pid: number): Promise<OtaShareRow | null> {
  const { data, error } = await supabase
    .from('v_ota_share_30d')
    .select('*')
    .eq('property_id', pid)
    .maybeSingle();
  if (error) return null;
  return data as OtaShareRow | null;
}

async function getDqIssues(pid: number): Promise<DqRow[]> {
  const { data, error } = await supabase
    .from('v_dq_posture')
    .select('source,label,status,age_minutes')
    .eq('property_id', pid)
    .in('status', ['stale', 'unknown']);
  if (error) throw new Error(`v_dq_posture: ${error.message}`);
  return (data ?? []) as DqRow[];
}

async function getGuardrailStatus(pid: number): Promise<GuardrailStatusRow[]> {
  const { data, error } = await supabase
    .from('v_revenue_guardrail_status')
    .select('*')
    .eq('property_id', pid);
  if (error) throw new Error(`v_revenue_guardrail_status: ${error.message}`);
  return (data ?? []) as GuardrailStatusRow[];
}

// ─── Helpers (no toLocale* — hydration-safe) ──────────────────────────────

const fmt0 = (v: number | null | undefined): string =>
  v == null ? '—' : String(Math.round(v));

const fmt2 = (v: number | null | undefined): string =>
  v == null ? '—' : String(Math.round(v * 100) / 100);

const pct = (v: number | null | undefined): string =>
  v == null ? '—' : String(Math.round(v * 100)) + '%';

const deltaPct = (now: number | null | undefined, was: number | null | undefined): string => {
  if (now == null || was == null || was === 0) return '—';
  const d = ((now - was) / was) * 100;
  return (d > 0 ? '+' : '') + String(Math.round(d)) + '%';
};

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

const daysDiff = (isoFrom: string, isoTo: string): number => {
  const from = new Date(isoFrom);
  const to = new Date(isoTo);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
};

// ─── Main ──────────────────────────────────────────────────────────────────

export default async function Page({
  params,
}: {
  params: Promise<{ property_id: string }>;
}) {
  const { property_id: pidStr } = await params;
  const pid = Number(pidStr);
  if (!pid || isNaN(pid)) notFound();

  // Parallel read (all v_* bridges, L5 contract).
  const [
    cockpitRows,
    actions,
    outcomes,
    journaledIds,
    otaShare,
    dqIssues,
    guardrailStatus,
  ] = await Promise.all([
    getCockpit(pid),
    getRateActions(pid),
    getActionOutcomes(pid),
    getJournaledActionIds(pid),
    getOtaShare(pid),
    getDqIssues(pid),
    getGuardrailStatus(pid),
  ]);

  // Enrich outcomes with journal link
  const enrichedOutcomes = outcomes.map((o) => ({
    ...o,
    has_journal_entry: journaledIds.has(o.id),
  }));

  // 1. Pace vs LY (next 90d)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const future90 = new Date(today);
  future90.setUTCDate(future90.getUTCDate() + 90);

  const next90Rows = cockpitRows.filter((r) => {
    const d = new Date(r.stay_date);
    return d >= today && d < future90;
  });

  const otbRooms = next90Rows.reduce((s, r) => s + r.otb_rooms, 0);
  const otbRev = next90Rows.reduce((s, r) => s + r.otb_revenue, 0);
  const lyRooms = next90Rows.reduce((s, r) => s + (r.ly_rooms ?? 0), 0);
  const lyRev = next90Rows.reduce((s, r) => s + (r.ly_revenue ?? 0), 0);

  const roomsDelta = lyRooms > 0 ? ((otbRooms - lyRooms) / lyRooms) * 100 : null;
  const revDelta = lyRev > 0 ? ((otbRev - lyRev) / lyRev) * 100 : null;

  const roomsTone: StatusTone =
    roomsDelta == null ? 'neutral' : roomsDelta > 0 ? 'success' : 'error';
  const revTone: StatusTone =
    revDelta == null ? 'neutral' : revDelta > 0 ? 'success' : 'error';

  // Pressure distribution
  const pressureCounts = next90Rows.reduce(
    (acc, r) => {
      acc[r.pressure] = (acc[r.pressure] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const totalDays = next90Rows.length;
  const behindPct =
    totalDays > 0 ? ((pressureCounts['behind'] || 0) / totalDays) * 100 : 0;
  const aheadPct =
    totalDays > 0 ? ((pressureCounts['ahead'] || 0) / totalDays) * 100 : 0;

  const pressureTone: StatusTone =
    behindPct > 40 ? 'error' : behindPct > 20 ? 'warning' : 'success';

  // 2. OTA share vs guardrail
  const otaSharePct = otaShare?.ota_share_pct ?? null;
  const otaGuardrail = otaShare?.ota_share_guardrail ?? 40;
  const otaBreach = otaSharePct != null && otaSharePct > otaGuardrail;
  const otaTone: StatusTone = otaBreach ? 'error' : 'success';

  // 3. Guardrail status (revenue rules)
  const breaches = guardrailStatus.filter((g) => g.status === 'breach');
  const guardrailTone: StatusTone = breaches.length > 0 ? 'error' : 'success';

  // 4. DQ freshness (never render stale silently)
  const stale = dqIssues.filter((d) => d.status === 'stale');
  const showDqAlert = stale.length > 0;
  const dqMessage =
    stale.length > 0
      ? `${stale.length} DQ check${stale.length > 1 ? 's' : ''} stale (${stale.map((s) => s.label).join(', ')})`
      : null;

  // Tabs
  const tabs: DashboardTab[] = rewriteSubPagesForProperty(
    REVENUE_SUBPAGES.map((sp) => ({ label: sp.label, href: sp.href })),
    pidStr
  );

  // KPI tiles
  const tiles: KpiTileProps[] = [
    {
      label: 'OTB Rooms (90d)',
      value: fmt0(otbRooms),
      delta: roomsDelta != null ? `${roomsDelta > 0 ? '+' : ''}${fmt2(roomsDelta)}% vs LY` : undefined,
      tone: roomsTone,
    },
    {
      label: 'OTB Revenue (90d)',
      value: `$${fmt0(otbRev)}`,
      delta: revDelta != null ? `${revDelta > 0 ? '+' : ''}${fmt2(revDelta)}% vs LY` : undefined,
      tone: revTone,
    },
    {
      label: 'Pressure',
      value: `${fmt0(behindPct)}% behind`,
      delta: `${fmt0(aheadPct)}% ahead`,
      tone: pressureTone,
    },
    {
      label: 'OTA Share (30d)',
      value: otaSharePct != null ? pct(otaSharePct / 100) : '—',
      delta: otaBreach ? `Exceeds ${otaGuardrail}% guardrail` : undefined,
      tone: otaTone,
    },
    {
      label: 'Guardrails',
      value: breaches.length > 0 ? `${breaches.length} breach${breaches.length > 1 ? 'es' : ''}` : 'All OK',
      tone: guardrailTone,
    },
  ];

  // Chart data (pace next 30d, simplified for v1)
  const next30 = new Date(today);
  next30.setUTCDate(next30.getUTCDate() + 30);
  const chartRows = cockpitRows.filter((r) => {
    const d = new Date(r.stay_date);
    return d >= today && d < next30;
  });

  const chartData = chartRows.map((r) => ({
    label: fmtDate(r.stay_date),
    values: [
      { key: 'OTB', value: r.otb_rooms },
      { key: 'LY', value: r.ly_rooms ?? 0 },
      { key: 'FC', value: r.rooms_fc ?? 0 },
    ],
  }));

  return (
    <DashboardPage
      dept="revenue"
      pageTitle="Revenue Cockpit"
      tabs={tabs}
      currentTab={0}
      kpiTiles={tiles}
      alertBanner={
        showDqAlert && dqMessage
          ? { message: dqMessage, tone: 'warning' as StatusTone }
          : undefined
      }
    >
      <Container title="Pace & Pressure (Next 30d)">
        <Chart
          type="bar"
          data={chartData}
          height={300}
          colors={['#3b82f6', '#94a3b8', '#10b981']}
        />
      </Container>

      <Container title="Rate Actions">
        <ActionQueue actions={actions} propertyId={pid} />
      </Container>

      <Container title="Decision Ledger">
        <MetricRow
          label="Recent Decisions"
          value={String(enrichedOutcomes.length)}
          tone="neutral"
        />
        {enrichedOutcomes.slice(0, 10).map((o) => (
          <div key={o.id} style={{ marginBottom: '12px', fontSize: '14px' }}>
            <div>
              <strong>
                {fmtDate(o.stay_date_start)} – {fmtDate(o.stay_date_end)}
              </strong>
              {': '}
              {o.current_rate != null
                ? `$${fmt0(o.current_rate)} → $${fmt0(o.proposed_rate)}`
                : `$${fmt0(o.proposed_rate)}`}
              {' • '}
              <span style={{ textTransform: 'capitalize' }}>{o.status}</span>
            </div>
            {o.rationale && <div style={{ color: '#64748b', fontSize: '13px' }}>{o.rationale}</div>}
            {o.d14_verdict && (
              <div style={{ fontSize: '13px', color: '#059669' }}>
                14d: {o.d14_verdict} ({o.d14_pickup_rooms != null ? `+${fmt0(o.d14_pickup_rooms)} rm` : '—'}
                {', '}
                {o.d14_pickup_revenue != null ? `+$${fmt0(o.d14_pickup_revenue)}` : '—'})
              </div>
            )}
            {o.d30_verdict && (
              <div style={{ fontSize: '13px', color: '#059669' }}>
                30d: {o.d30_verdict} ({o.d30_pickup_rooms != null ? `+${fmt0(o.d30_pickup_rooms)} rm` : '—'}
                {', '}
                {o.d30_pickup_revenue != null ? `+$${fmt0(o.d30_pickup_revenue)}` : '—'})
              </div>
            )}
            {o.d14_measures_on && (
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Measures on: {fmtDate(o.d14_measures_on)}
              </div>
            )}
          </div>
        ))}
      </Container>

      <Container title="Propose Rate Change">
        <ProposeForm propertyId={pid} />
      </Container>

      <Container title="Finding">
        <FindingButton propertyId={pid} />
      </Container>
    </DashboardPage>
  );
}
