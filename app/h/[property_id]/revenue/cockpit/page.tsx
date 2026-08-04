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

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function RevenueCockpitPage({
  params,
}: {
  params: { property_id: string };
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();

  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
  }));

  const [rows, actions, ota, dq] = await Promise.all([
    getCockpit(pid),
    getRateActions(pid),
    getOtaShare(pid),
    getDqIssues(pid),
  ]);

  const next30 = rows.slice(0, 30);
  const otb30 = next30.reduce((s, r) => s + (r.otb_rooms ?? 0), 0);
  const ly30 = next30.reduce((s, r) => s + (r.ly_rooms ?? 0), 0);
  const fc30 = next30.reduce((s, r) => s + (r.rooms_fc != null ? Number(r.rooms_fc) : 0), 0);
  const rev30 = next30.reduce((s, r) => s + (r.otb_revenue != null ? Number(r.otb_revenue) : 0), 0);
  const adr30 = otb30 > 0 ? rev30 / otb30 : null;
  const behindDates = rows.filter((r) => r.pressure === 'behind').length;
  const proposed = actions.filter((a) => a.status === 'proposed');
  const approvedOpen = actions.filter((a) => a.status === 'approved');
  const ledger = actions.filter((a) => a.status !== 'proposed');
  const otaOver =
    ota?.ota_share_pct != null &&
    ota.ota_share_guardrail != null &&
    Number(ota.ota_share_pct) > Number(ota.ota_share_guardrail);

  const kpis: KpiTileProps[] = [
    {
      label: 'OTB · next 30d',
      value: fmt0(otb30),
      unit: 'rooms',
      footnote: `vs LY ${fmt0(ly30)} · vs forecast ${fmt0(fc30)}`,
    },
    {
      label: 'OTB ADR · next 30d',
      value: fmtMoney(adr30),
      footnote: 'PMS layer · USD',
    },
    {
      label: 'Dates behind forecast',
      value: fmt0(behindDates),
      unit: 'of 90',
      status: behindDates > 10 ? 'amber' : undefined,
      footnote: 'OTB below forecast band',
    },
    {
      label: 'Actions awaiting PBS',
      value: fmt0(proposed.length),
      status: proposed.length > 0 ? 'amber' : undefined,
      footnote: `${fmt0(approvedOpen.length)} approved, not yet executed`,
    },
    {
      label: 'OTA share · 30d',
      value: fmtPct(ota?.ota_share_pct != null ? Number(ota.ota_share_pct) : null),
      status: otaOver ? 'red' : undefined,
      footnote: `guardrail ≤ ${fmt0(ota?.ota_share_guardrail != null ? Number(ota.ota_share_guardrail) : null)}% (leakage_ota_share)`,
    },
  ];

  const chartData = rows.map((r) => ({
    date: r.stay_date.slice(5, 10),
    OTB: r.otb_rooms,
    LY: r.ly_rooms ?? 0,
    Forecast: r.rooms_fc != null ? Math.round(Number(r.rooms_fc) * 10) / 10 : null,
  }));

  const withComp = rows.filter((r) => r.comp_median_usd != null);
  const compMed =
    withComp.length > 0
      ? withComp.reduce((s, r) => s + Number(r.comp_median_usd), 0) / withComp.length
      : null;
  const ari = adr30 != null && compMed != null && compMed > 0 ? (adr30 / compMed) * 100 : null;

  return (
    <DashboardPage
      title="Revenue · Cockpit"
      subtitle="Rate desk — pace, proposed actions, compset, decision ledger"
      tabs={tabs}
      action={<FindingButton />}
    >
      {dq.length > 0 && (
        <div
          style={{
            border: '1px solid var(--terracotta, #B8542A)',
            borderRadius: 8,
            padding: '8px 12px',
            marginBottom: 12,
            fontSize: 12.5,
            color: 'var(--terracotta, #B8542A)',
          }}
        >
          Data freshness: {dq.map((d) => `${d.label ?? d.source} is ${d.status}`).join(' · ')} —
          numbers below may lag. (v_dq_posture)
        </div>
      )}

      <MetricRow tiles={kpis} />

      <Container
        title="Pace board · next 90 days"
        subtitle="OTB vs LY vs forecast per stay-date — click a date to drill into pickup"
      >
        {rows.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, fontStyle: 'italic', color: 'var(--ink-soft)' }}>
            No OTB rows for this property yet — pace board lights up when the PMS feed lands.
          </p>
        ) : (
          <>
            <Chart
              variant="line"
              data={chartData}
              xKey="date"
              series={[
                { key: 'OTB', label: 'OTB rooms', color: 'var(--primary, #1F3A2E)' },
                { key: 'LY', label: 'Same date LY (final)', color: 'var(--status-grey, #8A8A8A)' },
                { key: 'Forecast', label: 'Forecast rooms', color: 'var(--terracotta, #B8542A)' },
              ]}
              height={240}
              legend="top"
            />
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--ink-soft)' }}>
                    <th style={{ padding: '4px 8px' }}>Stay date</th>
                    <th style={{ padding: '4px 8px' }}>OTB</th>
                    <th style={{ padding: '4px 8px' }}>LY final</th>
                    <th style={{ padding: '4px 8px' }}>Forecast</th>
                    <th style={{ padding: '4px 8px' }}>Comp median</th>
                    <th style={{ padding: '4px 8px' }}>Pressure</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 21).map((r) => (
                    <tr key={r.stay_date} style={{ borderTop: '1px solid var(--hairline, #E6DFCC)' }}>
                      <td style={{ padding: '4px 8px' }}>
                        <a href="pickup" style={{ color: 'var(--primary, #1F3A2E)' }}>
                          {r.stay_date.slice(0, 10)}
                        </a>
                      </td>
                      <td style={{ padding: '4px 8px' }}>{fmt0(r.otb_rooms)}</td>
                      <td style={{ padding: '4px 8px' }}>{fmt0(r.ly_rooms)}</td>
                      <td style={{ padding: '4px 8px' }}>
                        {r.rooms_fc != null ? fmt0(Number(r.rooms_fc)) : '—'}
                      </td>
                      <td style={{ padding: '4px 8px' }}>{fmtMoney(r.comp_median_usd)}</td>
                      <td
                        style={{
                          padding: '4px 8px',
                          fontWeight: 600,
                          color: PRESSURE_COLOR[r.pressure],
                        }}
                      >
                        {r.pressure.replace('_', ' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Container>

      <Container
        title="Action queue"
        subtitle="Proposed rate actions — your gate; nothing auto-executes"
        action={<ProposeForm propertyId={pid} />}
        status={proposed.length > 0 ? 'amber' : undefined}
      >
        <ActionQueue rows={[...proposed, ...approvedOpen]} />
      </Container>

      <Container
        title="Compset"
        subtitle="Latest shopped rates vs our OTB ADR · OTA exposure vs the 40% guardrail"
      >
        {withComp.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, fontStyle: 'italic', color: 'var(--ink-soft)' }}>
            No compset quotes shopped for the next 90 days — check the Lighthouse feed on the
            comp-set page.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
            <span>
              Comp median next 90d ≈ <strong>{fmtMoney(compMed)}</strong> · our OTB ADR{' '}
              <strong>{fmtMoney(adr30)}</strong> · ARI{' '}
              <strong>{ari != null ? `${Math.round(ari)}` : '—'}</strong>{' '}
              <span style={{ color: 'var(--ink-soft)' }}>
                (100 = priced level with compset; MPI/RGI need comp occupancy — not in the feed)
              </span>
            </span>
            {ota == null ? (
              <span style={{ color: 'var(--terracotta, #B8542A)' }}>
                OTA share 30d: unavailable — the channel feed (channel_metrics) has no rows in
                the 30d window, so the meter is suppressed rather than rendered as zero. Feed
                freshness is tracked in the data-freshness banner (v_dq_posture).
              </span>
            ) : (
              <span>
                OTA share 30d:{' '}
                <strong>{fmtPct(ota.ota_share_pct != null ? Number(ota.ota_share_pct) : null)}</strong>{' '}
                vs guardrail ≤{' '}
                {fmt0(ota.ota_share_guardrail != null ? Number(ota.ota_share_guardrail) : null)}%{' '}
                {otaOver ? (
                  <strong style={{ color: 'var(--terracotta, #B8542A)' }}>
                    — OVER, direct push needed
                  </strong>
                ) : (
                  <span style={{ color: 'var(--status-green, #2E7D32)' }}>— inside guardrail</span>
                )}
              </span>
            )}
            <a href="compset" style={{ color: 'var(--primary, #1F3A2E)', fontSize: 12 }}>
              Full comp-set analysis →
            </a>
          </div>
        )}
      </Container>

      <Container
        title="Decision ledger"
        subtitle="Every rate decision — who, what, and measured pickup since proposal"
      >
        {ledger.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, fontStyle: 'italic', color: 'var(--ink-soft)' }}>
            No decisions yet — the ledger fills as actions are approved, rejected and executed.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--ink-soft)' }}>
                  <th style={{ padding: '4px 8px' }}>Stay dates</th>
                  <th style={{ padding: '4px 8px' }}>Rate</th>
                  <th style={{ padding: '4px 8px' }}>Status</th>
                  <th style={{ padding: '4px 8px' }}>Decided by</th>
                  <th style={{ padding: '4px 8px' }}>Pickup since proposal</th>
                  <th style={{ padding: '4px 8px' }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((a) => {
                  const row = a as RateActionRow & {
                    decided_by: string | null;
                    decision_note: string | null;
                    pickup_rooms_since_proposal: number | null;
                    pickup_revenue_since_proposal: number | null;
                  };
                  return (
                    <tr key={a.id} style={{ borderTop: '1px solid var(--hairline, #E6DFCC)' }}>
                      <td style={{ padding: '4px 8px' }}>
                        {a.stay_date_start.slice(0, 10)} → {a.stay_date_end.slice(0, 10)}
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        {a.current_rate != null ? `$${a.current_rate} → ` : ''}${a.proposed_rate}
                      </td>
                      <td style={{ padding: '4px 8px', fontWeight: 600 }}>{a.status}</td>
                      <td style={{ padding: '4px 8px' }}>{row.decided_by ?? '—'}</td>
                      <td style={{ padding: '4px 8px' }}>
                        {row.pickup_rooms_since_proposal != null
                          ? `${fmt0(row.pickup_rooms_since_proposal)} rn · ${fmtMoney(row.pickup_revenue_since_proposal)}`
                          : '—'}
                      </td>
                      <td style={{ padding: '4px 8px', color: 'var(--ink-soft)' }}>
                        {row.decision_note ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Container>
    </DashboardPage>
  );
}
