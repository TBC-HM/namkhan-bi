// app/front-office/arrivals/page.tsx
// Front Office · Arrivals — 9-block IA per /revenue redesign standard.
// Layout (app/front-office/layout.tsx) provides Banner + SubNav + FilterStrip.
// This page renders blocks 4–9 (KPI row, agent strip, decision queue, alerts, core panels, guardrails).
//
// v1 wiring state:
//  - "Arrivals next 72h" KPI is wired from cloudbeds.reservations directly
//    (frontoffice.arrivals refresh job not yet running — F-EXT cron pending).
//  - All other KPIs + composer/funnel/upsell/VIP/group panels render structurally
//    with "Data needed" overlays naming the missing schema/ingest gap.
//  - 8 agent chips render with default `idle`; ETA Watcher locked to `paused`
//    until F-EXT-1 (flight ingest) decision is made.
//  - Decision queue + tactical alerts read governance.* (already shipped with /finance/pnl)
//    filtered to section='front-office' AND tab='arrivals'. Empty today → render skeleton.

import OpsKpiTile from '@/components/ops/OpsKpiTile';
import AgentStrip, { type AgentChipDef } from '@/components/ops/AgentStrip';
import DecisionQueue, { type DecisionRow } from '@/components/ops/DecisionQueue';
import TacticalAlerts, { type TacticalAlert } from '@/components/ops/TacticalAlerts';
import GuardrailsBanner from '@/components/ops/GuardrailsBanner';
import DataNeededOverlay from '@/components/ops/DataNeededOverlay';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

