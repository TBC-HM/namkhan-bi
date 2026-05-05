'use client';

// components/nav/ConditionalShell.tsx
// Wraps the app shell. On public retreat pages (/r/*) we render the children
// without the dashboard rail/banner so the marketing funnel reads as a
// stand-alone site. Everything else gets the BI portal shell.

import { usePathname } from 'next/navigation';
import LeftRail from './LeftRail';

export default function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const isPublicFunnel = pathname.startsWith('/r/');

  if (isPublicFunnel) {
    return <div className="public-funnel-wrapper">{children}</div>;
  }

  return (
    <div className="shell">
      <LeftRail />
      <div className="main">{children}</div>
    </div>
  );
}
