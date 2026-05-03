// app/operations/maintenance/page.tsx
// Operations · Maintenance — 9-block IA per /revenue redesign standard.

import OpsKpiTile from '@/components/ops/OpsKpiTile';
import AgentStrip from '@/components/ops/AgentStrip';
import DecisionQueue, { type DecisionRow } from '@/components/ops/DecisionQueue';
import TacticalAlerts, { type TacticalAlert } from '@/components/ops/TacticalAlerts';
import GuardrailsBanner from '@/components/ops/GuardrailsBanner';
import DataNeededOverlay from '@/components/ops/DataNeededOverlay';

import TicketQueue from './_components/TicketQueue';
import AssetHeatMap from './_components/AssetHeatMap';
import PpmCalendar from './_components/PpmCalendar';
import EnergyDash from './_components/EnergyDash';
import SpareParts from './_components/SpareParts';
import CapExPipeline from './_components/CapExPipeline';
import VendorScorecard from './_components/VendorScorecard';

import { fetchOpenTickets } from './_data/tickets';
import { fetchAssetHealth } from './_data/assets';
import { fetchPpmTasks } from './_data/ppm';
import { fetchEnergyNormalised } from './_data/energy';
import { fetchSpareParts } from './_data/parts';
import { fetchVendorScorecard } from './_data/vendors';
import { fetchCapExPipeline } from './_data/capex';

