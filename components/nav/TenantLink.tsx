// components/nav/TenantLink.tsx
// PBS 2026-07-08: drop-in replacement for `next/link` that preserves the tenant
// prefix (/h/{property_id}) on every internal navigation. Without this, hundreds
// of hardcoded `<Link href="/revenue/pulse">` etc. bump the operator from Donna
// (/h/1000001/...) back to the Namkhan default surface. PBS's own words:
//   "I permanently jump from Donna into Namkhan when I am in Namkhan I must stay
//    there and vice versa this is chaotic - all urls should have property id"
//
// Behaviour:
//   1. If the current pathname has `/h/{id}/...` AND the target href starts with
//      "/" AND does NOT already start with "/h/", rewrite to `${prefix}${href}`.
//   2. Otherwise the href is left unchanged.
//   3. External protocols (http/https/mailto/tel) and hash-only hrefs pass through
//      untouched so button-style Links keep working.
//
// Same public API as next/link Link → callers can swap the import path.
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

export function rewriteHref(pathname: string | null, href: string): string {
  if (!href || typeof href !== 'string') return href;
  // external / non-path hrefs → passthrough
  if (/^(https?:|mailto:|tel:|#)/i.test(href)) return href;
  if (!href.startsWith('/')) return href;
  if (href.startsWith('/h/')) return href;              // already prefixed
  const prefix = tenantPrefix(pathname);
  if (!prefix) return href;                             // unprefixed context → no rewrite
  return prefix + href;
}

export default function TenantLink({ href, children, ...rest }: TenantLinkProps) {
  const pathname = usePathname();
  const finalHref = rewriteHref(pathname, href);
  return (
    <Link href={finalHref} {...rest}>
      {children}
    </Link>
  );
}
