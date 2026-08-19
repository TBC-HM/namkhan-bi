// app/marketing/seo/page.tsx
// Legacy Namkhan-only route — 307 to the tenant-scoped URL (rule 7).
// Full page now lives at app/h/[property_id]/marketing/seo/page.tsx
// (seo-donna-mirror-v1 A4). Preserves ?tab= and other query params.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LegacySeoRedirect({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams ?? {})) {
    if (typeof v === 'string') qs.set(k, v);
    else if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  redirect(`/h/260955/marketing/seo${suffix}`);
}
