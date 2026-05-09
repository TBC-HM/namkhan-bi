// app/guest/layout.tsx
// PBS 2026-05-09: layout chrome stripped. `.panel` retained for max-width
// centring while pages migrate to <Page>.
'use client';

import { usePathname } from 'next/navigation';

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  if (pathname === '/guest' || pathname === '/guest/') return <>{children}</>;
  return <div className="panel">{children}</div>;
}
