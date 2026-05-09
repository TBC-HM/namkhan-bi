// app/sales/inquiries/page.tsx
// Sales · Inquiries — 9-block IA per /revenue redesign standard.
// Layout (app/sales/layout.tsx) provides Banner + SubNav + FilterStrip.
// This page renders blocks 1, 2 (sales-specific status pills on top of FilterStrip),
// 4–9. Block 3 (sub-tab row) is the layout SubNav.
//
// Mockup-data mode: sales schema not yet deployed. KPI tiles + tray + feed all
// carry "data needed" tags pointing at the email-ingest webhook + sales.* tables.

import OpsKpiTile from '@/components/ops/OpsKpiTile';
import AgentStrip from '@/components/ops/AgentStrip';
import DecisionQueue, { type DecisionRow } from '@/components/ops/DecisionQueue';
import TacticalAlerts, { type TacticalAlert } from '@/components/ops/TacticalAlerts';
import GuardrailsBanner from '@/components/ops/GuardrailsBanner';
import DataNeededOverlay from '@/components/ops/DataNeededOverlay';
import Page from '@/components/page/Page';
import { SALES_SUBPAGES } from '../_subpages';

import InquiryFeed from './_components/InquiryFeed';
import AutoDraftTray from './_components/AutoDraftTray';
import FunnelSnapshot from './_components/FunnelSnapshot';
import SourceMix from './_components/SourceMix';
import LostReasonTape from './_components/LostReasonTape';
import EmailCockpit from './_components/EmailCockpit';
import type { CockpitStatus, CockpitDirection, CockpitCategory, CockpitSince } from '@/lib/sales-cockpit';

import { getKpiDaily, aggregateDaily } from '@/lib/data';
import { listInquiries } from '@/lib/sales';
import { fmtMoney } from '@/lib/format';

