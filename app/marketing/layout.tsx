// app/marketing/layout.tsx
// PBS 2026-05-09: pure passthrough + global AssetDetailDrawer.
'use client';

import AssetDetailDrawer from '@/components/marketing/AssetDetailDrawer';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AssetDetailDrawer />
    </>
  );
}
