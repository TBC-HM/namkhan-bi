'use client';

// components/agents/AgentEditModal.tsx
// Industry-standard agent configuration modal.
// Tabs: Overview · Prompt · Knowledge · Triggers · Guardrails · Tools · Output · Test · Metrics · History
//
// Trigger:
//   - dispatchEvent(new CustomEvent('agent:open', { detail: { id: 'tactical-agent', label?: 'Tactical Detector' } }))
//   - or call window.openAgent('tactical-agent')   (used by Federico mockup inline onclicks)
//
// All data is sample/static for the pilot. Wire to Supabase + LLM provider later.

import { useEffect, useMemo, useState } from 'react';

// ---- Sample agent registry ------------------------------------------------
type AgentStatus = 'active' | 'paused' | 'observing' | 'error';
type AgentMode   = 'inherit' | 'observe' | 'review' | 'auto-t1';

interface AgentDef {
  id: string;
  label: string;
  pillar: 'revenue' | 'sales' | 'marketing' | 'operations' | 'guest' | 'finance';
  status: AgentStatus;
  reason?: string;
  promptVersion: string;
  promptTokens: number;
  promptBody: string;
  description: string;
  cadenceType: 'cron' | 'interval' | 'event';
  cadenceValue: string;
  triggers: string[];
  knowledge: Array<{ name: string; size: string; updated: string }>;
  guardrailOverrides: { confFloor?: number; minImpact?: number; cooldownH?: number; maxActionsPerDay?: number };
  tools: Array<{ key: string; label: string; allowed: boolean; tier: 'read' | 'write' | 'external' }>;
  output: { channel: string; format: string; recipients: string[] };
  metrics: { firedLast30d: number; ackRate: string; accuracy: string; avgImpact: string };
  history: Array<{ when: string; who: string; what: string }>;
  produces?: string[];
}

