'use client';

// components/nav/NDropdown.tsx
// The N — brass square monogram, click → dropdown menu of every dept entry page.
// Replaces <LeftRail /> globally per PBS directive 2026-05-08.
// Style follows EngineDashboard's logoMark spec (22×22, brass gradient).

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

interface MenuItem {
  href: string;
  label: string;
  hint?: string;
  group?: 'home' | 'pillars' | 'utility';
}

// 2026-05-08 PBS directive: Front Office, Knowledge, IT Cockpit removed
// from the global N menu. They live under the user dropdown's "Tools"
// section now. Settings stays here as a utility because it's also
// reachable from the user dropdown — keep one obvious entry.
const MENU: MenuItem[] = [
  { href: '/',           label: 'Home',       hint: 'Architect',                       group: 'home'    },
  { href: '/revenue',    label: 'Revenue',    hint: 'Pulse · Pace · Channels',         group: 'pillars' },
  { href: '/sales',      label: 'Sales',      hint: 'Inquiries · B2B · Bookings',      group: 'pillars' },
  { href: '/marketing',  label: 'Marketing',  hint: 'Reach · campaigns · social',      group: 'pillars' },
  { href: '/operations', label: 'Operations', hint: 'Today · F&B · Spa',               group: 'pillars' },
  { href: '/guest',      label: 'Guest',      hint: 'Directory · reviews · pre-arrival', group: 'pillars' },
  { href: '/finance',    label: 'Finance',    hint: 'P&L · cash · USALI',              group: 'pillars' },
  { href: '/it',         label: 'IT',         hint: 'Tickets · agents · deploys',      group: 'pillars' },
  { href: '/settings',   label: 'Settings',   hint: 'Property · users · agents',       group: 'utility' },
];

export default function NDropdown() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? '/';
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click + on navigation
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div ref={ref} style={{ position: 'fixed', top: 14, left: 14, zIndex: 1000 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open department menu"
        title="Departments"
        style={{
          width: 36, height: 36, borderRadius: 8,
          background: 'linear-gradient(135deg, #c79a6b, #b88556)',
          color: '#1a1a1a',
          fontSize: 17, fontWeight: 700,
          fontFamily: "'Cooper','Source Serif Pro',Georgia,serif",
          fontStyle: 'italic',
          border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: open ? '0 6px 20px rgba(199,154,107,0.45)' : '0 3px 10px rgba(0,0,0,0.4)',
          transition: 'box-shadow 0.18s ease',
        }}
      >
        N
      </button>

      {open && (
        <nav
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            width: 280,
            maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
            background: '#0e0e0c',
            border: '1px solid rgba(199,154,107,0.35)',
            borderRadius: 8,
            padding: 8,
            boxShadow: '0 16px 50px rgba(0,0,0,0.6)',
            color: 'var(--paper-deep)',
          }}
        >
          {(['home', 'pillars', 'utility'] as const).map((g, idx) => {
            const items = MENU.filter((m) => m.group === g);
            return (
              <div key={g}>
                {idx > 0 && (
                  <div style={{
                    height: 1,
                    background: 'rgba(199,154,107,0.18)',
                    margin: '6px 4px',
                  }} />
                )}
                {items.map((m) => {
                  const active = m.href === '/'
                    ? (pathname === '/' || pathname === '/overview')
                    : pathname.startsWith(m.href);
                  return (
                    <Link
                      key={m.href}
                      href={m.href}
                      style={{
                        display: 'block',
                        padding: '8px 10px',
                        borderRadius: 5,
                        textDecoration: 'none',
                        background: active ? 'rgba(199,154,107,0.10)' : 'transparent',
                        marginBottom: 2,
                      }}
                    >
                      <div style={{
                        fontFamily: "'Cooper','Source Serif Pro',Georgia,serif",
                        fontStyle: 'italic',
                        fontSize: 15,
                        color: active ? '#c79a6b' : 'var(--paper-deep)',
                        lineHeight: 1.2,
                      }}>
                        {m.label}
                      </div>
                      {m.hint && (
                        <div style={{
                          // PBS 2026-05-09 #25: brighter hint under dept names.
                          fontSize: 10,
                          color: '#a8854a',
                          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                          letterSpacing: '0.06em',
                          fontWeight: 600,
                          marginTop: 3,
                        }}>
                          {m.hint}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      )}
    </div>
  );
}