import { slaWatcher } from '@/lib/agents/maint/slaWatcher';
import { assetHealthScout } from '@/lib/agents/maint/assetHealthScout';
import { energyAnomalyHunter } from '@/lib/agents/maint/energyAnomalyHunter';
import { ppmScheduler } from '@/lib/agents/maint/ppmScheduler';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function MaintenancePage() {
  const [tickets, assets, ppm, energy, parts, vendors, capex] = await Promise.all([
    fetchOpenTickets().catch(() => null),
    fetchAssetHealth().catch(() => null),
    fetchPpmTasks().catch(() => null),
    fetchEnergyNormalised().catch(() => null),
    fetchSpareParts().catch(() => null),
    fetchVendorScorecard().catch(() => null),
    fetchCapExPipeline().catch(() => null),
  ]);

  const decisions: DecisionRow[] = [];

  const alerts: TacticalAlert[] = [
    {
      id: 'sla-breach',
      severity: 'hi',
      title: 'Open ticket × <2h SLA × urgent priority',
      severityLabel: 'SLA HIGH',
      dims: 'priority × hours_to_breach × room',
      reason:
        'SLA Watcher idle — needs Gap-M1 ops.maintenance_tickets populated. Once active, surfaces tickets near urgent breach window with reassignment / vendor dispatch options.',
      handoffs: [
        { label: 'Send to: SLA Watcher' },
        {
          label: 'Send to: Vendor dispatch',
          writesExternal: true,
          stampLabel: 'writes PO · approval req',
        },
      ],
    },
    {
      id: 'asset-failure',
      severity: 'hi',
      title: 'Asset failure probability × MTBF × ticket density',
      severityLabel: 'ASSET HIGH',
      dims: 'asset_class × MTBF × incidents_30d',
      reason:
        'Asset Health Scout idle — needs Gap-M2 census + Gap-M3 history view. Once populated, predicts failure window and queues replacement CapEx draft.',
      handoffs: [
        { label: 'Send to: Asset Health Scout' },
        { label: 'Open detail' },
      ],
    },
    {
      id: 'energy-anom',
      severity: 'med',
      title: 'kWh/occ × HDD/CDD adjusted × deviation',
      severityLabel: 'ENERGY MED',
      dims: 'meter × weather_norm × baseline',
      reason:
        'Energy Anomaly Hunter idle — needs Gap-M4 readings + weather_norm. Once active, flags +20% deviation as ticket draft.',
      handoffs: [{ label: 'Send to: Energy Anomaly Hunter' }],
    },
    {
      id: 'mtbf-watch',
      severity: 'med',
      title: 'Repeat tickets × same asset × <30 days',
      severityLabel: 'MTBF MED',
      dims: 'asset × ticket_recurrence × interval',
      reason:
        'Detector idle — needs Gap-M3 v_asset_history view. Once active, surfaces assets with shrinking MTBF as replacement candidates.',
      handoffs: [{ label: 'Send to: Maintenance Lead' }],
    },
  ];

  const openCount = tickets ? tickets.length : null;
  const slaRiskCount = tickets
    ? tickets.filter(
        (t) => t.hours_to_sla_breach !== null && t.hours_to_sla_breach !== undefined && t.hours_to_sla_breach < 4
      ).length
    : null;

  return (
    <>
      {/* BLOCK 1 */}
      <div
        style={{
          fontSize: 11,
          color: 'var(--ink-mute)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginTop: 14,
        }}
      >
        <strong style={{ color: 'var(--ink-soft)' }}>Operations</strong> › Maintenance
      </div>
      <h1
        style={{
          margin: '4px 0 2px',
          fontFamily: 'Georgia, serif',
          fontWeight: 500,
          fontSize: 30,
        }}
      >
        Maintenance · before it <em style={{ color: 'var(--brass)' }}>breaks</em>.
      </h1>
      <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
        Tickets, assets, energy, and CapEx — predict, fix, then plan.
      </div>

      {/* BLOCK 2 */}
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
        <span style={pillActive}>Last 30 days</span>
        <span style={pill}>7d</span>
        <span style={pill}>90d</span>
        <span style={pill}>YTD</span>
        <span style={pill}>All categories</span>
        <span style={pill}>All priorities</span>
        <span style={pill}>All vendors</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-mute)' }}>
          Property + segment filters above (layout)
        </span>
      </div>

      {/* BLOCK 4 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 10,
          marginTop: 14,
        }}
      >
        <OpsKpiTile
          scope="Open tickets · SLA risk"
          value={
            openCount !== null && slaRiskCount !== null
              ? <>{openCount} / <span style={{ color: 'var(--st-bad)' }}>{slaRiskCount}</span></>
              : '—'
          }
          label="<4h to urgent breach"
          needs={tickets ? undefined : 'Data needed · Gap-M1'}
        />
        <OpsKpiTile
          scope="MTTR · 30d"
          value="—"
          label="target 4h"
          needs="Data needed · Gap-M1"
        />
        <OpsKpiTile
          scope="Asset health"
          value="—"
          label="142 assets · red zone count tbd"
          needs="Data needed · Gap-M2 census"
        />
        <OpsKpiTile
          scope="Energy · kWh/occ rm"
          value="—"
          label="benchmark 32 · weather-adj"
          needs="Data needed · Gap-M4"
          valueColor="var(--st-bad)"
        />
        <OpsKpiTile
          scope="Water · m³/occ rm"
          value="—"
          label="benchmark 0.85"
          needs="Data needed · Gap-M4"
          valueColor="var(--brass)"
        />
        <OpsKpiTile
          scope="CapEx pipeline · 90d"
          value={capex && capex.length > 0
            ? `$${capex.reduce((s, c) => s + (c.est_cost || 0), 0).toLocaleString()}`
            : '—'}
          label="must-do + should-do"
          needs={capex ? undefined : 'Data needed · Gap-M9'}
        />
      </div>

      {/* BLOCK 5 */}
      <AgentStrip
        pageScope="maintenance"
        agents={[slaWatcher, assetHealthScout, energyAnomalyHunter, ppmScheduler]}
      />

      {/* BLOCK 6 */}
      <DecisionQueue
        rows={decisions}
        meta="ranked by urgency × $ impact"
        emptyOverlay={
          <DataNeededOverlay
            gap="governance.agent_decisions"
            table="governance.agent_decisions"
            reason="Agents idle until Gap-M1..M9 populated. Decision queue ships empty until first agent run."
          />
        }
      />

      {/* BLOCK 7 */}
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
          <TicketQueue rows={tickets} />
          <AssetHeatMap cells={assets} />
          <PpmCalendar rows={ppm} />
        </div>
        <div>
          <EnergyDash rows={energy} />
          <SpareParts rows={parts} />
          <CapExPipeline rows={capex} />
        </div>
      </div>

      <VendorScorecard rows={vendors} />

      {/* BLOCK 9 */}
      <GuardrailsBanner>
        <strong>No external vendor write or PO ever auto-fired.</strong>{' '}
        Maintenance ops are internal — no Cloudbeds write endpoint. Vendor
        dispatch, replacement orders, and CapEx promotion are all behind
        explicit human approval. CapEx "Promote" writes only to{' '}
        <code>governance.budget_proposals</code> for /finance/budget review.
        Agents ship in approval-required mode.
      </GuardrailsBanner>
    </>
  );
}

const pill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 10px',
  border: '1px solid var(--paper-deep)',
  borderRadius: 6,
  background: '#fff',
  fontSize: 12,
};

const pillActive: React.CSSProperties = {
  ...pill,
  background: 'var(--moss-mid)',
  color: '#fff',
  borderColor: 'var(--moss-mid)',
};
