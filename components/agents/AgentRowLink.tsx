'use client';

// components/agents/AgentRowLink.tsx
// Client wrapper for opening AgentEditModal from a clickable row/button.
// Used by AgentsHub (server component) — wraps the agent name and the "edit" button.

import type { ReactNode } from 'react';

export function AgentLink({ id, label, children, asButton, style }: {
  id: string;
  label: string;
  children: ReactNode;
  asButton?: boolean;
  style?: React.CSSProperties;
}) {
  function open() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('agent:open', { detail: { id, label } }));
  }
  if (asButton) {
    return (
      <button className="btn" style={{ fontSize: "var(--t-xs)", ...style }} onClick={open}>
        {children}
      </button>
    );
  }
  return (
    <a
      onClick={open}
      style={{ color: 'var(--moss)', fontWeight: 600, cursor: 'pointer', ...style }}
    >
      {children}
    </a>
  );
}
