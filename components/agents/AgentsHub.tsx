// components/agents/AgentsHub.tsx
// Generic Agents page used by every pillar (Sales · Marketing · Ops · Guest · Finance).
// Modeled on the Revenue/Agents concept (master mode strip · agent table · guardrail layers
// · audit trail · kill switch) but rendered in the standard site style (CSS vars from
// styles/globals.css, no .bc-redesign scope, no Federico mockup CSS).
//
// Server component — pure markup. Pillar passes pillarKey + intro + AgentChipDef[].

import type { AgentChipDef } from '@/components/ops/AgentStrip';

export interface AgentsHubProps {
  pillarKey: 'sales' | 'marketing' | 'operations' | 'guest' | 'finance';
  pillarLabel: string;
  intro: string;
  agents: AgentChipDef[];
  spendCapMonthly?: number;   // optional spend guardrail
  spendUsedMtd?: number;
  brandRules?: string[];
}

const STATUS_COLORS = {
  run:    { dot: 'var(--moss)',     pill: 'var(--moss)',    label: 'running' },
  idle:   { dot: 'var(--ink-mute)', pill: 'var(--ink-mute)',label: 'idle' },
  paused: { dot: 'var(--brass)',    pill: 'var(--brass)',   label: 'paused' },
  err:    { dot: 'var(--oxblood)',  pill: 'var(--oxblood)', label: 'error' },
} as const;