const AGENTS: Record<string, AgentDef> = {
  'tactical-agent': {
    id: 'tactical-agent',
    label: 'Tactical Detector',
    pillar: 'revenue',
    status: 'active',
    promptVersion: 'v3.2',
    promptTokens: 687,
    promptBody:
`You are the Tactical Detector for The Namkhan.

# Your role
Scan rolling 30-day demand signals against forward 90-day inventory and flag tactical opportunities or risks above the configured impact threshold.

# Decision rules
- Only fire if confidence >= {{detection.confidence_floor}}.
- Only fire if revenue impact >= {{detection.min_impact}}.
- Suppress duplicate dimensions for {{detection.cooldown_hours}}h.
- Honor blackout dates from {{action.blackouts}}.

# Output format
Return: { dimension, direction, impact_usd, confidence, evidence_refs[], recommended_action, escalation_tier }.

# Escalation logic
- Tier 1 (< $1k): auto-execute when guardrails permit.
- Tier 2 ($1k–$5k): RM review.
- Tier 3 (> $5k): RM + GM 2-person rule.
`,
    description: 'Detects tactical revenue opportunities and risks across the forward 90-day window.',
    cadenceType: 'cron',
    cadenceValue: '0 */2 * * *',
    triggers: ['Cloudbeds reservation_change webhook', 'Cube refresh complete', 'Manual run'],
    knowledge: [
      { name: 'rate-strategy-2026.md',     size: '14 KB', updated: '12d ago' },
      { name: 'blackouts-LP.md',           size: '3 KB',  updated: '2d ago'  },
      { name: 'roomtype-floor-ceiling.csv',size: '1 KB',  updated: '14d ago' },
      { name: 'segment-mapping.md',        size: '7 KB',  updated: '30d ago' },
      { name: 'comp-set-roster.md',        size: '2 KB',  updated: '21d ago' },
    ],
    guardrailOverrides: { confFloor: 70, minImpact: 1000, cooldownH: 6, maxActionsPerDay: 8 },
    tools: [
      { key: 'cube.read',          label: 'Read demand cube',           allowed: true,  tier: 'read'     },
      { key: 'compset.read',       label: 'Read comp-set scrape',       allowed: true,  tier: 'read'     },
      { key: 'cloudbeds.read',     label: 'Read Cloudbeds inventory',   allowed: true,  tier: 'read'     },
      { key: 'cloudbeds.rate',     label: 'Write rate change',          allowed: false, tier: 'write'    },
      { key: 'cloudbeds.restrict', label: 'Write restriction (CTA/CTD)',allowed: false, tier: 'write'    },
      { key: 'slack.post',         label: 'Post Slack alert',           allowed: true,  tier: 'external' },
    ],
    output: { channel: 'Slack #revenue-alerts + Inbox', format: 'structured JSON + human summary', recipients: ['Federico (RM)', 'GM'] },
    metrics: { firedLast30d: 47, ackRate: '89 %', accuracy: '76 %', avgImpact: '$2,840' },
    history: [
      { when: '2h ago',  who: 'Federico', what: 'Edited prompt · v3.1 → v3.2 (added segment evidence requirement)' },
      { when: '14d ago', who: 'Federico', what: 'Lowered confidence floor 75 % → 70 %' },
      { when: '21d ago', who: 'Federico', what: 'Added blackout-LP.md to knowledge base' },
      { when: '60d ago', who: 'Setup',    what: 'Initial agent created' },
    ],
    produces: [
      'Tactical alerts in Slack #revenue-alerts',
      'Recommendation rows in Operations · Today inbox',
      'Evidence-linked impact estimates',
    ],
  },
  'forecast-agent': {
    id: 'forecast-agent',
    label: 'Forecast Engine',
    pillar: 'revenue',
    status: 'paused',
    reason: 'needs 90d clean Cloudbeds history · currently 42d',
    promptVersion: 'v0.9',
    promptTokens: 387,
    promptBody:
`You are the Forecast Engine for The Namkhan.

# Your role
Produce daily revenue forecasts at +30, +60, +90 days with 80% confidence intervals. Wait for {{forecast.min_history_days}} days of clean Cloudbeds data before activating. Currently {{forecast.current_history_days}} / {{forecast.min_history_days}}.

# Decision rules (when active)
- Reject any forecast with confidence below 60 %.
- Always emit best/likely/worst scenarios.
- Flag pace deviations > 8 % vs budget.

# Output format
Return: { date, scenario, occ_pct, adr_usd, revpar_usd, ci_low, ci_high, evidence_refs[] }.
`,
    description: 'ML-based revenue forecast · paused waiting for 90d training history.',
    cadenceType: 'cron',
    cadenceValue: '0 03 * * *',
    triggers: ['Daily 03:00 LAK', 'On-demand backtest'],
    knowledge: [
      { name: 'historical-occ-2024.csv', size: '45 KB', updated: '90d ago' },
      { name: 'fx-rates-LAK.csv',        size: '2 KB',  updated: '7d ago'  },
    ],
    guardrailOverrides: {},
    tools: [
      { key: 'cube.read',         label: 'Read demand cube',            allowed: true,  tier: 'read' },
      { key: 'cloudbeds.history', label: 'Read Cloudbeds history',      allowed: true,  tier: 'read' },
      { key: 'forecast.publish',  label: 'Publish forecast to dashboard',allowed: true, tier: 'write' },
    ],
    output: { channel: 'Revenue · Pace dashboard', format: 'forecast rows + CI bands', recipients: ['Federico', 'GM', 'Owner'] },
    metrics: { firedLast30d: 0, ackRate: 'n/a', accuracy: 'n/a', avgImpact: 'n/a' },
    history: [
      { when: '60d ago', who: 'Setup', what: 'Initial v0.9 prompt template loaded · agent paused awaiting data' },
    ],
    produces: [
      'Daily revenue forecast +30 / +60 / +90 days with 80% CI',
      'Pace deviation early warning (e.g. "May 2026 will close 12% below budget")',
      'Optimal rate suggestions per room type per date',
      'Cancellation forecast by segment',
    ],
  },
};

