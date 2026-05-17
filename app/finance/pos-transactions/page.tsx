// app/finance/pos-transactions/page.tsx
// Deprecated 2026-05-15 — merged into the unified POS controller page.
// Redirects preserve the period query string so bookmarks still resolve.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LegacyPosTransactionsRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === 'string') qs.set(k, v);
    else if (Array.isArray(v) && v.length) qs.set(k, v[0]);
  }
  const tail = qs.toString();
  redirect(tail ? `/finance/pos?${tail}` : '/finance/pos');
}
