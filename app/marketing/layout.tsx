// app/marketing/layout.tsx
// PBS 2026-05-09: pure passthrough — <Page> shell owns chrome on every page.
// AssetDetailDrawer was hooked from this layout but is a global drawer; keep
// it mounted so deep links open without a layout wrapper.
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
