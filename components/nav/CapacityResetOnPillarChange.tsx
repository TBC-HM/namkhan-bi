'use client';

// components/nav/CapacityResetOnPillarChange.tsx
// Watches pathname; when the user crosses a pillar boundary (e.g. /revenue/* → /operations/*)
// it strips ?cap= from the URL so the next pillar starts at the default ('selling').
// URL-only — does NOT touch localStorage.
//
// Mounted once in app/layout.tsx, runs on every navigation.
// Specified in docs/handoffs/COWORK_HANDOFF_2026-05-01.md.

import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

// First path segment after the leading slash defines the pillar.
// '/' (overview) and '/overview' are treated as one pillar; everything else is its segment 0.
function pillarOf(pathname: string): string {
  if (!pathname || pathname === '/') return 'home';
  // /front-office/arrivals → 'front-office'
  // /revenue/pulse → 'revenue'
  // /operations/today → 'operations'
  const seg = pathname.split('/').filter(Boolean)[0] ?? 'home';
  // Aliases that fold into the same pillar (per LeftRail matches)
  if (['today', 'departments', 'actions'].includes(seg)) return 'operations';
  if (seg === 'overview') return 'home';
  return seg;
}

export default function CapacityResetOnPillarChange() {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const lastPillar = useRef<string | null>(null);

  useEffect(() => {
    const currentPillar = pillarOf(pathname);
    const prev = lastPillar.current;

    // First mount — record and skip.
    if (prev === null) {
      lastPillar.current = currentPillar;
      return;
    }

    if (prev !== currentPillar) {
      // Pillar changed; if ?cap= is set, drop it.
      const cap = search.get('cap');
      if (cap) {
        const p = new URLSearchParams(search.toString());
        p.delete('cap');
        const qs = p.toString();
        const next = qs ? `${pathname}?${qs}` : pathname;
        router.replace(next);
      }
      lastPillar.current = currentPillar;
    }
  }, [pathname, search, router]);

  return null;
}
