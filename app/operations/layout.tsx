// app/operations/layout.tsx
// PBS 2026-05-09: layout chrome stripped. `.panel` retained for max-width
// centring while pages migrate to <Page>.
'use client';

import { usePathname } from 'next/navigation';

export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  if (pathname === '/operations' || pathname === '/operations/') return <>{children}</>;
  return <div className="panel">{children}</div>;
}
