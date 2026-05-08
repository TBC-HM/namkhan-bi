// app/sample/layout.tsx
// Bare layout for the sample/exploration pages — no Banner/SubNav so the
// candidate templates render in their pure form. PBS picks one.
'use client';

import { usePathname } from 'next/navigation';

export default function SampleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  // Always bare for /sample/* — no chrome.
  void pathname;
  return <>{children}</>;
}
