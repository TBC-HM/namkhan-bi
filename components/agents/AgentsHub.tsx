// components/agents/AgentsHub.tsx
// Generic Agents page used by Sales · Marketing · Ops · Guest · Finance.
// Shows ONLY pillar-specific content:
//   - intro + pointer to /settings/agents
//   - roster KPIs
//   - agent table (rows clickable → opens AgentEditModal)
//   - optional pillar-specific cards (spend guardrails for Marketing, brand rules)
//
// Global guardrails (operating mode, detection, approval matrix, data quality, audit, kill switch)
// live at /settings/agents.

import type { AgentChipDef } from '@/components/ops/AgentStrip';
import { AgentLink } from './AgentRowLink';

export interface ChannelSpendRow {
  channel: string;
  cap: number;
  used: number;
  cpaCap?: number;
}

export interface AgentsHubProps {
  pillarKey: 'sales' | 'marketing' | 'operations' | 'guest' | 'finance';
  pillarLabel: string;
  intro: string;
  agents: AgentChipDef[];
  spendCapMonthly?: number;
  spendUsedMtd?: number;
  channelSpend?: ChannelSpendRow[];
  brandRules?: string[];
}

const STATUS_COLORS = {
  run:    { dot: 'var(--moss)',     pill: 'var(--moss)',    label: 'running' },
  idle:   { dot: 'var(--ink-mute)', pill: 'var(--ink-mute)',label: 'idle' },
  paused: { dot: 'var(--brass)',    pill: 'var(--brass)',   label: 'paused' },
  err:    { dot: 'var(--oxblood)',  pill: 'var(--oxblood)', label: 'error' },
} as const;

function agentId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function AgentsHub({
  pillarKey,
  pillarLabel,
  intro,
  agents,
  spendCapMonthly,
  spendUsedMtd,
  channelSpend,
  brandRules,
}: AgentsHubProps) {
  const runCount    = agents.filter(a => a.status === 'run').length;
  const idleCount   = agents.filter(a => a.status === 'idle').length;
  const pausedCount = agents.filter(a => a.status === 'paused').length;
  const errCount    = agents.filter(a => a.status === 'err').length;

  return (
    <div className="agents-hub" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Intro + pointer to global settings */}
      <div className="card" style={{ background: 'var(--paper-warm)', borderLeft: '3px solid var(--moss)' }}>
        <div style={{ fontSize: "var(--t-md)", lineHeight: 1.6, color: 'var(--ink-soft)' }}>
          <strong style={{ color: 'var(--ink)' }}>{pillarLabel} agents · </strong>{intro}
        </div>
        <div style={{
          marginTop: 10,
          padding: '8px 12px',
          background: 'rgba(168,133,74,0.08)',
          borderLeft: '3px solid var(--brass)',
          fontSize: "var(--t-sm)",
          color: 'var(--ink-soft)',
        }}>
          Global guardrails (operating mode · detection · approval matrix · data quality · audit · kill switch) live at{' '}
          <a href="/settings/agents" style={{ color: 'var(--moss)', fontWeight: 600 }}>Settings → Agent guardrails →</a>
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

      {/* Agent roster — click to open modal */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Agent <em>roster</em></div>
            <div className="card-sub">{agents.length} agents · click any agent to open the editor</div>
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
              <th />
            </tr>
          </thead>
          <tbody>
            {agents.map((a, i) => {
              const sc = STATUS_COLORS[a.status];
              const id = agentId(a.name);
              return (
                <tr key={i}>
                  <td className="lbl">
                    <AgentLink id={id} label={a.name}>{a.name}</AgentLink>
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: "var(--t-sm)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                      <span style={{ color: sc.pill }}>{sc.label}</span>
                    </span>
                  </td>
                  <td style={{ fontSize: "var(--t-base)", color: 'var(--ink-mute)' }}>{a.cadence}</td>
                  <td style={{ fontSize: "var(--t-base)", color: 'var(--ink-soft)', maxWidth: 380 }}>{a.description ?? '—'}</td>
                  <td className="num">{a.guardrails?.length ?? 0}</td>
                  <td style={{ textAlign: 'right' }}>
                    <AgentLink id={id} label={a.name} asButton>edit →</AgentLink>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Spend guardrail (pillars with paid spend — Marketing typically) */}
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
              <div style={{ fontSize: "var(--t-sm)", color: 'var(--ink-mute)', marginTop: 4 }}>
                {Math.round(((spendUsedMtd ?? 0) / spendCapMonthly) * 100)}% used
              </div>
            </div>
          </div>

          {channelSpend && channelSpend.length > 0 && (
            <table className="tbl" style={{ marginTop: 14 }}>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th className="num">Monthly cap</th>
                  <th className="num">Used MTD</th>
                  <th>Headroom</th>
                  <th className="num">Auto-pause if CPA &gt;</th>
                </tr>
              </thead>
              <tbody>
                {channelSpend.map((c, i) => {
                  const pct = c.cap > 0 ? Math.min(100, (c.used / c.cap) * 100) : 0;
                  const barColor = pct > 85 ? 'var(--oxblood)' : pct > 70 ? 'var(--brass)' : 'var(--moss)';
                  return (
                    <tr key={i}>
                      <td className="lbl">{c.channel}</td>
                      <td className="num">${c.cap.toLocaleString()}</td>
                      <td className="num">${c.used.toLocaleString()}</td>
                      <td>
                        <div style={{ background: 'var(--paper-deep)', borderRadius: 4, height: 6, width: 100, overflow: 'hidden' }}>
                          <div style={{ background: barColor, height: '100%', width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="num">{c.cpaCap ? `$${c.cpaCap}` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div style={{
            marginTop: 12,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            padding: '8px 10px',
            background: 'var(--paper-warm)',
            borderRadius: 4,
          }}>
            <span style={{ fontSize: "var(--t-base)", color: 'var(--ink-soft)' }}>
              <strong>Auto-pause underperformers</strong> · if a tactic's actual CPA exceeds the per-channel limit, auto-pause and notify
            </span>
            <span className="pill" style={{ marginLeft: 'auto', background: 'var(--moss)', color: 'var(--paper-warm)' }}>enabled</span>
          </div>
          <div style={{
            marginTop: 6,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            padding: '8px 10px',
            background: 'var(--paper-warm)',
            borderRadius: 4,
          }}>
            <span style={{ fontSize: "var(--t-base)", color: 'var(--ink-soft)' }}>
              <strong>Daily spend velocity cap</strong> · no tactic can spend &gt; this much in a single day
            </span>
            <span style={{ marginLeft: 'auto', fontSize: "var(--t-base)", fontFamily: 'var(--mono)' }}>$500 / day</span>
          </div>
        </div>
      )}

      {/* Brand / strategy */}
      {brandRules && brandRules.length > 0 && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Brand &amp; <em>strategy</em></div>
              <div className="card-sub">Don't break positioning · {pillarLabel}-specific</div>
            </div>
          </div>
          <ul style={{ fontSize: "var(--t-base)", color: 'var(--ink-soft)', lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
            {brandRules.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
