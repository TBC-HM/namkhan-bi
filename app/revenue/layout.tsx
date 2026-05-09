// app/revenue/layout.tsx
// PBS 2026-05-09: layout chrome stripped. <Page> shell owns colour/border/
// title/footer. We retain `.panel` only for max-width centring so legacy
// pages (still on <PageHeader>) don't render edge-to-edge while we migrate.
'use client';

import { usePathname } from 'next/navigation';

export default function RevenueLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  if (pathname === '/revenue' || pathname === '/revenue/') return <>{children}</>;
  return <div className="panel">{children}</div>;
}