const FALLBACK = (id: string, label?: string): AgentDef => ({
  id,
  label: label || id,
  pillar: 'revenue',
  status: 'active',
  promptVersion: 'v1.0',
  promptTokens: 320,
  promptBody: `You are the ${label || id} for The Namkhan.\n\n# Your role\n[Describe scope and primary task here.]\n\n# Decision rules\n[Reference detection.* and action.* guardrails.]\n\n# Output format\n[Structured JSON + human summary.]\n`,
  description: 'Sample agent configuration · wire to registry to populate.',
  cadenceType: 'interval',
  cadenceValue: 'every 4h',
  triggers: ['Sample trigger 1', 'Sample trigger 2'],
  knowledge: [{ name: 'sample-knowledge.md', size: '4 KB', updated: 'recent' }],
  guardrailOverrides: { confFloor: 70, minImpact: 1000 },
  tools: [
    { key: 'data.read',  label: 'Read pillar data',     allowed: true,  tier: 'read'     },
    { key: 'slack.post', label: 'Post Slack notification', allowed: true, tier: 'external' },
  ],
  output: { channel: 'Slack + Inbox', format: 'structured + summary', recipients: ['Federico'] },
  metrics: { firedLast30d: 12, ackRate: '85 %', accuracy: '74 %', avgImpact: '$1,200' },
  history: [{ when: 'recent', who: 'Setup', what: 'Sample agent record' }],
  produces: ['Sample output 1', 'Sample output 2'],
});

// ---- Modal --------------------------------------------------------------

type Tab = 'overview' | 'prompt' | 'knowledge' | 'triggers' | 'guardrails' | 'tools' | 'output' | 'test' | 'metrics' | 'history';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview',   label: 'Overview'   },
  { key: 'prompt',     label: 'Prompt'     },
  { key: 'knowledge',  label: 'Knowledge'  },
  { key: 'triggers',   label: 'Triggers'   },
  { key: 'guardrails', label: 'Guardrails' },
  { key: 'tools',      label: 'Tools'      },
  { key: 'output',     label: 'Output'     },
  { key: 'test',       label: 'Test'       },
  { key: 'metrics',    label: 'Metrics'    },
  { key: 'history',    label: 'History'    },
];

export default function AgentEditModal() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [openLabel, setOpenLabel] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    function onOpen(e: Event) {
      const ce = e as CustomEvent<{ id: string; label?: string }>;
      setOpenId(ce.detail?.id ?? 'sample-agent');
      setOpenLabel(ce.detail?.label);
      setTab('overview');
    }
    window.addEventListener('agent:open', onOpen);
    // Bridge for inline onclick="openAgent('id')" handlers in Federico mockup.
    (window as unknown as { openAgent?: (id: string, label?: string) => void }).openAgent =
      (id: string, label?: string) => window.dispatchEvent(new CustomEvent('agent:open', { detail: { id, label } }));
    return () => {
      window.removeEventListener('agent:open', onOpen);
      delete (window as unknown as { openAgent?: unknown }).openAgent;
    };
  }, []);

  const agent = useMemo<AgentDef | null>(() => {
    if (!openId) return null;
    return AGENTS[openId] ?? FALLBACK(openId, openLabel);
  }, [openId, openLabel]);

  if (!agent) return null;

  return (
    <div
      role="dialog"
      aria-modal
      onClick={() => setOpenId(null)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 24, 22, 0.55)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 16px',
        overflow: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--paper-warm)',
          border: '1px solid var(--line-soft)',
          borderRadius: 8,
          width: 'min(960px, 100%)',
          boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
          fontFamily: 'var(--sans)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid var(--line-soft)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: 1.4 }}>
              {agent.pillar} · agent configuration
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>
              {agent.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
              {agent.description}
            </div>
          </div>
          <StatusPill status={agent.status} reason={agent.reason} />
          <button
            onClick={() => setOpenId(null)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 22,
              cursor: 'pointer',
              color: 'var(--ink-mute)',
              padding: 4,
            }}
            aria-label="Close"
          >×</button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: 4,
          padding: '0 22px',
          borderBottom: '1px solid var(--line-soft)',
          overflowX: 'auto',
        }}>
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--moss)' : '2px solid transparent',
                  padding: '12px 14px',
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  color: active ? 'var(--ink)' : 'var(--ink-mute)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >{t.label}</button>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ padding: '22px', minHeight: 320, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
          {tab === 'overview'   && <Overview agent={agent} />}
          {tab === 'prompt'     && <PromptEditor agent={agent} />}
          {tab === 'knowledge'  && <Knowledge agent={agent} />}
          {tab === 'triggers'   && <Triggers agent={agent} />}
          {tab === 'guardrails' && <GuardrailOverrides agent={agent} />}
          {tab === 'tools'      && <Tools agent={agent} />}
          {tab === 'output'     && <Output agent={agent} />}
          {tab === 'test'       && <Test agent={agent} />}
          {tab === 'metrics'    && <Metrics agent={agent} />}
          {tab === 'history'    && <History agent={agent} />}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px',
          borderTop: '1px solid var(--line-soft)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
          background: 'var(--paper-deep, #f7f3eb)',
          borderRadius: '0 0 8px 8px',
        }}>
          <button className="btn" style={{ fontSize: 11 }}>Discard changes</button>
          <button className="btn" style={{ fontSize: 11 }}>Backtest 30d</button>
          <button className="btn" style={{ fontSize: 11 }}>Dry-run</button>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-mute)' }}>
            Edits create a new version · pilot phase requires human approval before publish
          </span>
          <button className="btn" style={{ fontSize: 11 }}>Save draft</button>
          <button className="btn" style={{
            fontSize: 11,
            background: 'var(--moss)',
            color: '#fff',
            borderColor: 'var(--moss)',
          }}>Save &amp; publish</button>
        </div>
      </div>
    </div>
  );
}

