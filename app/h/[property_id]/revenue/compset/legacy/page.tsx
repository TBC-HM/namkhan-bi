// app/h/[property_id]/revenue/compset/legacy/page.tsx
// PBS 2026-07-08 Donna delegate — legacy URL preserved; redirects to canonical Donna target.
import { redirect, notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default function DonnaLegacyRedirect({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v) && v.length) qs.set(k, v[0]);
  }
  const tail = qs.toString();
  const base = `/h/${pid}/revenue/compset`;
  redirect(tail ? `${base}?${tail}` : base);
}
