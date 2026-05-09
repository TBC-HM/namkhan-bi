// app/marketing/layout.tsx
// PBS 2026-05-09: layout chrome stripped. <Page> shell on each route owns the
// frame. `.panel` retained for max-width centring of legacy pages that still
// render via <PageHeader>. Global AssetDetailDrawer kept mounted.
'use client';

import { usePathname } from 'next/navigation';
import AssetDetailDrawer from '@/components/marketing/AssetDetailDrawer';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  if (pathname === '/marketing' || pathname === '/marketing/') {
    return <>{children}<AssetDetailDrawer /></>;
  }
  return (
    <>
      <div className="panel">{children}</div>
      <AssetDetailDrawer />
    </>
  );
}