// ============== Status pill =================================================
function StatusPill({ status, reason }: { status: AgentStatus; reason?: string }) {
  const color =
    status === 'active'    ? 'var(--moss)'    :
    status === 'paused'    ? 'var(--brass)'   :
    status === 'observing' ? 'var(--ink-mute)':
    'var(--oxblood)';
  return (
    <div style={{ textAlign: 'right' }}>
      <span className="pill" style={{ background: color, color: '#fff', textTransform: 'capitalize' }}>{status}</span>
      {reason && <div style={{ fontSize: 10, color: 'var(--ink-mute)', marginTop: 4, maxWidth: 220 }}>{reason}</div>}
    </div>
  );
}

// ============== OVERVIEW =====================================================
function Overview({ agent }: { agent: AgentDef }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card-grid-4">
        <Mini label="Status"  value={agent.status} />
        <Mini label="Pillar"  value={agent.pillar} />
        <Mini label="Prompt"  value={agent.promptVersion} hint={`${agent.promptTokens} tokens`} />
        <Mini label="Cadence" value={agent.cadenceValue} hint={agent.cadenceType} />
      </div>

      <Section title="Mode override · per-agent">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['inherit', 'observe', 'review', 'auto-t1'] as AgentMode[]).map((m, i) => (
            <button key={m} className="btn" style={{
              fontSize: 11,
              ...(i === 0 ? { background: 'var(--moss)', color: '#fff', borderColor: 'var(--moss)' } : {}),
            }}>{m === 'inherit' ? 'Inherit global' : m}</button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 8 }}>
          By default, agents inherit the master operating mode set in <strong>Settings · Agent guardrails</strong>.
          Override here only when this agent needs different behavior (e.g. lower confidence floor for a downstream
          composer that pre-filters with the Tactical Detector).
        </p>
      </Section>

      <Section title="What this agent produces">
        <ul style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--ink-soft)', margin: 0, paddingLeft: 18 }}>
          {(agent.produces ?? []).map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      </Section>
    </div>
  );
}

// ============== PROMPT =======================================================
function PromptEditor({ agent }: { agent: AgentDef }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="pill" style={{ background: 'var(--moss)', color: '#fff' }}>{agent.promptVersion} · current</span>
        <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{agent.promptTokens} tokens · last edit 2h ago by Federico</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="btn" style={{ fontSize: 11 }}>A/B vs previous</button>
          <button className="btn" style={{ fontSize: 11 }}>Compare versions</button>
          <button className="btn" style={{ fontSize: 11 }}>Reset to template</button>
        </div>
      </div>

      <textarea
        defaultValue={agent.promptBody}
        rows={20}
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 12,
          lineHeight: 1.55,
          color: '#cdd6cf',
          background: '#0f1410',
          border: '1px solid #2a2f2c',
          padding: 14,
          borderRadius: 6,
          resize: 'vertical',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />

      <div style={{
        padding: '10px 14px',
        background: 'rgba(168,133,74,0.1)',
        borderLeft: '3px solid var(--brass)',
        fontSize: 11,
        color: 'var(--ink-soft)',
        lineHeight: 1.6,
      }}>
        <strong>Variables:</strong> use <code>{`{{detection.confidence_floor}}`}</code>, <code>{`{{action.blackouts}}`}</code>, etc.
        to bind to the global guardrail values from <strong>Settings · Agent guardrails</strong>. They resolve at runtime and update automatically when guardrails change.
      </div>
    </div>
  );
}

