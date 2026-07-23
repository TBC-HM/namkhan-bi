'use client';
// app/university/_components/Feedback.tsx
// "Was this helpful?" thumbs on every article page. Each vote lands in the
// university question log (the content backlog) via /api/university/feedback.

import { useState } from 'react';

const HAIR = '#E6DFCC';
const INK_SOFT = '#5A5A5A';
const GREEN = '#084838';

export default function Feedback({ slug, module }: { slug: string; module: string }) {
  const [sent, setSent] = useState<'up' | 'down' | null>(null);
  const [busy, setBusy] = useState(false);

  const vote = async (v: 'up' | 'down') => {
    if (sent || busy) return;
    setBusy(true);
    try {
      await fetch('/api/university/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, module, helpful: v === 'up' }),
      });
      setSent(v);
    } catch { /* best-effort */ } finally { setBusy(false); }
  };

  const btn = (active: boolean) => ({
    fontSize: 14, padding: '6px 12px', borderRadius: 5, cursor: sent ? 'default' : 'pointer',
    border: `1px solid ${active ? GREEN : HAIR}`, background: active ? GREEN : '#FFFFFF',
    color: active ? '#FFFFFF' : INK_SOFT, fontFamily: 'inherit',
  });

  return (
    <div style={{ marginTop: 24, paddingTop: 14, borderTop: `1px solid ${HAIR}`, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12.5, color: INK_SOFT }}>Was this helpful?</span>
      <button type="button" onClick={() => vote('up')} disabled={!!sent || busy} style={btn(sent === 'up')}>👍</button>
      <button type="button" onClick={() => vote('down')} disabled={!!sent || busy} style={btn(sent === 'down')}>👎</button>
      {sent && <span style={{ fontSize: 12, color: GREEN }}>Thanks — noted for PBS.</span>}
    </div>
  );
}
