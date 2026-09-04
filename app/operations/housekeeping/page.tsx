// app/operations/housekeeping/page.tsx
// Operations · Housekeeping — 9-block IA per /revenue redesign standard.
// Layout (app/operations/layout.tsx) provides Banner + SubNav + FilterStrip.
// This page renders blocks 1, 2 (filterbar variant), 4–9. Block 3 (sub-tab row) is the layout SubNav.

import OpsKpiTile from '@/components/ops/OpsKpiTile';
import AgentStrip from '@/components/ops/AgentStrip';
import DecisionQueue, { type DecisionRow } from '@/components/ops/DecisionQueue';
import TacticalAlerts, { type TacticalAlert } from '@/components/ops/TacticalAlerts';
import GuardrailsBanner from '@/components/ops/GuardrailsBanner';
import DataNeededOverlay from '@/components/ops/DataNeededOverlay';
import Page from '@/components/page/Page';
import { OPERATIONS_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

import RoomBoard from './_components/RoomBoard';
import LadderTable from './_components/LadderTable';
import LinenPipeline from './_components/LinenPipeline';
import AmenityQueue from './_components/AmenityQueue';
import LostFound from './_components/LostFound';
import DndTracker from './_components/DndTracker';

import { fetchRoomStatus } from './_data/roomStatus';
import { fetchHkAssignments } from './_data/hkAssignments';
import { fetchLinenPars } from './_data/linenPars';
import { fetchAmenityQueue } from './_data/amenityQueue';
import { fetchLostFound } from './_data/lostFound';
import { fetchDndStreaks } from './_data/dndStreaks';

import { hkCoordinator } from '@/lib/agents/hk/coordinator';
import { linenWatcher } from '@/lib/agents/hk/linenWatcher';
import { amenityComposer } from '@/lib/agents/hk/amenityComposer';
import { dndGuardian } from '@/lib/agents/hk/dndGuardian';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

// ─── Housekeeping Status Table ─────────────────────────────────────────────
// Defined at module scope — never inside an async RSC (runtime Digest crash).

interface HkStatusRow {
  room_id: string;
  status: string | null;
  is_clean: boolean | null;
  is_inspected: boolean | null;
  is_occupied: boolean | null;
  last_cleaned_by: string | null;
  last_cleaned_at: string | null;
  snapshot_date: string | null;
}

function HkStatusBadge({ clean, inspected }: { clean: boolean | null; inspected: boolean | null }) {
  if (clean && inspected) {
    return (
      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--st-good, #22c55e)', marginRight: 6 }} />
    );
  }
  if (clean && !inspected) {
    return (
      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--brass, #d97706)', marginRight: 6 }} />
    );
  }
  return (
    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--st-bad, #ef4444)', marginRight: 6 }} />
  );
}

function HkStatusTable({ rows }: { rows: HkStatusRow[] }) {
  if (rows.length === 0) {
    return (
      <p style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-sm)', marginTop: 8 }}>
        No housekeeping status rows for this property.
      </p>
    );
  }
  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm)' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--tbl-border, var(--paper-deep))' }}>
            {['Room', 'Status', 'Clean?', 'Inspected?', 'Occupied?', 'Last Cleaned By', 'Last Cleaned At', 'Snapshot Date'].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '6px 10px',
                  fontWeight: 600,
                  color: 'var(--ink-mute)',
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.room_id}
              style={{ borderBottom: '1px solid var(--tbl-border, var(--paper-deep))' }}
            >
              <td style={{ padding: '6px 10px', fontWeight: 600 }}>{r.room_id}</td>
              <td style={{ padding: '6px 10px' }}>{r.status ?? '—'}</td>
              <td style={{ padding: '6px 10px' }}>
                <HkStatusBadge clean={r.is_clean} inspected={r.is_inspected} />
                {r.is_clean ? 'Yes' : 'No'}
              </td>
              <td style={{ padding: '6px 10px' }}>{r.is_inspected ? 'Yes' : 'No'}</td>
              <td style={{ padding: '6px 10px' }}>{r.is_occupied ? 'Yes' : 'No'}</td>
              <td style={{ padding: '6px 10px' }}>{r.last_cleaned_by ?? '—'}</td>
              <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                {r.last_cleaned_at ? new Date(r.last_cleaned_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
              </td>
              <td style={{ padding: '6px 10px' }}>{r.snapshot_date ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function HousekeepingPage() {
  const supabaseAdmin = getSupabaseAdmin();

  const [rooms, ladder, linen, amenities, lf, dnd, hkStatus] = await Promise.all([
    fetchRoomStatus().catch(() => null),
    fetchHkAssignments().catch(() => null),
    fetchLinenPars().catch(() => null),
    fetchAmenityQueue().catch(() => null),
    fetchLostFound().catch(() => null),
    fetchDndStreaks().catch(() => null),
    Promise.resolve(
      supabaseAdmin
        .from('v_housekeeping_status' as never)
        .select('room_id, status, is_clean, is_inspected, is_occupied, last_cleaned_by, last_cleaned_at, snapshot_date')
        .eq('property_id', PROPERTY_ID)
        .order('room_id', { ascending: true })
    ).then((r) => ((r as { data: HkStatusRow[] | null }).data ?? []) as HkStatusRow[]).catch(() => [] as HkStatusRow[]),
  ]);

  // Decision queue rows — populated when ops.maintenance/agent decisions table ships.
  // Until then we show 0 rows + a Data-needed overlay so the block is structurally present.
  const decisions: DecisionRow[] = [];

  const alerts: TacticalAlert[] = [
    {
      id: 'sla-vip',
      severity: 'hi',
      title: 'VIP × <2h ETA × not inspected',
      severityLabel: 'SLA HIGH',
      dims: 'room_category × time_to_arrival × inspection_status',
      reason:
        'Detector pending — needs ops.room_status (Gap-H1). Once wired, surfaces rooms with VIP arrivals inside the 2-hour window still in dirty state.',
      handoffs: [
        { label: 'Send to: HK Coordinator' },
        { label: 'Open detail' },
      ],
    },
    {
      id: 'linen-par',
      severity: 'hi',
      title: 'Sheet par × forecast occ × cycle hours',
      severityLabel: 'LINEN HIGH',
      dims: 'linen_item × current_par × forecast_occ × laundry_cycle',
      reason:
        'Linen Watcher idle — needs Gap-H3 ops.linen_pars populated. Once active, flags par dipping below 85% with forecast spike.',
      handoffs: [
        { label: 'Send to: Linen Watcher' },
        {
          label: 'Send to: Laundry partner',
          writesExternal: true,
          stampLabel: 'writes PO · approval req',
        },
      ],
    },
    {
      id: 'dnd-multi',
      severity: 'med',
      title: 'Multi-day DND × first-time guest',
      severityLabel: 'DND MED',
      dims: 'room × dnd_consecutive × guest_segment',
      reason:
        'DND Guardian idle — derives from Gap-H1 view. Day-3 policy auto-escalates to Guest Services with brand-tone WhatsApp draft.',
      handoffs: [
        { label: 'Send to: DND Guardian' },
        {
          label: 'Send to: Guest Services',
          writesExternal: true,
          stampLabel: 'writes WA · approval req',
        },
      ],
    },
    {
      id: 'productivity',
      severity: 'med',
      title: 'Cleaning time +X min vs target × N days',
      severityLabel: 'PRODUCTIVITY MED',
      dims: 'attendant × room_category × minutes_per_clean (14d)',
      reason:
        'Detector idle — needs Gap-H2 ops.hk_assignments. Once wired, separates supplies/setup variance from individual performance.',
      handoffs: [{ label: 'Send to: HK Supervisor' }],
    },
  ];

  // KPI counts derived where possible; greyed where not.
  const roomsReady = rooms ? rooms.filter((r) => r.status === 'clean' || r.status === 'inspect').length : null;
  const totalSelling = rooms ? rooms.length : null;
  const dndStreakCount = dnd ? dnd.filter((d) => d.consecutive_days >= 3).length : null;

  return (
    <Page
      eyebrow="Operations · Housekeeping"
      title={<>Housekeeping · ready by <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>when</em>.</>}
      subPages={OPERATIONS_SUBPAGES}
    >

      {/* BLOCK 4: KPI row — 6 tiles · canonical order: KPIs first */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 10,
          marginTop: 14,
        }}
      >
        <OpsKpiTile
          scope="Rooms ready"
          value={
            roomsReady !== null && totalSelling
              ? `${roomsReady} / ${totalSelling}`
              : '—'
          }
          label="vs same DOW LW"
          needs={rooms ? undefined : 'Data needed · Gap-H1'}
        />
        <OpsKpiTile
          scope="Avg min / clean"
          value="—"
          label="target 38"
          needs="Data needed · Gap-H2"
        />
        <OpsKpiTile
          scope="SLA breach risk"
          value="—"
          label="arrival ETA <2h, not inspected"
          needs={rooms ? undefined : 'Data needed · Gap-H1'}
          valueColor="var(--st-bad)"
        />
        <OpsKpiTile
          scope="HK staff on duty"
          value="—"
          label="roster source pending"
          needs="Data needed · roster"
        />
        <OpsKpiTile
          scope="Linen pars · sheets / towels"
          value="—"
          label="target 90%"
          needs="Data needed · Gap-H3"
          valueColor="var(--brass)"
        />
        <OpsKpiTile
          scope="DND streak ≥ 3 days"
          value={dndStreakCount !== null ? `${dndStreakCount} rooms` : '—'}
          label="guest-services flagged"
          needs={dnd ? undefined : 'Data needed · Gap-H5'}
          valueColor="var(--brass)"
        />
      </div>

      {/* HK-specific filter row — sits UNDER KPIs per canonical order.
          Pills are placeholders until ops.hk_assignments ships. */}
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
        <span style={shiftPillActive}>AM shift</span>
        <span style={shiftPill}>PM shift</span>
        <span style={shiftPill}>Night</span>
        <span style={shiftPill}>All categories</span>
        <span style={shiftPill}>All staff</span>
        <span style={{ marginLeft: 'auto', fontSize: "var(--t-sm)", color: 'var(--ink-mute)' }}>
          Property + date + segment filters above (layout)
        </span>
      </div>

      {/* BLOCK 5: Agent strip */}
      <AgentStrip
        pageScope="housekeeping"
        agents={[hkCoordinator, linenWatcher, amenityComposer, dndGuardian]}
      />

      {/* BLOCK 6: Decisions queued */}
      <DecisionQueue
        rows={decisions}
        meta="ranked by urgency · today"
        emptyOverlay={
          <DataNeededOverlay
            gap="governance.agent_decisions"
            table="governance.agent_decisions (per /revenue standard)"
            reason="Agents idle until Gap-H1..H6 populated. Decision queue ships empty until first agent run."
          />
        }
      />

      {/* BLOCK 7: Tactical alerts */}
      <TacticalAlerts alerts={alerts} />

      {/* BLOCK 8: Core panels — 2:1 grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 12,
          marginTop: 14,
        }}
      >
        <div>
          <RoomBoard rooms={rooms} />
          <LadderTable rows={ladder} />
        </div>
        <div>
          <LinenPipeline rows={linen} />
          <AmenityQueue rows={amenities} />
          <LostFound rows={lf} />
        </div>
      </div>

      <DndTracker rows={dnd} />

      {/* BLOCK 8b: Housekeeping Status — sourced from pms.housekeeping_status_cb via v_housekeeping_status */}
      <section
        style={{
          marginTop: 14,
          padding: '14px 16px',
          background: 'var(--paper-warm)',
          border: '1px solid var(--paper-deep)',
          borderRadius: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 'var(--t-base)', fontWeight: 700 }}>Room Housekeeping Status</h2>
          <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
            {hkStatus.length} rooms · from Cloudbeds sync
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--st-good, #22c55e)', marginRight: 4 }} />Clean + inspected</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--brass, #d97706)', marginRight: 4 }} />Clean, not inspected</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--st-bad, #ef4444)', marginRight: 4 }} />Not clean</span>
          </div>
        </div>
        <HkStatusTable rows={hkStatus} />
      </section>

      {/* BLOCK 9: Guardrails banner */}
      <GuardrailsBanner>
        <strong>No external write auto-fired.</strong> PMS room-status
        writes, vendor POs, and guest WhatsApp/SMS are <em>always</em> behind
        explicit human approval until validated against 90 days of decisions.
        Agents ship in approval-required mode by default — toggle in Settings ›
        Property only after audit-log review.
      </GuardrailsBanner>
    </Page>
  );
}

const shiftPill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 10px',
  border: '1px solid var(--paper-deep)',
  borderRadius: 6,
  background: 'var(--paper-warm)',
  fontSize: "var(--t-base)",
};

const shiftPillActive: React.CSSProperties = {
  ...shiftPill,
  background: 'var(--moss-mid)',
  color: 'var(--paper-warm)',
  borderColor: 'var(--moss-mid)',
};
