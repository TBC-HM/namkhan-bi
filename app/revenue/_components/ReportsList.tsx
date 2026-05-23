'use client';

// app/revenue/_components/ReportsList.tsx
// Reports list with two states per item:
//   • UNSEEN — red bubble with glow (until first click)
//   • DISMISSED — × button removes the row entirely
// Both states persist to localStorage per (deptSlug, propertyId). PBS #165.

import { useEffect, useState } from 'react';

interface ReportItem {
  id: string;
  label: string;
  href: string;
  report_type?: string;
}

interface Props {
  items: ReportItem[];
  storageKey?: string;
}

export default function ReportsList({ items, storageKey = 'reports:revenue' }: Props) {
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  const seenKey = `${storageKey}:seen`;
  const dismissedKey = `${storageKey}:dismissed`;

  useEffect(() => {
    try {
      const s = window.localStorage.getItem(seenKey);
      if (s) setSeen(new Set(JSON.parse(s) as string[]));
      const d = window.localStorage.getItem(dismissedKey);
      if (d) setDismissed(new Set(JSON.parse(d) as string[]));
    } catch { /* noop */ }
    setHydrated(true);
  }, [seenKey, dismissedKey]);

  const markSeen = (id: string) => {
    if (seen.has(id)) return;
    const next = new Set(seen); next.add(id);
    setSeen(next);
    try { window.localStorage.setItem(seenKey, JSON.stringify([...next])); } catch { /* noop */ }
  };

  const dismiss = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    const next = new Set(dismissed); next.add(id);
    setDismissed(next);
    try { window.localStorage.setItem(dismissedKey, JSON.stringify([...next])); } catch { /* noop */ }
  };

  const visible = items.filter((d) => !dismissed.has(d.id));
  if (!hydrated) return null;
  if (visible.length === 0) {
    return <div style={{ padding: 8, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>no docs yet</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {visible.map((d) => {
        const isNew = !seen.has(d.id);
        return (
          <a key={d.id} href={d.href} target="_blank" rel="noopener noreferrer"
            onClick={() => markSeen(d.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 0', fontSize: 12,
              textDecoration: 'none', color: 'inherit',
            }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isNew ? '#C0584C' : 'var(--brass, #B8542A)',
              flex: '0 0 8px',
              boxShadow: isNew ? '0 0 0 2px rgba(192,88,76,0.25)' : 'none',
            }} aria-hidden />
            <span style={{ flex: 1, color: 'var(--ink, #1B1B1B)', fontWeight: isNew ? 600 : 400 }}>{d.label}</span>
            {d.report_type && (
              <span style={{
                fontSize: 10, color: 'var(--ink-soft, #5A5A5A)',
                padding: '1px 6px', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 99,
              }}>{d.report_type}</span>
            )}
            <button type="button" onClick={(e) => dismiss(e, d.id)} aria-label="Dismiss"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 14, color: 'var(--ink-soft, #5A5A5A)', padding: '0 4px',
                fontFamily: 'inherit',
              }}>×</button>
          </a>
        );
      })}
    </div>
  );
}
