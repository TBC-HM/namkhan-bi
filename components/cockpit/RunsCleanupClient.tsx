// components/cockpit/RunsCleanupClient.tsx
// Client side of the runs cleanup page. Shows the stuck-runs table grouped
// by agent. Action buttons are disabled with a "pending migration" tooltip
// until governance.run_retry/run_archive/runs_bulk_archive RPCs ship.

'use client';

import { useState } from 'react';

interface StuckRun {
  run_id: string;
  agent_role: string;
  agent_name: string;
  property_id: number | null;
  status: string;
  started_at: string;
  hours_stuck: number;
  input_excerpt: string;
  error_message: string | null;
}

interface Group {
  key: string;
  role: string;
  name: string;
  items: StuckRun[];
}

interface Summary {
  total: number;
  agents: number;
  over_24h: number;
  over_48h: number;
  error: string | null;
}

const ACTIONS_PENDING_MSG = 'Action requires governance.run_retry/run_archive RPCs (pending migration). See cockpit.intake_items#agent-runs-cleanup-migration.';

export default function RunsCleanupClient({
  summary,
  runsByAgent,
}: {
  summary: Summary;
  runsByAgent: Group[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpanded(next);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Summary tiles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <Tile label="Stuck total" value={summary.total} />
        <Tile label="Across agents" value={summary.agents} />
        <Tile label=">24h stuck" value={summary.over_24h} accent />
        <Tile label=">48h stuck" value={summary.over_48h} accent />
      </div>

      {summary.error && (
        <div style={{ color: '#c0584c', fontSize: 13 }}>
          Load error: {summary.error}
        </div>
      )}

      {/* Bulk action bar (disabled until RPCs ship) */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          padding: '12px 14px',
          background: 'var(--surf-1, #0f0d0a)',
          border: '1px solid var(--border-1, #1f1c15)',
          borderRadius: 8,
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--text-mute, #9b907a)' }}>
          Bulk:
        </span>
        <BulkButton label="Archive all >24h" hours={24} />
        <BulkButton label="Archive all >48h" hours={48} />
        <BulkButton label="Retry all" disabled />
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim, #7d7565)' }}>
          Actions land after migration applies.
        </span>
      </div>

      {/* Groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {runsByAgent.length === 0 && (
          <div style={{ padding: 24, color: 'var(--text-mute, #9b907a)', textAlign: 'center' }}>
            No stuck runs. 🎉
          </div>
        )}
        {runsByAgent.map((g) => {
          const isOpen = expanded.has(g.key);
          return (
            <div
              key={g.key}
              style={{
                border: '1px solid var(--border-1, #1f1c15)',
                borderRadius: 10,
                overflow: 'hidden',
                background: 'var(--surf-1, #0f0d0a)',
              }}
            >
              <button
                onClick={() => toggle(g.key)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-0, #e9e1ce)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16 }}>
                  {g.name}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-mute, #9b907a)' }}>
                  {g.role}
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 12,
                    color: 'var(--accent, #a8854a)',
                    fontWeight: 600,
                  }}
                >
                  {g.items.length} stuck
                </span>
                <span style={{ color: 'var(--text-dim, #7d7565)', fontSize: 10 }}>
                  {isOpen ? '▼' : '▸'}
                </span>
              </button>

              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border-1, #1f1c15)' }}>
                  {g.items.map((r) => (
                    <RunRow key={r.run_id} run={r} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div
      style={{
        flex: '1 1 140px',
        background: 'var(--surf-1, #0f0d0a)',
        border: '1px solid var(--border-1, #1f1c15)',
        borderRadius: 8,
        padding: '14px 16px',
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--text-mute, #9b907a)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          marginTop: 4,
          fontFamily: "'Fraunces', Georgia, serif",
          color: accent ? 'var(--accent, #a8854a)' : 'var(--text-0, #e9e1ce)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function BulkButton({ label, hours, disabled }: { label: string; hours?: number; disabled?: boolean }) {
  const reason = disabled ? 'Pending RPC' : `${ACTIONS_PENDING_MSG} (target: ${hours}h+)`;
  return (
    <button
      title={reason}
      disabled
      style={{
        background: 'transparent',
        color: 'var(--text-dim, #7d7565)',
        border: '1px solid var(--border-2, #2a261d)',
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 12,
        cursor: 'not-allowed',
      }}
    >
      {label}
    </button>
  );
}

function RunRow({ run }: { run: StuckRun }) {
  return (
    <div
      style={{
        padding: '10px 14px',
        borderTop: '1px solid var(--border-1, #1f1c15)',
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <code style={{ fontSize: 10, color: 'var(--text-dim, #7d7565)', fontFamily: "'JetBrains Mono', monospace" }}>
        {run.run_id.slice(0, 8)}
      </code>
      <span style={{ fontSize: 11, color: 'var(--text-mute, #9b907a)' }}>
        {new Date(run.started_at).toISOString().slice(0, 16).replace('T', ' ')}
      </span>
      <span
        style={{
          fontSize: 11,
          color: run.hours_stuck >= 48 ? '#c0584c' : run.hours_stuck >= 24 ? 'var(--accent, #a8854a)' : 'var(--text-mute, #9b907a)',
        }}
      >
        {run.hours_stuck.toFixed(1)}h stuck
      </span>
      {run.property_id !== null && (
        <span style={{ fontSize: 10, color: 'var(--text-dim, #7d7565)' }}>
          prop {run.property_id}
        </span>
      )}
      <span style={{ flex: 1, minWidth: 200, fontSize: 11, color: 'var(--text-dim, #7d7565)', fontFamily: "'JetBrains Mono', monospace" }}>
        {run.input_excerpt || '—'}
      </span>
      <button
        title={ACTIONS_PENDING_MSG}
        disabled
        style={{
          background: 'transparent',
          border: '1px solid var(--border-2, #2a261d)',
          color: 'var(--text-dim, #7d7565)',
          borderRadius: 4,
          padding: '4px 8px',
          fontSize: 11,
          cursor: 'not-allowed',
        }}
      >
        Retry
      </button>
      <button
        title={ACTIONS_PENDING_MSG}
        disabled
        style={{
          background: 'transparent',
          border: '1px solid var(--border-2, #2a261d)',
          color: 'var(--text-dim, #7d7565)',
          borderRadius: 4,
          padding: '4px 8px',
          fontSize: 11,
          cursor: 'not-allowed',
        }}
      >
        Archive
      </button>
    </div>
  );
}
