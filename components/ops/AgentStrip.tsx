'use client';

// components/ops/AgentStrip.tsx
// Block 5 — Agent strip with chips, status dots, and Fire-all.
// Min 2 chips per /revenue IA standard. Click → modal stub (alert for now).

import { useState } from 'react';

export type AgentStatus = 'run' | 'idle' | 'paused' | 'err';

export interface AgentChipDef {
  name: string;
  cadence: string;       // e.g. "30 min", "hourly", "check-in event"
  status: AgentStatus;
  description?: string;
  guardrails?: string[]; // e.g. ["approval-required", "no-auto-fire"]
}

interface Props {
  agents: AgentChipDef[];
  pageScope: string;     // e.g. "housekeeping" — used in modal text
}

const dotColors: Record<AgentStatus, string> = {
  run: '#2f6f4a',
  idle: '#a89c80',
  paused: '#a87024',
  err: 'var(--oxblood)',
};

export default function AgentStrip({ agents, pageScope }: Props) {
  const [active, setActive] = useState<AgentChipDef | null>(null);

  return (
    <>
      <div
        style={{
          marginTop: 14,
          padding: '10px 14px',
          background: 'var(--paper-warm)',
          border: '1px solid #e6dfc9',
          borderRadius: 8,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: "var(--t-sm)",
            color: '#8a8170',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginRight: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#2f6f4a',
              display: 'inline-block',
            }}
          />
          Agents · live
        </span>

        {agents.map((a) => (
          <button
            key={a.name}
            type="button"
            onClick={() => setActive(a)}
            title={a.description || a.name}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 11px',
              border: '1px solid #e6dfc9',
              borderRadius: 999,
              background: 'var(--paper-warm)',
              fontSize: "var(--t-base)",
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: dotColors[a.status],
                display: 'inline-block',
              }}
            />
            <span style={{ fontWeight: 600 }}>{a.name}</span>
            <span style={{ color: '#8a8170' }}>· {a.cadence}</span>
          </button>
        ))}

        <button
          type="button"
          onClick={() =>
            alert(
              `⚡ Fire all (${pageScope}) — disabled. All agents ship in approval-required mode until validated against 90 days of decisions.`
            )
          }
          style={{
            marginLeft: 'auto',
            background: '#1f3d2e',
            color: 'var(--paper-warm)',
            border: 0,
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: "var(--t-base)",
            fontWeight: 600,
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          ⚡ Fire all
        </button>
      </div>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActive(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(28,28,26,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--paper-warm)',
              border: '1px solid #e6dfc9',
              borderRadius: 10,
              padding: 24,
              maxWidth: 520,
              width: '90%',
              boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
            }}
          >
            <div
              style={{
                fontSize: "var(--t-sm)",
                color: '#8a8170',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Agent · {pageScope}
            </div>
            <h3
              style={{
                margin: '6px 0 8px',
                fontFamily: 'var(--serif)',
                fontSize: "var(--t-2xl)",
                fontWeight: 500,
              }}
            >
              {active.name}
            </h3>
            <div style={{ fontSize: "var(--t-md)", color: '#4a4538', marginBottom: 12 }}>
              Cadence · {active.cadence} · status{' '}
              <span style={{ color: dotColors[active.status], fontWeight: 600 }}>
                {active.status}
              </span>
            </div>
            {active.description && (
              <p style={{ fontSize: "var(--t-md)", color: '#4a4538', lineHeight: 1.55 }}>
                {active.description}
              </p>
            )}
            {active.guardrails && active.guardrails.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div
                  style={{
                    fontSize: "var(--t-xs)",
                    color: '#8a8170',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 4,
                  }}
                >
                  Guardrails
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: "var(--t-base)", color: '#4a4538' }}>
                  {active.guardrails.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ marginTop: 18, textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setActive(null)}
                style={{
                  background: '#a17a4f',
                  color: 'var(--paper-warm)',
                  border: 0,
                  padding: '7px 16px',
                  borderRadius: 6,
                  fontSize: "var(--t-base)",
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
