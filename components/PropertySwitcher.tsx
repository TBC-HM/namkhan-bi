// components/PropertySwitcher.tsx
// Top-header dropdown chip — switches active property.
// Place in the header utility row, before the weather/AQI chips.
// Routes under /h/[property_id]/ — /p/ is reserved for public proposal shares.
//
// PBS Apple note #31 (2026-05-13): adds the Holding option (The Beyond
// Circle / Felix). When property_id === 0 the switcher routes to
// /holding (separate scope, not /h/0/...) so the page tree, palette,
// and Felix landing are clearly distinct from the per-property views.

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCurrentProperty } from '@/lib/property-context';

type PropertyOption = {
  property_id: number;
  display_name: string;
};

// Holding sentinel id — chosen so it can never collide with a real
// Cloudbeds property_id (always positive) or a new-tenant id (>= 1000001).
export const HOLDING_PROPERTY_ID = 0;

export default function PropertySwitcher({
  options,
}: {
  options: PropertyOption[];
}) {
  const { propertyId, propertyName } = useCurrentProperty();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function switchTo(id: number) {
    setOpen(false);
    if (id === propertyId) return;
    // Holding scope lives at /holding (Felix landing). Per-property
    // scopes live under /h/[id]/...
    if (id === HOLDING_PROPERTY_ID) {
      // Drop the dept tail when entering holding — the landing has its
      // own structure and the dept routes only exist per-property.
      document.cookie = `tbc.active_property=${HOLDING_PROPERTY_ID}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`;
      router.push('/holding');
      return;
    }
    document.cookie = `tbc.active_property=${id}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`;
    // Replace the /h/[old]/... segment with /h/[new]/...; if we came
    // from /holding (no /h/ prefix), land on the property home.
    const newPath = pathname.startsWith('/h/')
      ? pathname.replace(/^\/h\/\d+/, `/h/${id}`)
      : `/h/${id}`;
    router.push(newPath);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full font-medium transition"
        style={{
          fontSize: 'var(--t-sm)',
          border: '1px solid var(--border)',
          background: 'var(--card)',
          color: 'var(--ink)',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{propertyName}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 min-w-[200px] rounded-lg shadow-lg overflow-hidden z-50"
          style={{
            border: '1px solid var(--border)',
            background: 'var(--card)',
          }}
        >
          {options.map((opt) => {
            const active = opt.property_id === propertyId;
            return (
              <button
                key={opt.property_id}
                onClick={() => switchTo(opt.property_id)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left transition"
                style={{
                  fontSize: 'var(--t-sm)',
                  background: active ? 'var(--paper-deep)' : 'transparent',
                  color: active ? 'var(--brass)' : 'var(--ink)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span>{opt.display_name}</span>
                {active && (
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                    <path d="M3.5 8L7 11.5L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
