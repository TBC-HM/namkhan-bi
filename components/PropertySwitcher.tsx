// components/PropertySwitcher.tsx
// Top-header dropdown chip — switches active property.
// Place in the header utility row, before the weather/AQI chips.
// Routes under /h/[property_id]/ — /p/ is reserved for public proposal shares.

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCurrentProperty } from '@/lib/property-context';

type PropertyOption = {
  property_id: number;
  display_name: string;
};

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
    // Replace the /h/[old]/... segment with /h/[new]/...
    const newPath = pathname.replace(/^\/h\/\d+/, `/h/${id}`);
    router.push(newPath);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border border-[var(--sand,#B8A878)]/40 bg-[var(--bg,#F4EFE2)] text-[var(--primary,#1F3A2E)] hover:bg-[var(--primary,#1F3A2E)]/5 transition"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{propertyName}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[200px] rounded-lg border border-[var(--sand,#B8A878)]/40 bg-[var(--bg,#F4EFE2)] shadow-lg overflow-hidden z-50">
          {options.map((opt) => {
            const active = opt.property_id === propertyId;
            return (
              <button
                key={opt.property_id}
                onClick={() => switchTo(opt.property_id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition ${
                  active
                    ? 'bg-[var(--primary,#1F3A2E)]/10 text-[var(--primary,#1F3A2E)] font-medium'
                    : 'text-[var(--primary,#1F3A2E)] hover:bg-[var(--primary,#1F3A2E)]/5'
                }`}
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
