// app/sales/layout.tsx
// PBS 2026-05-09: layout chrome (Banner/SubNav/FilterStrip) removed; the
// <Page> shell on each route owns the visible frame. We keep `.panel` only
// to preserve max-width centering for legacy pages that haven't been
// migrated to <Page> yet — `.panel` adds padding + max-width but no colour.
'use client';

import { usePathname } from 'next/navigation';

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  if (pathname === '/sales' || pathname === '/sales/') return <>{children}</>;
  return <div className="panel">{children}</div>;
}