export default function AgentsHub({
  pillarKey,
  pillarLabel,
  intro,
  agents,
  spendCapMonthly,
  spendUsedMtd,
  brandRules,
}: AgentsHubProps) {
  const runCount    = agents.filter(a => a.status === 'run').length;
  const idleCount   = agents.filter(a => a.status === 'idle').length;
  const pausedCount = agents.filter(a => a.status === 'paused').length;
  const errCount    = agents.filter(a => a.status === 'err').length;

  return (
    <div className="agents-hub" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Intro */}
      <div className="card" style={{ background: 'var(--paper-warm)', borderLeft: '3px solid var(--moss)' }}>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-soft)' }}>
          <strong style={{ color: 'var(--ink)' }}>{pillarLabel} agents · </strong>{intro}
        </div>
      </div>

      {/* Roster KPIs */}
      <div className="card-grid-5">
        <div className="kpi-card">
          <div className="kpi-num">{agents.length}</div>
          <div className="kpi-lbl">Agents in roster</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-num pos">{runCount}</div>
          <div className="kpi-lbl">Running</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-num">{idleCount}</div>
          <div className="kpi-lbl">Idle · awaiting data</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-num warn">{pausedCount}</div>
          <div className="kpi-lbl">Paused</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-num neg">{errCount}</div>
          <div className="kpi-lbl">Errors</div>
        </div>
      </div>

      {/* Master operating mode */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Operating <em>mode</em></div>
            <div className="card-sub">Global behavior across all {pillarLabel.toLowerCase()} agents · per-agent overrides below</div>
          </div>
          <span className="card-source">guardrails.{pillarKey}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { key: 'observe',  icon: '👁',  title: 'Observe',     sub: 'detect only',          active: false, locked: false },
            { key: 'review',   icon: '👤', title: 'Review',      sub: 'human approves',       active: true,  locked: false },
            { key: 'auto-t1',  icon: '🤖', title: 'Auto · T1',   sub: '🔒 pilot locked',      active: false, locked: true },
            { key: 'auto-full',icon: '🚀', title: 'Auto · Full', sub: '🔒 disabled',          active: false, locked: true },
          ].map(m => (
            <div key={m.key} style={{
              flex: 1,
              minWidth: 140,
              padding: '12px 14px',
              border: m.active ? '2px solid var(--moss)' : '1px solid var(--line-soft)',
              borderRadius: 6,
              background: m.active ? 'rgba(31,53,40,0.04)' : 'var(--paper-warm)',
              opacity: m.locked ? 0.5 : 1,
              cursor: m.locked ? 'not-allowed' : 'pointer',
              fontSize: 12,
            }}>
              <div style={{ fontSize: 18 }}>{m.icon}</div>
              <div style={{ fontWeight: 600, color: 'var(--ink)', marginTop: 4 }}>{m.title}</div>
              <div style={{ fontSize: 10, color: m.locked ? 'var(--brass)' : 'var(--ink-mute)', marginTop: 2 }}>{m.sub}</div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 12,
          padding: '8px 12px',
          background: 'rgba(168,133,74,0.1)',
          borderLeft: '3px solid var(--brass)',
          fontSize: 11,
          color: 'var(--ink-soft)',
        }}>
          <strong>Pilot phase:</strong> for the first 90 days every external write requires human approval regardless of mode.
          Tier-1 auto unlocks after 90d of Review-mode validation.
        </div>
      </div>

      {/* Agent roster table */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Agent <em>roster</em></div>
            <div className="card-sub">{agents.length} agents · click row for prompt + guardrails</div>
          </div>
          <span className="card-source">{`lib/agents/${pillarKey}/*`}</span>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Status</th>
              <th>Cadence</th>
              <th>Description</th>
              <th className="num">Guardrails</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a, i) => {
              const sc = STATUS_COLORS[a.status];
              return (
                <tr key={i}>
                  <td className="lbl"><strong>{a.name}</strong></td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                      <span style={{ color: sc.pill }}>{sc.label}</span>
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{a.cadence}</td>
                  <td style={{ fontSize: 12, color: 'var(--ink-soft)', maxWidth: 380 }}>{a.description ?? '—'}</td>
                  <td className="num">{a.guardrails?.length ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Guardrail layers */}
      <div className="card-grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Detection <em>guardrails</em></div>
              <div className="card-sub">When do agents fire</div>
            </div>
          </div>
          <ul style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
            <li>Confidence floor · 70%</li>
            <li>Min impact threshold · pillar-specific</li>
            <li>Cooldown per dimension · 6h</li>
            <li>Quiet hours · 22:00 → 07:00 ICT</li>
            <li>Sample size minimum · 10 obs</li>
          </ul>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Action <em>guardrails</em></div>
              <div className="card-sub">What can agents do</div>
            </div>
          </div>
          <ul style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
            <li>Approval-required for any external write</li>
            <li>Mandatory delay · 4h before push to external systems</li>
            <li>Blackout dates honored (Songkran · LP Boat Racing · NYE · Lao NY)</li>
            <li>Frequency caps per channel / per asset</li>
            <li>Two-person rule on $5k+ impact</li>
          </ul>
        </div>
      </div>

      {/* Spend guardrail (only if pillar has paid spend) */}
      {spendCapMonthly !== undefined && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Spend <em>guardrail</em></div>
              <div className="card-sub">Money out the door · auto-pause when cap reached</div>
            </div>
            <span className="card-source">{pillarKey}.spend</span>
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div className="kpi-num">${(spendUsedMtd ?? 0).toLocaleString()}</div>
              <div className="kpi-lbl">Used MTD</div>
            </div>
            <div>
              <div className="kpi-num">${spendCapMonthly.toLocaleString()}</div>
              <div className="kpi-lbl">Monthly cap</div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ background: 'var(--paper-deep)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{
                  background: ((spendUsedMtd ?? 0) / spendCapMonthly) > 0.85 ? 'var(--oxblood)' : 'var(--moss)',
                  height: '100%',
                  width: `${Math.min(100, ((spendUsedMtd ?? 0) / spendCapMonthly) * 100)}%`,
                }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 4 }}>
                {Math.round(((spendUsedMtd ?? 0) / spendCapMonthly) * 100)}% used
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Brand / strategy */}
      {brandRules && brandRules.length > 0 && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Brand &amp; <em>strategy</em></div>
              <div className="card-sub">Don't break positioning</div>
            </div>
          </div>
          <ul style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
            {brandRules.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {/* Audit trail */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Audit trail &amp; <em>rollback</em></div>
            <div className="card-sub">All actions logged · 90d retention · one-click rollback</div>
          </div>
          <span className="card-source">audit.{pillarKey}</span>
        </div>
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
            <tr>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>16:49</td>
              <td className="lbl"><strong>{agents[0]?.name ?? '—'}</strong></td>
              <td style={{ fontSize: 12 }}>Detected anomaly · awaiting data ingest</td>
              <td><span className="pill" style={{ background: 'var(--brass)', color: '#fff' }}>idle</span></td>
              <td style={{ color: 'var(--ink-mute)', fontSize: 11 }}>n/a</td>
            </tr>
            <tr>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>09:14</td>
              <td className="lbl"><strong>{agents[1]?.name ?? '—'}</strong></td>
              <td style={{ fontSize: 12 }}>Drafted recommendation queued for review</td>
              <td><span className="pill" style={{ background: 'var(--brass)', color: '#fff' }}>queued</span></td>
              <td style={{ color: 'var(--ink-mute)', fontSize: 11 }}>n/a</td>
            </tr>
            <tr>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>02:00</td>
              <td className="lbl"><strong>{agents[2]?.name ?? agents[0]?.name ?? '—'}</strong></td>
              <td style={{ fontSize: 12 }}>Weekly run · proposed candidates for review</td>
              <td><span className="pill" style={{ background: 'var(--moss)', color: '#fff' }}>auto</span></td>
              <td style={{ color: 'var(--moss)', fontSize: 11, cursor: 'pointer' }}>view</td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-mute)' }}>
          Showing last 24h · audit feed is mocked until <code>audit.{pillarKey}</code> table ships.
        </div>
      </div>

      {/* Kill switch */}
      <div className="card" style={{ background: 'rgba(110,30,30,0.06)', border: '2px solid var(--oxblood)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 24 }}>🛑</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--oxblood)' }}>Master kill switch</div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
              Disable all {agents.length} {pillarLabel.toLowerCase()} agents immediately. Existing pending actions are cancelled.
              Use only in emergencies (data corruption, OTA outage, system audit).
            </div>
          </div>
          <button style={{
            background: 'var(--oxblood)',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}>DISABLE ALL {pillarLabel.toUpperCase()} AGENTS</button>
        </div>
      </div>
    </div>
  );
}
