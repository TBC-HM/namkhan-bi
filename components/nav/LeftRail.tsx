'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

/* ── icons (inline SVG to avoid extra deps) ─────────────────── */
function HomeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <polyline points="9 21 9 12 15 12 15 21" />
    </svg>
  );
}

/* ── rail item styles ────────────────────────────────────────── */
const railItem =
  'flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[11px] font-medium transition-colors';
const activeClass = 'bg-brand-primary/10 text-brand-primary';
const inactiveClass = 'text-slate-500 hover:text-slate-800 hover:bg-slate-100';

/* ── top-level nav sections ─────────────────────────────────── */
const NAV_SECTIONS = [
  { label: 'Revenue', href: '/revenue', abbr: 'Rev' },
  { label: 'Finance', href: '/finance', abbr: 'Fin' },
  { label: 'Guest', href: '/guest', abbr: 'Gst' },
  { label: 'Ops', href: '/ops', abbr: 'Ops' },
  { label: 'Sales', href: '/sales', abbr: 'Sal' },
  { label: 'People', href: '/people', abbr: 'Ppl' },
  { label: 'Sustain', href: '/sustain', abbr: 'Sus' },
];

export default function LeftRail() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav
      className="fixed left-0 top-0 z-40 flex h-full w-[68px] flex-col items-center border-r border-slate-200 bg-white py-3 shadow-sm"
      aria-label="Primary navigation"
    >
      {/* ── N (Namkhan) dropdown trigger ─────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary text-white text-sm font-bold shadow hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        aria-label="Namkhan menu"
        aria-expanded={open}
      >
        N
      </button>

      {/* ── Namkhan dropdown panel ───────────────────────────── */}
      {open && (
        <div className="absolute left-[72px] top-2 z-50 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Namkhan BI
          </p>
          <Link
            href="/cockpit"
            onClick={() => setOpen(false)}
            className="block rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            🛠 Cockpit
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            ⚙️ Settings
          </Link>
        </div>
      )}

      {/* ── HOME link ────────────────────────────────────────── */}
      <Link
        href="/"
        className={`${railItem} ${pathname === '/' ? activeClass : inactiveClass} w-full`}
        aria-label="Home"
        title="Home"
      >
        <HomeIcon />
        <span>Home</span>
      </Link>

      {/* ── divider ──────────────────────────────────────────── */}
      <div className="my-1 w-10 border-t border-slate-200" />

      {/* ── ND section (department links) ────────────────────── */}
      <div className="flex flex-1 flex-col items-center gap-0.5 overflow-y-auto w-full px-1">
        {NAV_SECTIONS.map((s) => {
          const isActive = pathname.startsWith(s.href);
          return (
            <Link
              key={s.href}
              href={s.href}
              className={`${railItem} ${isActive ? activeClass : inactiveClass} w-full`}
              title={s.label}
            >
              <span className="text-[13px] font-semibold">{s.abbr}</span>
              <span>{s.label}</span>
            </Link>
          );
        })}
      </div>

      {/* ── bottom: cockpit shortcut ─────────────────────────── */}
      <div className="mt-auto pt-2 w-full px-1">
        <div className="w-full border-t border-slate-200 mb-2" />
        <Link
          href="/cockpit"
          className={`${railItem} ${pathname.startsWith('/cockpit') ? activeClass : inactiveClass} w-full`}
          title="Cockpit"
        >
          <span className="text-[13px]">🛠</span>
          <span>Cockpit</span>
        </Link>
      </div>
    </nav>
  );
}
