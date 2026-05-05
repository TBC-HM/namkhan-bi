// app/revenue/compset/_components/agent/AgentSelectorTabs.tsx
// Pill-style tabs to switch the active agent via ?agent=<code>.

'use client';

import Link from 'next/link';
import type { AgentSettingsRow } from '../scoring/types';

interface Props {
  agents: AgentSettingsRow[];
  selectedCode: string;
}

export default function AgentSelectorTabs({ agents, selectedCode }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        marginTop: 18,
      }}
    >
      {agents.map((a) => {
        const active = a.code === selectedCode;
        return (
          <Link
            key={a.code}
            href={`/revenue/compset/agent-settings?agent=${encodeURIComponent(a.code)}`}
            style={{
              padding: '8px 16px',
              borderRadius: 12,
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
              fontWeight: 600,
              textDecoration: 'none',
              border: `1px solid ${active ? 'var(--moss)' : 'var(--paper-deep)'}`,
              background: active ? 'var(--moss)' : 'var(--paper-warm)',
              color: active ? 'var(--paper-warm)' : 'var(--ink-soft)',
            }}
          >
            {a.code}
          </Link>
        );
      })}
    </div>
  );
}
