'use client';
// app/(cockpit)/_design/tile/KpiPopoverButton.tsx
// University "?" popup for KPI tiles. Placed inline in the tile headRow.
// Lazy-fetches /api/kpi-catalog, caches results in a module-level Map.
// Renders nothing when no catalog entry exists (canon 552).

import { useEffect, useRef, useState } from 'react';
import type { KpiEntry } from '@/lib/kpiCatalog';

const _cache = new Map<string, KpiEntry | null>();

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

async function fetchEntry(key: string): Promise<KpiEntry | null> {
  if (_cache.has(key)) return _cache.get(key)!;
  try {
    const r = await fetch(`/api/kpi-catalog?key=${encodeURIComponent(key)}`, { cache: 'no-store' });
    const data = r.ok ? (await r.json() as KpiEntry | null) : null;
    _cache.set(key, data);
    return data;
  } catch {
    _cache.set(key, null);
    return null;
  }
}

interface Props {
  /** Explicit kpi_name or gold_view. Falls back to normalizing `label` if omitted. */
  kpiKey?: string;
  /** Tile label — used for auto-match when kpiKey is not provided. */
  label: string;
}

export default function KpiPopoverButton({ kpiKey, label }: Props) {
  const key = kpiKey ?? normalizeLabel(label);
  const [entry, setEntry] = useState<KpiEntry | null | undefined>(() =>
    _cache.has(key) ? (_cache.get(key) ?? null) : undefined
  );
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (entry !== undefined) return;
    fetchEntry(key).then(setEntry);
  }, [key, entry]);

  useEffect(() => {
    if (!open) return;
    function down(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function esc(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', esc); };
  }, [open]);

  // No entry found → render nothing (never guess)
  if (!entry) return null;

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0, lineHeight: 1 }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        title="KPI definition"
        aria-label="Show KPI definition"
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          width: 14, height: 14, borderRadius: '50%',
          border: '1px solid var(--hairline, #E6DFCC)',
          background: 'transparent',
          color: 'var(--ink-soft, #5A5A5A)',
          fontSize: 9, fontWeight: 700, lineHeight: 1,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, flexShrink: 0,
        }}
      >?</button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'absolute', right: 0, top: 18, zIndex: 1000,
            width: 300, maxHeight: '80vh', overflowY: 'auto',
            background: 'var(--paper, #FFFFFF)',
            border: '1px solid var(--hairline, #E6DFCC)',
            borderRadius: 8, padding: '14px 16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
            fontSize: 12.5, color: 'var(--ink, #1B1B1B)',
            fontFamily: 'var(--sans, system-ui, sans-serif)',
          }}
        >
          {/* Header */}
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 2 }}>
            {entry.kpi_name.replace(/_/g, ' ')}
          </div>
          {entry.family && (
            <div style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
              {entry.family.replace(/_/g, ' ')}
            </div>
          )}

          {/* Meaning */}
          {entry.meaning_plain && (
            <p style={{ margin: '0 0 10px', lineHeight: 1.55 }}>{entry.meaning_plain}</p>
          )}

          {/* Formula */}
          {entry.formula_plain && (
            <pre style={{
              margin: '0 0 10px', padding: '7px 10px',
              background: 'var(--hairline, #E6DFCC)', borderRadius: 4,
              fontSize: 11, fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              whiteSpace: 'pre-wrap', lineHeight: 1.5, overflowX: 'auto',
            }}>
              {entry.formula_plain}
            </pre>
          )}

          {/* Watch out */}
          {entry.watch_out && (
            <div style={{
              padding: '7px 10px', marginBottom: 10, borderRadius: 4,
              background: 'rgba(184,168,120,0.15)',
              color: 'var(--status-amber, #B48A3A)',
              fontSize: 11.5, lineHeight: 1.45,
              border: '1px solid rgba(184,168,120,0.3)',
            }}>
              ⚠ {entry.watch_out}
            </div>
          )}

          {/* Gold view */}
          {entry.gold_view && (
            <div style={{
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', marginBottom: 10,
            }}>
              {entry.gold_view}
            </div>
          )}

          {/* Definition status */}
          <span style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
            background: entry.definition_status === 'owner_verified' ? 'rgba(46,125,50,0.12)' : 'rgba(184,168,120,0.18)',
            color: entry.definition_status === 'owner_verified' ? 'var(--status-green, #2E7D32)' : 'var(--status-amber, #B48A3A)',
          }}>
            {entry.definition_status === 'owner_verified' ? '✓ owner verified' : '~ ai draft'}
          </span>
        </div>
      )}
    </div>
  );
}