// ───────────────────────────────────────────────────────────────────────────
// Server-side fetcher: arrivals next 72h.
// Reads cloudbeds.reservations directly until frontoffice.refresh_arrivals_board
// cron is wired (F-EXT). Defensive: returns null if Supabase isn't reachable.
// ───────────────────────────────────────────────────────────────────────────
async function getArrivalsNext72hCount(): Promise<{ count: number | null; live: boolean }> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) return { count: null, live: false };

    const now = new Date();
    const horizon = new Date(now.getTime() + 72 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    // Try frontoffice.arrivals first; fall back to cloudbeds.reservations if empty
    const tries = [
      `${supabaseUrl}/rest/v1/arrivals?select=id&arrival_date=gte.${fmt(now)}&arrival_date=lte.${fmt(horizon)}`,
      `${supabaseUrl}/rest/v1/reservations?select=reservation_id&arrival_date=gte.${fmt(now)}&arrival_date=lte.${fmt(horizon)}&status=neq.cancelled`,
    ];
    for (const url of tries) {
      try {
        const res = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Prefer: 'count=exact',
          },
          next: { revalidate: 60 },
        });
        if (!res.ok) continue;
        const contentRange = res.headers.get('content-range') || '';
        const match = contentRange.match(/\/(\d+)$/);
        if (match) {
          const c = parseInt(match[1], 10);
          if (Number.isFinite(c)) return { count: c, live: true };
        }
        const body = await res.json();
        if (Array.isArray(body)) return { count: body.length, live: true };
      } catch {
        // try next source
      }
    }
    return { count: null, live: false };
  } catch {
    return { count: null, live: false };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────────
export default async function ArrivalsPage() {
  // Schema F1 applied (phase1_21_front_office_schema), but ingest cron is not yet
  // running, so frontoffice.arrivals is empty. Most panels still ship as "Data needed".
  const SCHEMA_LIVE = true;       // F1 schema in place
  const INGEST_LIVE = false;      // refresh_arrivals_board cron not yet wired
  const FLIGHT_INGEST_LIVE = false;
  const EMAIL_INGEST_LIVE = false;

  const arrivals72h = await getArrivalsNext72hCount();

  // ── Block 4: KPI row (6 tiles) ─────────────────────────────────────────
  // Only the 72h count is live. The other 5 honestly carry "Data needed".

  // ── Block 5: Agent strip (8 chips, ETA Watcher paused) ─────────────────
  const agents: AgentChipDef[] = [
    {
      name: 'Triager',
      cadence: '30 min',
      status: INGEST_LIVE ? 'idle' : 'idle',
      description:
        'Classifies incoming arrivals by tier (VIP / repeat / first / influencer / press) using prior visits, occasion flags, source channel, and CRM context. Drives the rest of the pipeline.',
      guardrails: ['no auto-write', 'tier locks read-only until human approves'],
    },
    {
      name: 'Pre-Arrival Composer',
      cadence: '60 min',
      status: 'idle',
      description:
        'Drafts pre-arrival emails / WhatsApp messages in guest language. Confidence-scored. Drops into Composer Tray for human approval before any send.',
      guardrails: ['approval-required', 'brand-voice locked'],
    },
    {
      name: 'Upsell Composer',
      cadence: 'on triage',
      status: 'idle',
      description:
        'Generates targeted upsell offers (room-up / late checkout / welcome dinner / spa / activity / transfer / package). Margin-floor validated before approval.',
      guardrails: ['approval-required', 'margin-floor enforced', 'no Cloudbeds folio post auto'],
    },
    {
      name: 'VIP Curator',
      cadence: 'daily',
      status: 'idle',
      description:
        'Builds the VIP / repeat 1-pager with prior-visit recap, dietary, allergies, ice-breakers, welcome plan. Hands off to reception/HK/F&B/concierge with acknowledgement state.',
      guardrails: ['PII retention 30d post-departure', 'restricted read'],
    },
    {
      name: 'ETA Watcher',
      cadence: '15 min',
      status: 'paused',
      description:
        'Triangulates flight × driver × composer-reply ETA. Currently PAUSED until flight ingest provider (FlightAware / FlightRadar24 / manual) is decided.',
      guardrails: ['no SMS auto-send', 'no Cloudbeds note auto-write'],
    },
    {
      name: 'Compliance Verifier',
      cadence: 'on triage',
      status: 'idle',
      description:
        'Tracks passport copy + immigration form state per arrival. Generates self-service link with audit-logged token. Green / amber / red status.',
      guardrails: ['legal sign-off required', 'PII access restricted to fo_lead+'],
    },
    {
      name: 'Group Coordinator',
      cadence: 'on group block',
      status: 'idle',
      description:
        'For group arrivals: builds cohesion map, key handout sequence, bag delivery order, F&B slot, briefing room slot, language coverage check. Surfaces unresolved dependencies.',
      guardrails: ['no Cloudbeds room-block edit auto'],
    },
    {
      name: 'Margin-Leak Sentinel',
      cadence: 'hourly',
      status: 'idle',
      description:
        'Monitors upsell take rate, validator overrides, and outcome value. Flags margin breaches and pricing drift. Posts to decision queue with dollar impact.',
      guardrails: ['read-only · alerting only'],
    },
  ];

  // ── Block 6: Decisions queued (governance.decision_queue, filtered) ────
  const decisions: DecisionRow[] = []; // empty until ingest + agent runs land

  // ── Block 7: Tactical alerts (governance.alerts, filtered) ─────────────
  const alerts: TacticalAlert[] = []; // same gating

  return (
    <>
      {/* ── Block 4: KPI row ───────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 12,
          margin: '6px 0 4px',
        }}
      >
        <OpsKpiTile
          scope="Arrivals · next 72h"
          value={arrivals72h.count !== null ? arrivals72h.count.toString() : '—'}
          label="checked-in window"
          delta={arrivals72h.live ? 'live · cloudbeds.reservations' : 'data needed · cloudbeds offline'}
          deltaTone={arrivals72h.live ? 'flat' : 'flat'}
          needs={arrivals72h.live ? undefined : 'Data needed · Cloudbeds API'}
        />
        <OpsKpiTile
          scope="Pre-arrival · contact rate"
          value="—"
          label="sent / arrivals"
          needs="Data needed · frontoffice.prearrival_messages (ingest pending)"
        />
        <OpsKpiTile
          scope="Pre-arrival · upsell take"
          value="—"
          label="accepted / sent"
          needs="Data needed · frontoffice.upsell_offers (ingest pending)"
        />
        <OpsKpiTile
          scope="Upsell $ · MTD"
          value="—"
          label="accepted outcomes USD"
          needs="Data needed · frontoffice.upsell_offers.outcome_value_usd"
        />
        <OpsKpiTile
          scope="VIP · coverage"
          value="—"
          label="briefed / VIP arrivals"
          needs="Data needed · frontoffice.vip_briefs"
        />
        <OpsKpiTile
          scope="Median check-in"
          value="—"
          label="seconds at desk"
          needs="Data needed · no Cloudbeds API exposure today"
        />
      </div>

      {/* ── Block 5: Agent strip ───────────────────────────────────────── */}
      <AgentStrip agents={agents} pageScope="front-office · arrivals" />

      {/* ── Block 6: Decisions queued ──────────────────────────────────── */}
      <DecisionQueue
        rows={decisions}
        meta="ranked by $ × decay × confidence · 0 today"
        emptyOverlay={
          <DataNeededOverlay
            gap="F1+ingest"
            table="governance.decision_queue · section='front-office'"
            reason="Schema is live; no agent runs yet → queue empty. Decisions will flow once Triager + Composers + Curator start emitting drafts."
          />
        }
      />

      {/* ── Block 7: Tactical alerts ───────────────────────────────────── */}
      {alerts.length > 0 ? (
        <TacticalAlerts alerts={alerts} />
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              margin: '22px 0 10px',
            }}
          >
            <h3
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: 18,
                fontWeight: 500,
                margin: 0,
              }}
            >
              Tactical <em style={{ color: '#a17a4f' }}>alerts</em>
            </h3>
            <span style={{ fontSize: 12, color: '#8a8170' }}>0 today</span>
          </div>
          <DataNeededOverlay
            gap="F1+ingest"
            table="governance.alerts · section='front-office'"
            reason="Detector chain (Triager → Composer → Sentinel) needs ingest data to fire. Will populate as soon as F-EXT-1 (flight) and F-EXT-2 (email/WhatsApp) come online."
          />
        </>
      )}

      {/* ── Block 8: Core panels (sub-tab specific) ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginTop: 26 }}>
        {/* Arrivals board */}
        <section
          style={{
            background: '#fff',
            border: '1px solid #e6dfc9',
            borderRadius: 8,
            padding: 14,
            minHeight: 280,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 500, margin: 0 }}>
              Arrivals <em style={{ color: '#a17a4f' }}>board</em>
            </h3>
            <span style={{ fontSize: 11, color: '#8a8170' }}>72h window · tier-sorted</span>
          </div>
          <DataNeededOverlay
            gap="F1+ingest"
            table="frontoffice.arrivals (joined to prearrival/upsell/vip/compliance)"
            reason="Schema applied; rows arrive when refresh_arrivals_board cron is wired to cloudbeds.reservations."
          />
        </section>

        {/* Composer tray */}
        <section
          style={{
            background: '#fff',
            border: '1px solid #e6dfc9',
            borderRadius: 8,
            padding: 14,
            minHeight: 280,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 500, margin: 0 }}>
              Composer <em style={{ color: '#a17a4f' }}>tray</em>
            </h3>
            <span style={{ fontSize: 11, color: '#8a8170' }}>conf × $ × decay</span>
          </div>
          <DataNeededOverlay
            gap="F1+composers"
            table="frontoffice.prearrival_messages · upsell_offers (status='draft')"
            reason="Composer agents emit drafts here for human approval before any send."
          />
        </section>
      </div>

      {/* Funnel + Upsell mix + VIP + Group */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
        <section
          style={{
            background: '#fff',
            border: '1px solid #e6dfc9',
            borderRadius: 8,
            padding: 14,
            minHeight: 200,
          }}
        >
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 500, margin: 0 }}>
            30d <em style={{ color: '#a17a4f' }}>funnel</em>
          </h3>
          <p style={{ fontSize: 11, color: '#8a8170', margin: '4px 0 8px' }}>
            booked → triaged → prearr_sent → reply → vip_brief → upsell → checked_in
          </p>
          <DataNeededOverlay
            gap="F1+ingest"
            table="frontoffice.arrivals.status transitions"
          />
        </section>

        <section
          style={{
            background: '#fff',
            border: '1px solid #e6dfc9',
            borderRadius: 8,
            padding: 14,
            minHeight: 200,
          }}
        >
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 500, margin: 0 }}>
            Upsell <em style={{ color: '#a17a4f' }}>mix</em>
          </h3>
          <p style={{ fontSize: 11, color: '#8a8170', margin: '4px 0 8px' }}>
            room_up · late_checkout · welcome_dinner · spa · activity · transfer · package
          </p>
          <DataNeededOverlay
            gap="F1+ingest"
            table="frontoffice.upsell_offers (group by upsell_type)"
          />
        </section>

        <section
          style={{
            background: '#fff',
            border: '1px solid #e6dfc9',
            borderRadius: 8,
            padding: 14,
            minHeight: 200,
          }}
        >
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 500, margin: 0 }}>
            VIP · <em style={{ color: '#a17a4f' }}>next 14d</em>
          </h3>
          <p style={{ fontSize: 11, color: '#8a8170', margin: '4px 0 8px' }}>
            tier=vip OR rep_champion · joined to vip_briefs
          </p>
          <DataNeededOverlay
            gap="F1+ingest"
            table="frontoffice.arrivals JOIN frontoffice.vip_briefs"
            reason="Restricted read — fo_lead / reservations / hk_lead / fnb_lead / concierge / gm only."
          />
        </section>

        <section
          style={{
            background: '#fff',
            border: '1px solid #e6dfc9',
            borderRadius: 8,
            padding: 14,
            minHeight: 200,
          }}
        >
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 500, margin: 0 }}>
            Group · <em style={{ color: '#a17a4f' }}>next 30d</em>
          </h3>
          <p style={{ fontSize: 11, color: '#8a8170', margin: '4px 0 8px' }}>
            group_arrival_plans · cohesion · key handout · bag · F&B · briefing
          </p>
          <DataNeededOverlay
            gap="F1+ingest"
            table="frontoffice.group_arrival_plans"
          />
        </section>
      </div>

      {/* ── Block 9: Guardrails banner ─────────────────────────────────── */}
      <GuardrailsBanner>
        <strong>Cloudbeds writes are gated.</strong> Until each agent's outputs are validated
        against 90 days of human decisions, every Cloudbeds-write action (room reassignment,
        folio post, note write, group block edit) requires explicit human approval here.
        After validation, only Tier-1 actions (≥85% confidence, defined criteria) move to auto.
        ETA Watcher remains paused until a flight-ingest provider is selected.
      </GuardrailsBanner>
    </>
  );
}
