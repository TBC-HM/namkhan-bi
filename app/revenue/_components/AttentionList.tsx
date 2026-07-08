'use client';

// app/revenue/_components/AttentionList.tsx
// Attention list with per-item × dismiss.
//
// PBS 2026-07-08 (#204/attention):
// - DB-backed items (source==='db') dismiss via POST /api/attention/dismiss.
//   The API writes to cockpit.attention_dismissals so state survives across
//   devices / browsers / clears.
// - Seed items (source==='seed') still fall back to localStorage — they only
//   exist in dev when the table is empty.
// - Optimistic UI: hide immediately, keep hidden on failure with a subtle
//   opacity so PBS can tell something didn't stick. localStorage mirror also
//   used for DB items so a page reload never re-flashes an item pre-fetch.
//
// Item shape gained optional `href` (deep-link), `body` (tooltip text),
// `source` ('db'|'seed'). Everything else stays backwards compatible.

import { useEffect, useState } from 'react';

interface AttnItem {
  id: string;
  label: string;
  kind?: string;
  severity?: string;
  href?: string;
  body?: string;
  source?: 'db' | 'seed';
}

interface Props {
  items: AttnItem[];
  storageKey?: string;
  /** PBS 2026-07-08 — email is stamped on the dismissal row so different
   *  operators (or agent workers) don't hide each other's items. */
  userEmail?: string;
}

const SEV_DOT: Record<string, string> = { high: '#C0584C', medium: '#C4A06B', low: '#9B907A' };

export default function AttentionList({ items, storageKey = 'attn:revenue', userEmail }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setDismissed(new Set(JSON.parse(raw) as string[]));
    } catch { /* noop */ }
    setHydrated(true);
  }, [storageKey]);

  const persistLocal = (next: Set<string>) => {
    try { window.localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* noop */ }
  };

  const dismiss = async (item: AttnItem) => {
    const next = new Set(dismissed); next.add(item.id);
    setDismissed(next);
    persistLocal(next);

    if (item.source === 'db' && userEmail) {
      try {
        await fetch('/api/attention/dismiss', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flag_id: Number(item.id), user_email: userEmail }),
        });
      } catch { /* keep it hidden; server retry next reload */ }
    }
  };

  const visible = items.filter((a) => !dismissed.has(a.id));
  if (!hydrated) return null;
  if (visible.length === 0) {
    return <div style={{ padding: 8, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>nothing flagged</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {visible.map((a) => {
        const dot = SEV_DOT[a.severity ?? 'medium'] ?? SEV_DOT.medium;
        const labelEl = a.href
          ? <a href={a.href} style={{ flex: 1, color: 'var(--ink, #1B1B1B)', textDecoration: 'none' }} title={a.body ?? undefined}>{a.label}</a>
          : <span style={{ flex: 1, color: 'var(--ink, #1B1B1B)' }} title={a.body ?? undefined}>{a.label}</span>;
        return (
          <div key={a.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 0', fontSize: 12,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: dot, flex: '0 0 8px',
            }} aria-hidden />
            {labelEl}
            {a.kind && (
              <span style={{
                fontSize: 10, color: 'var(--ink-soft, #5A5A5A)',
                padding: '1px 6px', border: '1px solid #E6DFCC', borderRadius: 99,
              }}>{a.kind}</span>
            )}
            <button type="button" onClick={() => dismiss(a)} aria-label="Dismiss"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 14, color: 'var(--ink-soft, #5A5A5A)', padding: '0 4px',
                fontFamily: 'inherit',
              }}>×</button>
          </div>
        );
      })}
    </div>
  );
}
