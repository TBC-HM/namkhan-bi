'use client';

// app/(cockpit)/_design/FloatingMira.tsx
// Floating help-bot button at fixed bottom-right of every revenue page.
// PBS note#8: "K Vector button on every revenue page but not as button more
// floating in the right corner like a normal help bot which I can expand
// or x like a support".
// Collapsed: a circle with the dept emoji. Expanded: a small panel with the
// "Ask <hodName>" CTA. Closeable (×) → collapses back to the circle.

import { useState } from 'react';

interface Props {
  hodName?: string;
  chatHref?: string;
  emoji?: string;
  label?: string;
}

export default function FloatingMira({
  hodName = 'Mira',
  chatHref = '/cockpit/chat?dept=revenue',
  emoji = '📈',
  label = 'Revenue',
}: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open ${hodName} chat`}
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
      aria-label={`${hodName} quick chat`}
      style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 30,
        width: 280, padding: '14px 16px',
        background: 'var(--paper, #FFFFFF)',
        border: '1px solid var(--hairline, #E6DFCC)',
        borderRadius: 10,
        boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
        fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{emoji}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink, #1B1B1B)' }}>{hodName}</span>
          <span style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: 18, color: 'var(--ink-soft, #5A5A5A)', padding: 0, lineHeight: 1,
            fontFamily: 'inherit',
          }}
        >×</button>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', lineHeight: 1.45 }}>
        Ask anything about pace, channels, rate plans or pickup. {hodName} has reservation read access for both properties.
      </p>
      <a
        href={chatHref}
        style={{
          display: 'inline-block', padding: '8px 14px',
          fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
          background: 'var(--primary, #1F3A2E)', color: '#FFFFFF',
          borderRadius: 4, textDecoration: 'none',
        }}
      >
        Open chat →
      </a>
    </div>
  );
}
