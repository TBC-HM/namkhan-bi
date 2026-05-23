'use client';

// app/revenue/_components/AttentionList.tsx
// Attention list with per-item × dismiss. Dismissals persist to localStorage
// per (deptSlug, propertyId) so they survive reloads but stay client-side
// (cfg.defaultAttn is static, no DB write needed). PBS note#167.

import { useEffect, useState } from 'react';

interface AttnItem {
  id: string;
  label: string;
  kind?: string;
  severity?: string;
}

interface Props {
  items: AttnItem[];
  storageKey?: string;
}

const SEV_DOT: Record<string, string> = { high: '#C0584C', medium: '#C4A06B', low: '#9B907A' };

export default function AttentionList({ items, storageKey = 'attn:revenue' }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setDismissed(new Set(JSON.parse(raw) as string[]));
    } catch { /* noop */ }
    setHydrated(true);
  }, [storageKey]);

  const dismiss = (id: string) => {
    const next = new Set(dismissed); next.add(id);
    setDismissed(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* noop */ }
  };

  const visible = items.filter((a) => !dismissed.has(a.id));
  if (!hydrated) return null;
  if (visible.length === 0) {
    return <div style={{ padding: 8, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>nothing flagged</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {visible.map((a) => (
        <div key={a.id} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 0', fontSize: 12,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: SEV_DOT[a.severity ?? 'medium'] ?? SEV_DOT.medium,
            flex: '0 0 8px',
          }} aria-hidden />
          <span style={{ flex: 1, color: 'var(--ink, #1B1B1B)' }}>{a.label}</span>
          {a.kind && (
            <span style={{
              fontSize: 10, color: 'var(--ink-soft, #5A5A5A)',
              padding: '1px 6px', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 99,
            }}>{a.kind}</span>
          )}
          <button type="button" onClick={() => dismiss(a.id)} aria-label="Dismiss"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 14, color: 'var(--ink-soft, #5A5A5A)', padding: '0 4px',
              fontFamily: 'inherit',
            }}>×</button>
        </div>
      ))}
    </div>
  );
}
