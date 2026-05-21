'use client';

// components/nav/NDropdown.tsx
// PBS 2026-05-14 — the top-left brass mark is now BC (Beyond Circle) and
// acts as the global PROPERTY SWITCHER. Click → menu of:
//   • Beyond Circle · Holding (Felix landing at /holding)
//   • The Namkhan (260955 — Cloudbeds / LAK)
//   • Donna Portals (1000001 — Mews / EUR)
//
// History:
//   • 2026-05-08 — N replaced the LeftRail and opened a dept-menu popover.
//   • 2026-05-13 — N became a passive home link (dropdown stripped).
//   • 2026-05-14 — rebranded N→BC, dropdown reinstated as property switcher.
//
// The duplicate switcher inside HeaderPills was removed in the same change.

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const HOLDING_PROPERTY_ID = 0;

interface PropertyOption {
  property_id: number;
  display_name: string;
  tagline: string;
}

const ALL_PROPERTIES: PropertyOption[] = [
  { property_id: HOLDING_PROPERTY_ID, display_name: 'Beyond Circle',  tagline: 'Holding · Felix' },
  { property_id: 260955,              display_name: 'The Namkhan',    tagline: 'Luang Prabang · PMS' },
  { property_id: 1000001,             display_name: 'Donna Portals',  tagline: 'Mallorca · Mews' },
];

function activePropertyFromPath(pathname: string): number | null {
  if (pathname.startsWith('/holding') || pathname === '/h/0' || pathname.startsWith('/h/0/')) {
    return HOLDING_PROPERTY_ID;
  }
  const m = pathname.match(/^\/h\/(\d+)(\/|$)/);
  if (m) return Number(m[1]);
  return null;
}

export default function NDropdown() {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeId = activePropertyFromPath(pathname);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onClickAway);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickAway);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  function switchTo(id: number) {
    setOpen(false);
    if (id === activeId) return;
    document.cookie = `tbc.active_property=${id}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`;
    if (id === HOLDING_PROPERTY_ID) {
      router.push('/holding');
      return;
    }
    // Preserve the current dept sub-path when switching between properties.
    const newPath = pathname.startsWith('/h/')
      ? pathname.replace(/^\/h\/\d+/, `/h/${id}`)
      : pathname.startsWith('/holding')
        ? `/h/${id}`
        : `/h/${id}`;
    router.push(newPath);
  }

  return (
    <div ref={ref} style={{ position: 'fixed', top: 12, left: 12, zIndex: 1000 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Beyond Circle — switch property"
        title="Switch property"
        style={{
          width: 32,
          height: 28,
          borderRadius: 6,
          background: 'linear-gradient(135deg, #c79a6b, #b88556)',
          color: '#1a1a1a',
          fontWeight: 700,
          fontFamily: "'Cooper','Source Serif Pro',Georgia,serif",
          fontStyle: 'italic',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecoration: 'none',
          boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
          border: 'none',
          cursor: 'pointer',
          fontSize: 11,
          letterSpacing: '0.04em',
          lineHeight: 1,
          padding: 0,
        }}
      >
        BC
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 6,
            minWidth: 240,
            background: 'var(--paper-warm)',
            border: '1px solid var(--line)',
            borderRadius: 10,
            boxShadow: '0 12px 28px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            colorScheme: 'light',
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              fontFamily: 'var(--mono)',
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--brass)',
              borderBottom: '1px solid var(--line-soft)',
            }}
          >
            Switch property
          </div>
          {ALL_PROPERTIES.map((opt) => {
            const active = opt.property_id === activeId;
            return (
              <button
                key={opt.property_id}
                onClick={() => switchTo(opt.property_id)}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '10px 14px',
                  background: active ? 'var(--paper-deep)' : 'transparent',
                  color: active ? 'var(--brass)' : 'var(--ink)',
                  fontWeight: active ? 600 : 400,
                  fontSize: 14,
                  fontFamily: 'var(--sans)',
                  textAlign: 'left',
                  border: 'none',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--line-soft)',
                }}
              >
                <span>{opt.display_name}</span>
                <span style={{ fontSize: 10, color: 'var(--ink-mute)', fontFamily: 'var(--mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {active ? '· active' : opt.tagline}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
