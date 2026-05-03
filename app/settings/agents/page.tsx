// app/settings/agents/page.tsx
// Settings · Agent guardrails (GLOBAL).
// Cross-pillar agent governance — applies to every agent on every pillar.
// Domain-specific guardrails (Revenue rate caps, Marketing spend caps) live on the
// respective pillar's /agents page.

import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import { PILLAR_HEADER, RAIL_SUBNAV } from '@/components/nav/subnavConfig';

export const dynamic = 'force-dynamic';

const MODES = [
  { key: 'observe',   icon: '👁',  title: 'Observe',     sub: 'detect only',          active: false, locked: false },
  { key: 'review',    icon: '👤', title: 'Review',      sub: 'human approves',       active: true,  locked: false },
  { key: 'auto-t1',   icon: '🤖', title: 'Auto · T1',   sub: '🔒 pilot locked',      active: false, locked: true },
  { key: 'auto-full', icon: '🚀', title: 'Auto · Full', sub: '🔒 disabled',          active: false, locked: true },
];

const APPROVAL_ROWS: Array<{ action: string; lo: string; mid: string; hi: string; delay: string; emph?: 'pilot' | 'red' }> = [
  { action: 'Rate change',                     lo: 'Auto-execute',     mid: 'RM approval', hi: 'RM + GM (2-person)', delay: '4h' },
  { action: 'Restriction (CTA/CTD/min-stay)',  lo: 'RM approval',      mid: 'RM approval', hi: 'RM + GM',            delay: '2h' },
  { action: 'Paid media (Google/Meta/BDC)',    lo: 'Auto-execute',     mid: 'RM approval', hi: 'RM + GM',            delay: 'none' },
  { action: 'Email send (member segments)',    lo: 'Auto-execute',     mid: 'RM approval', hi: 'RM + Marketing',     delay: '1h' },
  { action: 'Rate plan retire',                lo: 'RM approval',      mid: 'RM approval', hi: 'RM approval',        delay: '24h' },
  { action: 'Comp set parity resync (auto)',   lo: 'Auto',             mid: 'Auto',        hi: 'RM approval',        delay: '0',  emph: 'red' },
  { action: 'Discount > 15%',                  lo: 'Always RM + GM',   mid: 'Always RM + GM', hi: 'Owner sign-off',  delay: '24h' },
];

const AUDIT_ROWS = [
  { time: '16:49', agent: 'Tactical Detector', action: 'Fired alert: EU Suite window closing · –$18.4k · 84% conf', decided: 'awaiting human', dec: 'amber' },
  { time: '16:35', agent: 'Parity Watchdog',   action: 'Auto-resync · BDC May 4 Riverview $215 → $245',             decided: 'auto · <$2k tier',  dec: 'green'  },
  { time: '14:55', agent: 'Tactical Detector', action: 'Fired alert: Asian short-LOS Glamping · +$6.2k · 71% conf', decided: 'awaiting human', dec: 'amber' },
  { time: '11:22', agent: 'Composer',          action: 'Drafted brief · Hospitality Solutions channel restriction', decided: 'Federico (RM)',   dec: 'grey'   },
  { time: '09:14', agent: 'Plan Cleanup',      action: 'Recommended retire: 41 dormant rate plans',                 decided: 'queued',          dec: 'amber' },
  { time: '06:00', agent: 'Comp Set Scanner',  action: 'Detected · Mekong Estate –8% over 7d',                      decided: 'auto · alert only', dec: 'green' },
  { time: '02:00', agent: 'Discovery Agent',   action: 'Weekly run · proposed 5 candidates for review',             decided: 'auto',            dec: 'green' },
] as const;

const VERSION_ROWS = [
  { v: 'v1.4.2', desc: 'Tightened Suite max discount 15% → 12% · added That Luang Festival blackout', who: 'Federico · 2d ago', tag: 'current' },
  { v: 'v1.4.1', desc: 'Increased Google Ads cap $1,200 → $1,500',                                    who: 'Federico · 8d ago', tag: 'past'    },
  { v: 'v1.4.0', desc: 'Enabled Parity Watchdog auto-resync (Tier 1) · $2k auto-execute threshold',  who: 'Federico · 21d ago', tag: 'past'    },
  { v: 'v1.3.0', desc: 'Initial guardrails configured · Review mode default',                        who: 'Setup · 60d ago',    tag: 'past'    },
];

