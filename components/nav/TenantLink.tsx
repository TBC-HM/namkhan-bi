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

export function rewriteHref(pathname: string | null, href: string): string {
  if (!href || typeof href !== 'string') return href;
  if (/^(https?:|mailto:|tel:|#)/i.test(href)) return href;
  if (!href.startsWith('/')) return href;
  if (href.startsWith('/h/')) return href;
  const prefix = tenantPrefix(pathname);
  if (!prefix) return href;
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
