'use client';

// components/chat/FloatingCentralChat.tsx
// Central Chat v1 · round 3 (brief central-chat-v1, §0.B.1 rollout).
// Floating help-bot chrome hosting the ONE central chat component —
// replaces FloatingMira (PBS note#8 kept the floating-corner UX; the
// legacy panel deep-linked /cockpit/chat which is retired).
//
// Collapsed: a circle bottom-right. Expanded: a panel with a full scoped
// CentralChat instance (second-brain default, general toggle inside the
// component per V4). Knowledge scope = the embedding surface's module
// (one-channel law: every turn routes through Felix).

import { useState } from 'react';
import CentralChat, { type CentralChatMode } from '@/components/chat/CentralChat';

interface Props {
  /** Module/capability of the embedding surface (e.g. 'revenue'). */
  moduleScope: string;
  /** Tenant scope when embedded under /h/[pid]. */
  propertyId?: number;
  /** Instance default mode — general is always offered inside the component. */
  mode?: CentralChatMode;
  emoji?: string;
  label?: string;
}

export default function FloatingCentralChat({
  moduleScope,
  propertyId,
  mode = 'second-brain',
  emoji = '💬',
  label,
}: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open chat"
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 30,
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--primary, #1F3A2E)', color: '#FFFFFF',
          border: '1px solid var(--primary, #1F3A2E)',
          boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
          fontSize: 24, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'inherit',
        }}
      >
        {emoji}
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Central chat"
      style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 30,
        width: 'min(420px, calc(100vw - 32px))',
        boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
        borderRadius: 4, overflow: 'hidden',
        background: 'var(--paper, #FFFFFF)',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', borderBottom: '1px solid var(--hairline, #E6DFCC)',
          background: 'var(--paper, #FFFFFF)',
        }}
      >
        <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>
          {label ?? moduleScope}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close chat"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: 18, color: 'var(--ink-soft, #5A5A5A)', padding: 0, lineHeight: 1,
            fontFamily: 'inherit',
          }}
        >×</button>
      </div>
      <CentralChat mode={mode} moduleScope={moduleScope} propertyId={propertyId} />
    </div>
  );
}
