'use client';

// components/PropertyThemeWatcher.tsx
//
// PBS 2026-05-15 — fix for the "page flashes white/wrong-color before
// settling" bug. Root cause: /holding/layout sets
// `<html data-property="holding">` for Beyond Circle theming via a one-shot
// inline script. App-Router SPA navigations don't re-run that script, so
// when a user navigates back into /h/260955 or /h/1000001 the attribute
// stays 'holding' and the BC peach palette wins via specificity until
// ThemeInjector's :root vars take over → visible color flash.
//
// This component watches pathname changes and writes the correct
// data-property value on every navigation, before paint completes.
//
// Mount once in app/layout.tsx. Costs nothing on routes that already have
// the right value (we no-op when current === desired).

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function inferPropertyFromPath(pathname: string): string {
  // Beyond Circle / holding
  if (pathname === '/holding' || pathname.startsWith('/holding/')) return 'holding';
  if (pathname === '/tbc'     || pathname.startsWith('/tbc/'))     return 'holding';
  // Property-scoped routes
  if (pathname.startsWith('/h/1000001')) return 'donna';
  if (pathname.startsWith('/h/260955'))  return 'namkhan';
  // Other property IDs land here in the future; default to namkhan-dark.
  if (pathname.startsWith('/h/'))        return 'namkhan';
  // Legacy global routes (/finance, /operations, /revenue, /sales, etc.)
  // are all Namkhan today. Default everything else to namkhan so the dark
  // canvas wins instead of a stale holding attribute leaking through.
  return 'namkhan';
}

export default function PropertyThemeWatcher() {
  const pathname = usePathname();

  useEffect(() => {
    const desired = inferPropertyFromPath(pathname);
    const current = document.documentElement.getAttribute('data-property');
    if (current !== desired) {
      document.documentElement.setAttribute('data-property', desired);
    }
  }, [pathname]);

  return null;
}