export default function SettingsAgentsPage() {
  const h = PILLAR_HEADER.settings;
  const totalAgents = 49; // 9 revenue + 8 sales + 7 marketing + 9 ops + 9 guest + 7 finance (placeholder)

  return (
    <>
      <Banner
        eyebrow={h.eyebrow}
        title="Agent guardrails"
        titleEmphasis="global"
        meta={<><strong>{totalAgents} agents · 6 pillars</strong> · pilot phase</>}
      />
      <SubNav items={RAIL_SUBNAV.settings} />
      <div className="panel">
        <PanelHero
          eyebrow="Settings"
          title="Agent"
          emphasis="guardrails"
          sub="Cross-pillar governance — detection thresholds, approval matrix, data quality, audit trail. Domain-specific rules (rate caps, ad spend) live on each pillar's /agents page."
          kpis={
            <>
              <KpiCard label="Agents in roster" value={totalAgents} />
              <KpiCard label="Operating mode" value="Review" kind="text" hint="human approves" />
              <KpiCard label="Pilot days remaining" value={48} hint="of 90" />
              <KpiCard label="Audit retention" value="90d" kind="text" hint="all actions logged" />
            </>
          }
        />

        {/* MASTER OPERATING MODE */}
        <Card title="Operating" emphasis="mode" sub="Global behavior across every agent on every pillar · per-agent overrides via the Edit modal" source="guardrails.global">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {MODES.map(m => (
              <div key={m.key} style={{
                flex: 1, minWidth: 160,
                padding: '14px 16px',
                border: m.active ? '2px solid var(--moss)' : '1px solid var(--line-soft)',
                borderRadius: 6,
                background: m.active ? 'rgba(31,53,40,0.04)' : 'var(--paper-warm)',
                opacity: m.locked ? 0.5 : 1,
                cursor: m.locked ? 'not-allowed' : 'pointer',
              }}>
                <div style={{ fontSize: 20 }}>{m.icon}</div>
                <div style={{ fontWeight: 600, color: 'var(--ink)', marginTop: 6, fontSize: 13 }}>{m.title}</div>
                <div style={{ fontSize: 10, color: m.locked ? 'var(--brass)' : 'var(--ink-mute)', marginTop: 2 }}>{m.sub}</div>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 14,
            padding: '10px 14px',
            background: 'rgba(168,133,74,0.1)',
            borderLeft: '3px solid var(--brass)',
            fontSize: 11,
            color: 'var(--ink-soft)',
            lineHeight: 1.6,
          }}>
            <strong>Pilot phase:</strong> for the first 90 days every external write requires human approval regardless of mode.
            Tier-1 auto unlocks after 90d of Review-mode validation runs.
          </div>
        </Card>

        {/* DETECTION GUARDRAILS */}
        <Card title="Detection" emphasis="guardrails" sub="When can any agent fire? · 5 rules · all active" source="detection.global" className="mt-22">
          <table className="tbl">
            <thead><tr><th>Rule</th><th>Description</th><th className="num">Value</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td className="lbl"><strong>Confidence floor</strong></td><td>Don't surface alerts below this confidence level.</td><td className="num">70 %</td><td><span className="pill" style={{ background: 'var(--moss)', color: 'var(--paper-warm)' }}>active</span></td></tr>
              <tr><td className="lbl"><strong>Min impact threshold</strong></td><td>Don't fire alerts below this revenue impact.</td><td className="num">$1,000</td><td><span className="pill" style={{ background: 'var(--moss)', color: 'var(--paper-warm)' }}>active</span></td></tr>
              <tr><td className="lbl"><strong>Cooldown per dimension</strong></td><td>After firing on the same dimension combo, wait this long before firing again.</td><td className="num">6 hrs</td><td><span className="pill" style={{ background: 'var(--moss)', color: 'var(--paper-warm)' }}>active</span></td></tr>
              <tr><td className="lbl"><strong>Quiet hours</strong></td><td>No agent firings during these hours (LAK time).</td><td className="num">22:00 → 07:00</td><td><span className="pill" style={{ background: 'var(--moss)', color: 'var(--paper-warm)' }}>active</span></td></tr>
              <tr><td className="lbl"><strong>Sample size minimum</strong></td><td>Don't act on cube cells with fewer than this many historical data points.</td><td className="num">10 obs</td><td><span className="pill" style={{ background: 'var(--moss)', color: 'var(--paper-warm)' }}>active</span></td></tr>
            </tbody>
          </table>
        </Card>

        {/* APPROVAL MATRIX */}
        <Card title="Approval" emphasis="matrix" sub="Who signs off on what · 3 tiers · 2-person rule on $5k+" source="approvals.global" className="mt-22">
          <div style={{
            padding: '10px 14px',
            background: 'rgba(168,133,74,0.1)',
            borderLeft: '3px solid var(--brass)',
            fontSize: 11,
            color: 'var(--ink-soft)',
            lineHeight: 1.6,
            marginBottom: 12,
          }}>
            <strong>👤 Pilot phase override:</strong> for the first 90 days <strong>every external write requires human approval</strong> regardless of the matrix below. The "Auto-execute" cells show the post-pilot target state.
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Action type</th>
                <th>Below $1k impact</th>
                <th>$1k – $5k</th>
                <th>Above $5k</th>
                <th className="num">Mandatory delay</th>
              </tr>
            </thead>
            <tbody>
              {APPROVAL_ROWS.map((r, i) => (
                <tr key={i} style={r.emph === 'red' ? { background: 'rgba(110,30,30,0.04)' } : undefined}>
                  <td className="lbl"><strong>{r.action}</strong></td>
                  <td>{r.lo}</td>
                  <td>{r.mid}</td>
                  <td><strong>{r.hi}</strong></td>
                  <td className="num">{r.delay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* DATA QUALITY */}
        <Card title="Data quality" emphasis="guardrails" sub="Don't act on bad data · 4 rules · 1 currently blocking" source="dq.global" className="mt-22">
          <table className="tbl">
            <thead><tr><th>Rule</th><th>Description</th><th className="num">Value</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td className="lbl"><strong>Data freshness floor</strong></td><td>Don't fire if Cloudbeds sync is older than this.</td><td className="num">2 hrs</td><td><span className="pill" style={{ background: 'var(--moss)', color: 'var(--paper-warm)' }}>active</span></td></tr>
              <tr><td className="lbl"><strong>Comp-set scrape coverage</strong></td><td>Don't fire comp-set alerts if &lt; this fraction of properties scraped.</td><td className="num">80 %</td><td><span className="pill" style={{ background: 'var(--moss)', color: 'var(--paper-warm)' }}>7/7 today</span></td></tr>
              <tr><td className="lbl"><strong>Pause during PMS sync</strong></td><td>No firings during nightly Cloudbeds sync (01:00–02:30 LAK).</td><td className="num">enabled</td><td><span className="pill" style={{ background: 'var(--moss)', color: 'var(--paper-warm)' }}>active</span></td></tr>
              <tr><td className="lbl"><strong>Anomaly auto-disable</strong></td><td>Auto-disable agents if data anomaly detector flags suspicious data.</td><td className="num">enabled</td><td><span className="pill" style={{ background: 'var(--moss)', color: 'var(--paper-warm)' }}>vigilant</span></td></tr>
            </tbody>
          </table>
        </Card>

        {/* AUDIT TRAIL */}
        <Card title="Audit trail" emphasis="& rollback" sub="All actions logged · 90d retention · one-click rollback" source="audit.global" className="mt-22">
          <table className="tbl">
            <thead>
              <tr>
                <th>Time</th>
                <th>Agent</th>
                <th>Action</th>
                <th>Decided by</th>
                <th>Rollback</th>
              </tr>
            </thead>
            <tbody>
              {AUDIT_ROWS.map((r, i) => {
                const decBg =
                  r.dec === 'amber' ? 'var(--brass)' :
                  r.dec === 'green' ? 'var(--moss)'  :
                  'var(--ink-mute)';
                return (
                  <tr key={i}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{r.time}</td>
                    <td className="lbl"><strong>{r.agent}</strong></td>
                    <td style={{ fontSize: 12 }}>{r.action}</td>
                    <td><span className="pill" style={{ background: decBg, color: 'var(--paper-warm)' }}>{r.decided}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--moss)', cursor: 'pointer' }}>view</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn" style={{ fontSize: 11 }}>Export audit log (CSV)</button>
            <button className="btn" style={{ fontSize: 11 }}>Send weekly governance report → Owner</button>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-mute)' }}>Showing last 24h · cross-pillar</span>
          </div>
        </Card>

        {/* VERSION HISTORY */}
        <Card title="Guardrail" emphasis="version history" sub="Every edit creates a version · revert anytime" source="versions.global" className="mt-22">
          <table className="tbl">
            <thead><tr><th>Version</th><th>Change</th><th>Author</th><th>Status</th></tr></thead>
            <tbody>
              {VERSION_ROWS.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--moss)' }}>{r.v}</td>
                  <td style={{ fontSize: 12 }}>{r.desc}</td>
                  <td style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{r.who}</td>
                  <td>
                    {r.tag === 'current'
                      ? <span className="pill" style={{ background: 'var(--moss)', color: 'var(--paper-warm)' }}>current</span>
                      : <a style={{ fontSize: 11, color: 'var(--moss)', cursor: 'pointer' }}>view diff</a>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* KILL SWITCH */}
        <div className="card mt-22" style={{ background: 'rgba(110,30,30,0.06)', border: '2px solid var(--oxblood)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 28 }}>🛑</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--oxblood)' }}>Master kill switch · disable ALL {totalAgents} agents across ALL pillars</div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 3 }}>
                Existing pending actions are cancelled. Use only in emergencies (data corruption, OTA outage, system-wide audit). Per-pillar kill switches available on each pillar's Agents page.
              </div>
            </div>
            <button style={{
              background: 'var(--oxblood)',
              color: 'var(--paper-warm)',
              border: 'none',
              borderRadius: 4,
              padding: '10px 20px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}>DISABLE ALL AGENTS</button>
          </div>
        </div>
      </div>
    </>
  );
}
