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
  if (error) return [];
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
const fmtMoney = (v: number | null | undefined): string =>
  v == null ? '—' : `$${Math.round(v)}`;
const fmtPct = (v: number | null | undefined): string =>
  v == null ? '—' : `${Math.round(v * 10) / 10}%`;

const PRESSURE_COLOR: Record<CockpitRow['pressure'], string> = {
  behind: 'var(--terracotta, #B8542A)',
  ahead: 'var(--status-green, #2E7D32)',
  on_track: 'var(--ink-soft, #6B6B6B)',
  no_forecast: 'var(--status-grey, #8A8A8A)',
};

// ─── Guardrail chip component ─────────────────────────────────────────────

function GuardrailChips({ rows, propertyId }: { rows: GuardrailStatusRow[]; propertyId: number }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--ink-soft)', fontStyle: 'italic' }}>
        No active revenue rules for property {propertyId}
      </div>
    );
  }

  // Sort: breaches first, then ok, then unknown
  const sorted = [...rows].sort((a, b) => {
    const statusOrder = { breach: 0, ok: 1, unknown: 2 };
    const aOrder = statusOrder[a.status] ?? 3;
    const bOrder = statusOrder[b.status] ?? 3;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.rule_key.localeCompare(b.rule_key);
  });

  const chipStyle = (status: 'ok' | 'breach' | 'unknown'): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 11.5,
    fontWeight: 600,
    border: '1px solid',
    borderColor:
      status === 'breach'
        ? 'var(--terracotta, #B8542A)'
        : status === 'ok'
        ? 'var(--status-green, #2E7D32)'
        : 'var(--hairline, #E6DFCC)',
    background:
      status === 'breach'
        ? 'rgba(184, 84, 42, 0.08)'
        : status === 'ok'
        ? 'rgba(46, 125, 50, 0.08)'
        : 'var(--paper, #FFFFFF)',
    color:
      status === 'breach'
        ? 'var(--terracotta, #B8542A)'
        : status === 'ok'
        ? 'var(--status-green, #2E7D32)'
        : 'var(--ink-soft, #6B6B6B)',
  });

  const formatValue = (val: number | null, kind: string): string => {
    if (val == null) return '—';
    if (kind === 'pct') return `${Math.round(val * 10) / 10}%`;
    return String(Math.round(val));
  };

  const formatRuleName = (key: string): string => {
    return key
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 0' }}>
      {sorted.map((r) => (
        <div key={r.rule_key} style={chipStyle(r.status)} title={r.notes ?? undefined}>
          <span>{formatRuleName(r.rule_key)}</span>
          {r.status === 'breach' && (
            <span style={{ fontSize: 10.5 }}>
              {formatValue(r.observed_val, r.threshold_kind)} vs {r.threshold_kind === 'gte' ? '≥' : '≤'}{' '}
              {formatValue(r.threshold_val, r.threshold_kind)}
            </span>
          )}
          {r.status === 'unknown' && <span style={{ fontSize: 10.5 }}>unknown</span>}
          {r.status === 'ok' && <span style={{ fontSize: 10.5 }}>✓</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function RevenueCockpitPage({
  params,
  searchParams,
}: {
  params: { property_id: string };
  // G4 (brief revenue-module-v1): forecast scenario → rate action handoff.
  // The Scenarios page links here with ?propose_rate=&scenario_id=&scenario_title=
  // &scenario_run= so the propose form opens pre-filled; the generated rationale
  // embeds scenario_id + run date (the back-link of the two-way tie).
  searchParams?: {
    propose_rate?: string;
    scenario_id?: string;
    scenario_title?: string;
    scenario_run?: string;
  };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();

  const sp = searchParams ?? {};
  const proposeRateNum = sp.propose_rate != null ? Number(sp.propose_rate) : NaN;
  const scenarioPrefill =
    Number.isFinite(proposeRateNum) && proposeRateNum > 0
      ? {
          proposed: String(Math.round(proposeRateNum)),
          rationale: `Forecast scenario${sp.scenario_id ? ` #${sp.scenario_id}` : ''}${
            sp.scenario_title ? ` "${sp.scenario_title}"` : ''
          }${sp.scenario_run ? ` (run ${sp.scenario_run})` : ''}: what-if projects ADR $${Math.round(
            proposeRateNum
          )}. scenario_id=${sp.scenario_id ?? '?'}`,
        }
      : undefined;

  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const [cockpit, actions, ota, dqIssues, guardrailRows] = await Promise.all([
    getCockpit(pid),
    getRateActions(pid),
    getOtaShare(pid),
    getDqIssues(pid),
    getGuardrailStatus(pid),
  ]);

  const stale = dqIssues.filter((d) => d.status === 'stale');
  const showDqAlert = stale.length > 0;

  // KPI calculation (next 30 days)
  const today = new Date().toISOString().slice(0, 10);
  const next30 = cockpit.filter(
    (r) => r.stay_date >= today && r.stay_date < new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
  );
  const avgAdr = next30.filter((r) => r.otb_rooms > 0).reduce((sum, r, _, a) => sum + r.otb_revenue / r.otb_rooms / a.length, 0);
  const avgOcc = next30.filter((r) => r.occ_fc != null).reduce((sum, r, _, a) => sum + (r.occ_fc ?? 0) / a.length, 0);
  const revPar = avgAdr * (avgOcc / 100);
  const pace = next30.filter((r) => r.ly_rooms != null).reduce((sum, r, _, a) => sum + (r.otb_rooms - (r.ly_rooms ?? 0)) / a.length, 0);

  const otaSharePct = ota?.ota_share_pct;
  const otaBreach =
    ota != null &&
    ota.ota_share_guardrail != null &&
    Number(ota.ota_share_pct) > Number(ota.ota_share_guardrail);

  // Tabs
  const tabs: DashboardTab[] = [
    {
      name: 'Rate Desk',
      id: 'desk',
      subPages,
      activeSubPageId: 'cockpit',
    },
  ];

  // KPI Tiles
  const kpis: KpiTileProps[] = [
    {
      label: 'ADR (next 30d)',
      value: fmtMoney(avgAdr),
      footnote: 'OTB average across next 30 stay-dates',
    },
    {
      label: 'RevPAR (next 30d)',
      value: fmtMoney(revPar),
      footnote: 'ADR × forecast occupancy',
    },
    {
      label: 'Pace (rooms vs LY)',
      value: fmt0(pace),
      footnote: 'avg OTB delta per stay-date next 30d',
    },
    {
      label: 'OTA share (30d)',
      value: otaSharePct != null ? fmtPct(otaSharePct) : '—',
      footnote: `guardrail ≤ ${fmt0(ota?.ota_share_guardrail != null ? Number(ota.ota_share_guardrail) : null)}% (leakage_ota_share)`,
      alert: otaBreach
        ? `OTA share ${fmtPct(otaSharePct)} exceeds guardrail ${fmt0(ota.ota_share_guardrail)}%`
        : undefined,
    },
  ];

  return (
    <DashboardPage title="Revenue" subtitle="Rate desk & decision ledger" tabs={tabs} kpis={kpis}>
      {showDqAlert && (
        <Container>
          <div style={{ padding: '10px 14px', background: 'rgba(184, 84, 42, 0.08)', borderRadius: 8, fontSize: 12.5 }}>
            <strong style={{ color: 'var(--terracotta, #B8542A)' }}>⚠ Data quality alert:</strong>{' '}
            {stale.map((d) => d.label).join(', ')} — stale data may affect forecast accuracy
          </div>
        </Container>
      )}

      {/* Guardrails section */}
      <Container>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Revenue Guardrails</h3>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 8 }}>
          Active rules for property {pid} · next 30 stay-dates
        </p>
        <GuardrailChips rows={guardrailRows} propertyId={pid} />
      </Container>

      {/* Action queue & propose */}
      <Container>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Rate Actions</h3>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 12 }}>
          Proposed changes, approvals, outcomes · guardrail-checked before insert
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>Propose a rate change</h4>
            <ProposeForm propertyId={pid} prefill={scenarioPrefill} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>
              Pending & recent decisions
            </h4>
            <ActionQueue rows={actions} />
          </div>
        </div>
      </Container>

      {/* Pace & forecast chart */}
      <Container>
        <Chart
          title="Pace & forecast (next 90d)"
          subtitle="OTB rooms vs LY, forecast occupancy with P10–P90 band"
          data={cockpit.slice(0, 90).map((r) => ({
            label: r.stay_date.slice(5, 10),
            series: {
              'OTB rooms': r.otb_rooms,
              'LY rooms': r.ly_rooms ?? undefined,
              'Forecast occ (%)': r.occ_fc ?? undefined,
              'P10 (%)': r.occ_p10 ?? undefined,
              'P90 (%)': r.occ_p90 ?? undefined,
            },
          }))}
          height={280}
        />
      </Container>

      {/* Compset & OTA */}
      <Container>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Compset & Channel Mix</h3>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 12 }}>
          Latest shopped rates vs our OTB ADR · OTA exposure vs the 40% guardrail
        </p>
        <MetricRow
          metrics={[
            { label: 'Compset median (next 7d)', value: fmtMoney(next30.slice(0, 7).reduce((sum, r, _, a) => sum + (r.comp_median_usd ?? 0) / a.length, 0)) },
            { label: 'Our ADR (next 7d)', value: fmtMoney(next30.slice(0, 7).filter(r => r.otb_rooms > 0).reduce((sum, r, _, a) => sum + r.otb_revenue / r.otb_rooms / a.length, 0)) },
            {
              label: 'OTA share (30d net revenue)',
              value: otaSharePct != null ? fmtPct(otaSharePct) : '—',
              alert: otaBreach ? 'BREACH' : undefined,
            },
          ]}
        />
        {ota != null && (
          <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--ink-soft)' }}>
            OTA share {fmtPct(ota.ota_share_pct)}{' '}
            vs guardrail ≤{' '}
            {fmt0(ota.ota_share_guardrail != null ? Number(ota.ota_share_guardrail) : null)}%{' '}
            {otaBreach ? (
              <span style={{ color: 'var(--terracotta, #B8542A)' }}>— BREACH (reduce OTA dependency)</span>
            ) : (
              <span style={{ color: 'var(--status-green, #2E7D32)' }}>— inside guardrail</span>
            )}
          </p>
        )}
      </Container>

      {/* Finding button */}
      <Container>
        <FindingButton propertyId={pid} />
      </Container>
    </DashboardPage>
  );
}