import { inquiryTriager } from '@/lib/agents/sales/inquiryTriager';
import { autoOfferComposer } from '@/lib/agents/sales/autoOfferComposer';
import { groupQuoteStrategist } from '@/lib/agents/sales/groupQuoteStrategist';
import { packageBuilder } from '@/lib/agents/sales/packageBuilder';
import { pricingValidator } from '@/lib/agents/sales/pricingValidator';
import { dmcSpecialist } from '@/lib/agents/sales/dmcSpecialist';
import { followUpWatcher } from '@/lib/agents/sales/followUpWatcher';
import { conversionCoach } from '@/lib/agents/sales/conversionCoach';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams?: { scope?: string; status?: string; cat?: string; since?: string; dir?: string; q?: string; page?: string; thread?: string };
}) {
  const cockpitScope = searchParams?.scope ?? 'all';
  const cockpitStatus = (['all','unanswered','drafted','sent_today'].includes(searchParams?.status ?? '')
    ? (searchParams!.status as CockpitStatus) : 'unanswered') as CockpitStatus;
  const cockpitDirection = (searchParams?.dir === 'in' ? 'in' : searchParams?.dir === 'out' ? 'out' : 'all') as CockpitDirection;
  const cockpitCategory = (searchParams?.cat ?? 'people') as CockpitCategory;
  const cockpitSince = (['7d','30d','90d','365d','all'].includes(searchParams?.since ?? '')
    ? (searchParams!.since as CockpitSince) : '90d') as CockpitSince;
  const cockpitSearch = searchParams?.q;
  const cockpitPage = Math.max(0, parseInt(searchParams?.page ?? '0', 10) || 0);
  const cockpitThread = searchParams?.thread;

  // sales schema not yet deployed → all blocks render with mockup data
  // and a 'Data needed · sales.*' tag where a live source would live.
  // Exception: total hotel revenue MTD is wired via existing kpi.* helpers
  // (every booking flows through the inquiry/quote funnel by definition,
  // so until sales.quotes attribution exists, total revenue MTD = sales MTD).
  // Live inquiries from sales schema. Falls back to mock if empty.
  const liveInquiries = await listInquiries(260955, 30).catch(() => []);
  const SCHEMA_LIVE = liveInquiries.length > 0;
  const liveDecisions: DecisionRow[] = liveInquiries.map((inq) => {
    const nights = inq.date_in && inq.date_out
      ? Math.max(1, Math.round((new Date(inq.date_out).getTime() - new Date(inq.date_in).getTime())/86400000))
      : 1;
    const pax = (inq.party_adults ?? 0) + (inq.party_children ?? 0);
    const dollars = pax > 0 ? nights * pax * 280 : 0;
    return {
      id: inq.id.slice(0, 8),
      impact: dollars > 0 ? '$' + dollars.toLocaleString('en-US') : '$—',
      urgency: (inq.triage_kind === 'group' || inq.triage_kind === 'retreat' ? 'urg' : 'med') as 'urg' | 'med' | 'neu',
      title: (inq.guest_name ?? 'Unknown') + ' · ' + inq.source + ' · ' + (inq.party_adults ?? '?') + 'A' + (inq.party_children ? '+' + inq.party_children + 'C' : '') + ' · ' + inq.date_in + ' → ' + inq.date_out,
      meta: (inq.triage_kind ?? 'fit') + ' ' + (inq.triage_conf ? Number(inq.triage_conf).toFixed(2) : '') + ' · ' + (inq.country ?? '') + ' · status: ' + inq.status,
    };
  });

  // ── Wired KPI: Sales revenue MTD ────────────────────────────────────
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  let mtdRevenueLabel = '$112,400';
  let mtdLive = false;
  try {
    const rows = await getKpiDaily(fmt(monthStart), fmt(today));
    const agg = aggregateDaily(rows);
    if (agg) {
      const mtd = (agg.rooms_revenue ?? 0) + (agg.total_ancillary_revenue ?? 0);
      if (mtd > 0) {
        mtdRevenueLabel = fmtMoney(mtd, 'USD');
        mtdLive = true;
      }
    }
  } catch {
    // fall back to mockup label
  }

  // Decision queue rows — populated when sales.queue_rank lands.
  // For mockup-mode we ship the 9 ranked rows from the proposal so the block has shape.
  const decisions: DecisionRow[] = SCHEMA_LIVE
    ? liveDecisions
    : [
        {
          id: 'sq-1',
          impact: '$14,200',
          urgency: 'urg',
          title: 'Approve group quote — Hanoi Architects retreat (12r × 3n + meeting + farewell)',
          meta: 'Group Strategist 0.92 · margin OK · stay 12-Jul → 14-Jul · received 26m ago',
        },
        {
          id: 'sq-2',
          impact: '$1,840',
          urgency: 'med',
          title: 'Approve FIT auto-draft — Smith family, 3n river view, repeat guest',
          meta: 'Composer 0.95 · brand voice clean · received 12m ago · safe to send',
        },
        {
          id: 'sq-3',
          impact: '$4,600',
          urgency: 'med',
          title: 'Approve group quote — Bangkok yoga retreat (8r × 5n + 2 daily classes + 4 dinners)',
          meta: 'Group Strategist 0.78 · margin tight · req RM 6% discount approval',
        },
        {
          id: 'sq-4',
          impact: '−$2,200 RISK',
          urgency: 'urg',
          title: 'Rate exception — Khiri Travel asks 18% off BAR for 16-Sep shoulder',
          meta: 'DMC contract floor is 12% · RM approval required · escalation',
        },
        {
          id: 'sq-5',
          impact: '$980',
          urgency: 'med',
          title: 'Send follow-up #2 — French TUI agent · quote sent 3d ago · 0 reply',
          meta: 'Follow-up Watcher 0.81 · decay −22% expected if not chased today',
        },
        {
          id: 'sq-6',
          impact: 'CLEAN-UP',
          urgency: 'neu',
          title: 'Auto-archive — wedding inquiry from 17-Apr · 0 reply 13d · 3 follow-ups sent',
          meta: 'Follow-up Watcher 0.94 · loss-reason: ghosted',
        },
        {
          id: 'sq-7',
          impact: '$3,400',
          urgency: 'med',
          title: 'Approve package quote — German honeymoon, 5n incl. spa + private boat',
          meta: 'Composer 0.88 · package "Mekong Honeymoon" applied · stay 03-Aug',
        },
        {
          id: 'sq-8',
          impact: 'CATALOG',
          urgency: 'neu',
          title: 'Approve new "Coffee Trail Package" — Package Builder draft, launches May 20',
          meta: 'Package Builder · margin 38% · vendor commitments locked · marketing brief',
        },
        {
          id: 'sq-9',
          impact: '−$240 BLOCK',
          urgency: 'urg',
          title: 'Send back FT-2186 — Pricing Validator BLOCK · 8% below floor (low-season Room 12)',
          meta: 'Validator: rewrite at floor + 4% suggested',
        },
      ];

  const alerts: TacticalAlert[] = [
    {
      id: 'sa-vip-fit',
      severity: 'hi',
      title: 'VIP × FIT × <2h SLA × river-view × auto-draft 0.95',
      severityLabel: 'SLA HIGH',
      dims: 'guest_segment × inquiry_type × age × rate_class',
      reason:
        'Composer says one-click safe — Smith family repeat, brand voice clean, LOS upsell variant ready. Decay starts at 2h.',
      handoffs: [
        { label: 'Send to: Reservations Manager' },
        { label: 'Send to: Auto-Offer Composer' },
      ],
    },
    {
      id: 'sa-group-window',
      severity: 'hi',
      title: 'Group × stay 12–14 Jul × OTB 28% × no block held',
      severityLabel: 'GROUP HIGH',
      dims: 'inquiry_type × stay_window × otb_pct × group_block',
      reason:
        'Margin-positive even with 8% incentive (Group Strategist 0.92). Hold 12 rooms before BAR competition tightens.',
      handoffs: [
        { label: 'Send to: Group Quote Strategist' },
        { label: 'Send to: Sales Manager' },
        {
          label: 'Cloudbeds room block',
          writesExternal: true,
          stampLabel: 'writes Cloudbeds · approval req',
        },
      ],
    },
    {
      id: 'sa-rate-exc',
      severity: 'hi',
      title: 'Rate exception × DMC × 18% off BAR × contract floor 12%',
      severityLabel: 'PARITY HIGH',
      dims: 'partner × discount_pct × contract_floor × bar_parity',
      reason:
        'DMC Specialist drafted counter at 14% with extended LOS bonus — protects partner relationship, holds floor.',
      handoffs: [
        { label: 'Send to: Revenue Manager' },
        {
          label: 'Send to: DMC Specialist',
          writesExternal: true,
          stampLabel: 'writes Cloudbeds · approval req',
        },
      ],
    },
    {
      id: 'sa-lost-cluster',
      severity: 'med',
      title: '3 FIT quotes lost-on-price last 7d × direct website × ADR > $280',
      severityLabel: 'PRICE MED',
      dims: 'lost_reason × channel × segment × adr_band',
      reason:
        'Conversion Coach 0.84 — suggests testing −8% web-direct opaque rate for shoulder days only.',
      handoffs: [{ label: 'Send to: Revenue Manager' }],
    },
    {
      id: 'sa-wedding-peak',
      severity: 'med',
      title: 'Wedding × overlap high-occ window × no min-spend',
      severityLabel: 'WEDDING MED',
      dims: 'inquiry_type × occ_band × min_spend × event',
      reason:
        'Composer flags package floor + meeting-room min before quote leaves the building.',
      handoffs: [
        { label: 'Send to: Group Quote Strategist' },
        { label: 'Send to: GM' },
      ],
    },
    {
      id: 'sa-fr-localised',
      severity: 'med',
      title: '6 inquiries × FR market × 7-day window × no FR D1/D3/D7 template',
      severityLabel: 'I18N MED',
      dims: 'language × cohort_size × follow_up_template',
      reason:
        'Composer drafts localised sequence — needs Marketing template approval before Watcher activates.',
      handoffs: [
        { label: 'Send to: Follow-up Watcher' },
        { label: 'Send to: Marketing' },
      ],
    },
    {
      id: 'sa-package-decay',
      severity: 'med',
      title: '2 packages × shoulder May × 0 bookings 14d × repricing trigger',
      severityLabel: 'CATALOG MED',
      dims: 'package × season × volume × age',
      reason:
        'Package Builder suggests bundled discount (5N → −12%) or retire. Decision before Friday rate push.',
      handoffs: [
        { label: 'Send to: Package Builder' },
        { label: 'Send to: Revenue Manager' },
      ],
    },
    {
      id: 'sa-allotment-cutoff',
      severity: 'med',
      title: '3 wholesaler quotes × 9d no response × allotment cut-off in 6d',
      severityLabel: 'ALLOTMENT MED',
      dims: 'partner × age_days × cutoff_days',
      reason:
        'Composer drafts release + partner notification — protects allotment from auto-killing on cut-off.',
      handoffs: [{ label: 'Send to: DMC Specialist' }],
    },
    {
      id: 'sa-ota-backlog',
      severity: 'low',
      title: '5 OTA pre-stay messages unanswered >24h',
      severityLabel: 'OTA LOW',
      dims: 'channel × age_hours',
      reason:
        'Composer offers brand-voice templates per OTA. Sentiment risk if left another 24h.',
      handoffs: [
        { label: 'Send to: Reservations' },
        { label: 'Send to: Email Agent' },
      ],
    },
  ];

  const dataNeed = SCHEMA_LIVE ? undefined : 'Data needed · sales schema';

  return (
    <Page
      eyebrow="Sales · Inquiries"
      title={<>Every inquiry, an <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>answer</em> before lunch.</>}
      subPages={SALES_SUBPAGES}
    >

      {/* BLOCK 2: Status pills (sales-specific, on top of layout's FilterStrip) */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginTop: 14,
          padding: '10px 12px',
          background: 'var(--paper-warm)',
          border: '1px solid var(--paper-deep)',
          borderRadius: 8,
        }}
      >
        <span style={pillActive}>All inquiries</span>
        <span style={pill}>FIT</span>
        <span style={pill}>Group</span>
        <span style={pill}>Wedding</span>
        <span style={pill}>Retreat</span>
        <span style={pill}>Package</span>
        <span style={pill}>B2B / DMC</span>
        <span style={pill}>OTA pre-stay</span>
        <span style={{ marginLeft: 'auto', fontSize: "var(--t-sm)", color: 'var(--ink-mute)' }}>
          Property + date + segment filters above (layout)
        </span>
      </div>

      {/* BLOCK 3.5: Email cockpit — search, filter, AI draft, compose */}
      <EmailCockpit
        scope={cockpitScope}
        status={cockpitStatus}
        direction={cockpitDirection}
        category={cockpitCategory}
        since={cockpitSince}
        search={cockpitSearch}
        page={cockpitPage}
        thread={cockpitThread}
      />

      {/* BLOCK 4: KPI row — 6 tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 10,
          marginTop: 14,
        }}
      >
        <OpsKpiTile
          scope="Open inq · SLA at risk"
          value="18 / 4"
          label="4 past 1h target"
          needs={dataNeed}
          valueColor="var(--st-bad)"
          tooltip="Open inquiries / those past first-reply SLA (1h target). Source: sales.email_messages + sales.inquiry_status. Currently a placeholder."
        />
        <OpsKpiTile
          scope="Median time to first reply"
          value="2h 14m"
          label="target 1h · LM −18m"
          needs={dataNeed}
          tooltip="Median minutes from inbound inquiry to first outbound reply. Target ≤ 1h. Source: v_thread_response."
        />
        <OpsKpiTile
          scope="Auto-offer hit rate"
          value="61%"
          label="sent without edit · target 75%"
          needs={dataNeed}
          valueColor="var(--brass)"
          tooltip="Drafts the agent generated that were sent unedited ÷ total drafts. Target ≥ 75%. Source: sales.email_drafts.status."
        />
        <OpsKpiTile
          scope="Quote → Booking conv"
          value="27%"
          label="weighted 90d · LY +4 pts"
          needs={dataNeed}
          tooltip="Quoted opportunities that converted to a confirmed booking, weighted by quote value over 90d. Target ≥ 30%."
        />
        <OpsKpiTile
          scope="Open pipeline value"
          value="$48,200"
          label="18 open quotes · weighted"
          needs={dataNeed}
          tooltip="Sum of quote totals × win-probability for currently-open opportunities. Source: sales.opportunities (schema TODO)."
        />
        <OpsKpiTile
          scope="Sales revenue MTD"
          value={mtdRevenueLabel}
          label={mtdLive ? 'mv_kpi_today · live · budget pending' : 'mockup · awaiting data'}
          needs={mtdLive ? 'Budget pending' : dataNeed}
          valueColor={mtdLive ? undefined : 'var(--brass)'}
        />
      </div>

      {/* BLOCK 5: Agent strip — 8 chips */}
      <AgentStrip
        pageScope="sales-inquiries"
        agents={[
          inquiryTriager,
          autoOfferComposer,
          groupQuoteStrategist,
          packageBuilder,
          pricingValidator,
          dmcSpecialist,
          followUpWatcher,
          conversionCoach,
        ]}
      />

      {/* BLOCK 6: Decisions queued */}
      <DecisionQueue
        rows={decisions}
        meta="ranked $ × decay × confidence · today"
        emptyOverlay={
          <DataNeededOverlay
            gap="sales.queue_rank"
            table="sales.queue_rank · sales.agent_runs"
            reason="Queue ships empty until first ingest + agent run."
          />
        }
      />

      {/* BLOCK 7: Tactical alerts */}
      <TacticalAlerts alerts={alerts} />

      {/* BLOCK 8a: Top row — Live feed (2/3) + Auto-draft tray (1/3) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 12,
        }}
      >
        <InquiryFeed
          overlay={
            !SCHEMA_LIVE ? (
              <DataNeededOverlay
                gap="email-ingest"
                table="sales.inquiries · ingest webhook"
                reason="Feed currently shows mockup rows. Live feed populates from Cloudflare Email Worker → sales-ingest-email Edge Function."
              />
            ) : undefined
          }
        />
        <AutoDraftTray
          overlay={
            !SCHEMA_LIVE ? (
              <DataNeededOverlay
                gap="sales.quotes"
                table="sales.quotes · sales.agent_runs"
                reason="Tray shows mockup drafts until Composer + Strategist + Validator deploy."
              />
            ) : undefined
          }
        />
      </div>

      {/* BLOCK 8b: Middle row — Funnel (2/3) + Source mix (1/3) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 12,
        }}
      >
        <FunnelSnapshot />
        <SourceMix />
      </div>

      {/* BLOCK 8c: Bottom row — Lost-reason tape (full width, collapsed) */}
      <LostReasonTape />

      {/* BLOCK 9: Guardrails banner */}
      <GuardrailsBanner>
        <strong>No external write auto-fired.</strong> Until the Sales agents are
        validated against 90 days of decisions, every agent-proposed change to
        Cloudbeds (room block, rate code, package code, reservation hold) requires
        explicit human approval. After validation, only Tier-1 actions (defined
        criteria, ≥85% confidence, within rate guardrails) move to auto. All
        Tier-2 actions and rate exceptions remain human-approval forever.
      </GuardrailsBanner>
    </Page>
  );
}

const pill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 10px',
  border: '1px solid var(--paper-deep)',
  borderRadius: 6,
  background: 'var(--paper-warm)',
  fontSize: "var(--t-base)",
};

const pillActive: React.CSSProperties = {
  ...pill,
  background: 'var(--moss-mid)',
  color: 'var(--paper-warm)',
  borderColor: 'var(--moss-mid)',
};
