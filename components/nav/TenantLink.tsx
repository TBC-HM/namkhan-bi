// components/nav/TenantLink.tsx
// PBS 2026-07-08: drop-in replacement for `next/link` that preserves the tenant
// prefix (/h/{property_id}) on every internal navigation. Without this, hundreds
// of hardcoded `<Link href="/revenue/pulse">` etc. bump the operator from Donna
// (/h/1000001/...) back to the Namkhan default surface.
'use client';

import Link, { type LinkProps } from 'next/link';
import { usePathname } from 'next/navigation';
import type { AnchorHTMLAttributes, ReactNode } from 'react';

type TenantLinkProps = Omit<LinkProps, 'href'> &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps | 'href'> & {
    href: string;
    children?: ReactNode;
  };

function tenantPrefix(pathname: string | null): string {
  if (!pathname) return '';
  const m = pathname.match(/^\/h\/(\d+)/);
  return m ? m[0] : '';
}

function isHoldingPath(pathname: string | null): boolean {
  return !!pathname && (pathname === '/holding' || pathname.startsWith('/holding/'));
}

export function rewriteHref(pathname: string | null, href: string): string {
  if (!href || typeof href !== 'string') return href;
  if (/^(https?:|mailto:|tel:|#)/i.test(href)) return href;
  if (!href.startsWith('/')) return href;
  if (href.startsWith('/h/')) return href;
  // URL law (ADR-168): holding surfaces carry NO property segment. Prefixing
  // /holding/* with /h/{pid} lands in the catch-all as an unknown dept.
  // (it-area-reorg-v1 gap 2: HodLanding's chat CTA now targets /holding/it2/...)
  if (href === '/holding' || href.startsWith('/holding/')) return href;

  // HOLDING ↔ TENANT SEPARATION (PBS 2026-09-09).
  // On a holding page there is no tenant prefix to add, so a bare '/settings'
  // used to fall through unchanged — straight into the LEGACY unprefixed
  // settings tree, which is hardcoded to PROPERTY_ID 260955. The rail and the
  // user menu both emit '/settings', so "Settings" from any /holding/* page
  // silently landed the operator in Namkhan's settings. Holding has its own
  // settings surface; send them there.
  if (isHoldingPath(pathname) && (href === '/settings' || href.startsWith('/settings/'))) {
    const rest = href.slice('/settings'.length);
    if (PLATFORM_SETTINGS_PATHS.has(rest)) return href;   // not tenant data
    return HOLDING_SETTINGS_PATHS.has(rest) ? `/holding/settings${rest}` : '/holding/settings';
  }

  const prefix = tenantPrefix(pathname);
  if (!prefix) return href;
  return prefix + href;
}

// Sub-paths that exist under /holding/settings. Anything else collapses to the
// holding settings landing rather than leaking into a tenant's tree.
const HOLDING_SETTINGS_PATHS = new Set([
  '', '/guardrails', '/documents', '/media', '/integrations', '/links',
]);

// Paths under /settings that hold NO tenant data — they stay as they are from
// holding. /settings/notifications is a redirect stub to /cockpit.
const PLATFORM_SETTINGS_PATHS = new Set(['/notifications']);

export default function TenantLink({ href, children, ...rest }: TenantLinkProps) {
  const pathname = usePathname();
  const finalHref = rewriteHref(pathname, href);
  return (
    <Link href={finalHref} {...rest}>
      {children}
    </Link>
  );
}