// ============== KNOWLEDGE ====================================================
function Knowledge({ agent }: { agent: AgentDef }) {
  return (
    <div>
      <Section title="Files & data sources this agent can read">
        <table className="tbl">
          <thead><tr><th>Source</th><th>Size</th><th>Last updated</th><th /></tr></thead>
          <tbody>
            {agent.knowledge.map((k, i) => (
              <tr key={i}>
                <td className="lbl"><strong>{k.name}</strong></td>
                <td>{k.size}</td>
                <td style={{ color: 'var(--ink-mute)' }}>{k.updated}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn" style={{ fontSize: 10, marginRight: 4 }}>preview</button>
                  <button className="btn" style={{ fontSize: 10 }}>remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn" style={{ fontSize: 11 }}>+ Add file</button>
          <button className="btn" style={{ fontSize: 11 }}>+ Add Supabase view</button>
          <button className="btn" style={{ fontSize: 11 }}>+ Add URL</button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 12, lineHeight: 1.6 }}>
          Knowledge is injected into the agent's context window before each run. Keep total tokens under 8k for best
          results. Larger sources are auto-retrieved by similarity (RAG).
        </p>
      </Section>
    </div>
  );
}

// ============== TRIGGERS =====================================================
function Triggers({ agent }: { agent: AgentDef }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Section title="Schedule">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select defaultValue={agent.cadenceType} className="btn" style={{ fontSize: 12, padding: '6px 10px' }}>
            <option value="cron">Cron expression</option>
            <option value="interval">Fixed interval</option>
            <option value="event">Event-driven only</option>
          </select>
          <input
            defaultValue={agent.cadenceValue}
            style={{
              flex: 1,
              minWidth: 200,
              fontFamily: 'var(--mono)',
              fontSize: 12,
              padding: '6px 10px',
              border: '1px solid var(--line-soft)',
              borderRadius: 4,
              background: '#fff',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>LAK timezone</span>
        </div>
      </Section>

      <Section title="Event triggers">
        <ul style={{ fontSize: 12, lineHeight: 1.8, paddingLeft: 18, color: 'var(--ink-soft)', margin: 0 }}>
          {agent.triggers.map((t, i) => (
            <li key={i}>
              <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{t}</code>
              <a style={{ marginLeft: 8, fontSize: 11, color: 'var(--moss)', cursor: 'pointer' }}>remove</a>
            </li>
          ))}
        </ul>
        <button className="btn" style={{ fontSize: 11, marginTop: 10 }}>+ Add trigger</button>
      </Section>

      <Section title="Conditions (gating)">
        <p style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
          Add conditions that must be true at fire time (e.g. <code>data.freshness_hours &lt; 2</code>,
          <code> compset.coverage_pct &gt;= 80</code>, <code>day_of_week not in (Sat, Sun)</code>).
        </p>
        <button className="btn" style={{ fontSize: 11, marginTop: 10 }}>+ Add condition</button>
      </Section>
    </div>
  );
}

// ============== GUARDRAIL OVERRIDES ==========================================
function GuardrailOverrides({ agent }: { agent: AgentDef }) {
  const o = agent.guardrailOverrides;
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 14px' }}>
        These override the global thresholds in <strong>Settings · Agent guardrails</strong> for this agent only.
        Leave blank to inherit. Most agents should inherit — override only when you have a clear reason.
      </p>
      <table className="tbl">
        <thead><tr><th>Guardrail</th><th>Global</th><th>This agent</th><th>Effect</th></tr></thead>
        <tbody>
          <tr>
            <td className="lbl"><strong>Confidence floor</strong></td>
            <td>70 %</td>
            <td><InputNum value={o.confFloor} unit="%" /></td>
            <td style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{o.confFloor ? 'override active' : 'inherits global'}</td>
          </tr>
          <tr>
            <td className="lbl"><strong>Min revenue impact</strong></td>
            <td>$1,000</td>
            <td><InputNum value={o.minImpact} prefix="$" /></td>
            <td style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{o.minImpact ? 'override active' : 'inherits global'}</td>
          </tr>
          <tr>
            <td className="lbl"><strong>Cooldown per dimension</strong></td>
            <td>6 hrs</td>
            <td><InputNum value={o.cooldownH} unit="hrs" /></td>
            <td style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{o.cooldownH ? 'override active' : 'inherits global'}</td>
          </tr>
          <tr>
            <td className="lbl"><strong>Max actions per day</strong></td>
            <td>—</td>
            <td><InputNum value={o.maxActionsPerDay} unit="acts" /></td>
            <td style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{o.maxActionsPerDay ? 'cap set' : 'no cap'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ============== TOOLS ========================================================
function Tools({ agent }: { agent: AgentDef }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '0 0 14px' }}>
        Capabilities this agent can invoke. <strong>Read</strong> = data access, <strong>Write</strong> = mutates internal state,
        <strong> External</strong> = calls outside system (Cloudbeds, Slack, ad platforms). External writes always require approval.
      </p>
      <table className="tbl">
        <thead><tr><th>Tool</th><th>Tier</th><th>Allowed</th><th>Approval</th></tr></thead>
        <tbody>
          {agent.tools.map(t => (
            <tr key={t.key}>
              <td className="lbl">
                <strong>{t.label}</strong>
                <div style={{ fontSize: 10, color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>{t.key}</div>
              </td>
              <td>
                <span className="pill" style={{
                  background:
                    t.tier === 'read'  ? 'var(--ink-mute)' :
                    t.tier === 'write' ? 'var(--brass)'    :
                    'var(--oxblood)',
                  color: '#fff',
                }}>{t.tier}</span>
              </td>
              <td>
                <label style={{ fontSize: 11, display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked={t.allowed} />
                  {t.allowed ? 'allowed' : 'blocked'}
                </label>
              </td>
              <td style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
                {t.tier === 'read' ? 'auto' : t.tier === 'write' ? 'RM approval' : 'RM + GM ($5k+)'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============== OUTPUT =======================================================
function Output({ agent }: { agent: AgentDef }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Section title="Delivery channel">
        <input
          defaultValue={agent.output.channel}
          style={{ width: '100%', fontSize: 12, padding: '8px 10px', border: '1px solid var(--line-soft)', borderRadius: 4, background: '#fff' }}
        />
      </Section>
      <Section title="Output format">
        <select defaultValue={agent.output.format} style={{ width: '100%', fontSize: 12, padding: '8px 10px', border: '1px solid var(--line-soft)', borderRadius: 4, background: '#fff' }}>
          <option>structured JSON + human summary</option>
          <option>structured JSON only</option>
          <option>markdown brief</option>
          <option>plain text alert</option>
          <option>structured + CI bands (forecast)</option>
        </select>
      </Section>
      <Section title="Recipients">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {agent.output.recipients.map(r => (
            <span key={r} className="pill" style={{ background: 'var(--moss)', color: '#fff' }}>{r} ×</span>
          ))}
          <button className="btn" style={{ fontSize: 11 }}>+ Add recipient</button>
        </div>
      </Section>
      <Section title="Escalation paths">
        <ul style={{ fontSize: 12, lineHeight: 1.8, paddingLeft: 18, color: 'var(--ink-soft)', margin: 0 }}>
          <li>If no ack in <strong>30 min</strong> → reroute to GM</li>
          <li>If no ack in <strong>2 hrs</strong>  → page Owner</li>
          <li>If anomaly auto-disable triggers → freeze + email Federico</li>
        </ul>
      </Section>
    </div>
  );
}

// ============== TEST =========================================================
function Test({ agent: _agent }: { agent: AgentDef }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Section title="Backtest">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="btn" style={{ fontSize: 12, padding: '6px 10px' }}>
            <option>last 30 days</option>
            <option>last 60 days</option>
            <option>last 90 days</option>
          </select>
          <button className="btn" style={{ fontSize: 11, background: 'var(--moss)', color: '#fff', borderColor: 'var(--moss)' }}>
            Run backtest
          </button>
          <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Replays the agent against historical data with the current prompt + guardrails. Does not write.</span>
        </div>
      </Section>
      <Section title="Dry-run">
        <p style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
          Run the agent now against live data, log the decision, but block any external writes. Use to validate prompt changes before committing.
        </p>
        <button className="btn" style={{ fontSize: 11, marginTop: 10 }}>Run dry-run on current state</button>
      </Section>
      <Section title="A/B test vs previous version">
        <p style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
          Split traffic 50/50 between current and previous prompt version for N days. Compare ack rate, accuracy, and impact.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input type="number" defaultValue={7} style={{ width: 80, fontSize: 12, padding: '6px 10px', border: '1px solid var(--line-soft)', borderRadius: 4 }} />
          <span style={{ fontSize: 12, color: 'var(--ink-soft)', alignSelf: 'center' }}>days</span>
          <button className="btn" style={{ fontSize: 11 }}>Start A/B</button>
        </div>
      </Section>
      <Section title="Sample run · paste a hypothetical input">
        <textarea
          rows={6}
          placeholder="Paste a hypothetical scenario (e.g. an inventory snapshot) and run the agent against it without touching live data..."
          style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: 12, padding: 10, border: '1px solid var(--line-soft)', borderRadius: 4, background: '#fff', boxSizing: 'border-box' }}
        />
        <button className="btn" style={{ fontSize: 11, marginTop: 8 }}>Run sample</button>
      </Section>
    </div>
  );
}

// ============== METRICS ======================================================
function Metrics({ agent }: { agent: AgentDef }) {
  const m = agent.metrics;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card-grid-4">
        <Mini label="Fired (last 30d)" value={String(m.firedLast30d)} />
        <Mini label="Acknowledgement rate" value={m.ackRate} />
        <Mini label="Accuracy (ack-validated)" value={m.accuracy} />
        <Mini label="Avg revenue impact" value={m.avgImpact} />
      </div>
      <Section title="Drift indicators">
        <ul style={{ fontSize: 12, lineHeight: 1.8, paddingLeft: 18, color: 'var(--ink-soft)', margin: 0 }}>
          <li>Confidence drift · <strong>stable</strong> (mean 78% over last 30d, σ 4%)</li>
          <li>Output token drift · <strong>watch</strong> (avg 412 tokens, up 18% over baseline)</li>
          <li>Refusal rate · <strong>stable</strong> (1.2%)</li>
          <li>Latency p95 · <strong>stable</strong> (3.1s)</li>
        </ul>
      </Section>
      <Section title="Cost (last 30d)">
        <ul style={{ fontSize: 12, lineHeight: 1.8, paddingLeft: 18, color: 'var(--ink-soft)', margin: 0 }}>
          <li>Inference spend · <strong>$8.40</strong> ($0.18 per fire)</li>
          <li>Embedding/retrieval spend · <strong>$1.10</strong></li>
          <li>Total · <strong>$9.50</strong></li>
        </ul>
      </Section>
    </div>
  );
}

// ============== HISTORY ======================================================
function History({ agent }: { agent: AgentDef }) {
  return (
    <div>
      <table className="tbl">
        <thead><tr><th>When</th><th>Who</th><th>Change</th><th /></tr></thead>
        <tbody>
          {agent.history.map((h, i) => (
            <tr key={i}>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)' }}>{h.when}</td>
              <td className="lbl"><strong>{h.who}</strong></td>
              <td style={{ fontSize: 12 }}>{h.what}</td>
              <td style={{ textAlign: 'right' }}><a style={{ fontSize: 11, color: 'var(--moss)', cursor: 'pointer' }}>view diff · revert</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============== Helpers ======================================================
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        color: 'var(--ink-mute)',
        marginBottom: 8,
        fontWeight: 600,
      }}>{title}</div>
      {children}
    </div>
  );
}

function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-num" style={{ fontSize: 18, textTransform: 'capitalize' }}>{value}</div>
      <div className="kpi-lbl">{label}</div>
      {hint && <div style={{ fontSize: 10, color: 'var(--ink-mute)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function InputNum({ value, prefix, unit }: { value?: number; prefix?: string; unit?: string }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {prefix && <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{prefix}</span>}
      <input
        type="number"
        defaultValue={value ?? ''}
        placeholder="—"
        style={{ width: 70, fontSize: 12, padding: '4px 6px', border: '1px solid var(--line-soft)', borderRadius: 4, background: '#fff' }}
      />
      {unit && <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{unit}</span>}
    </div>
  );
}
