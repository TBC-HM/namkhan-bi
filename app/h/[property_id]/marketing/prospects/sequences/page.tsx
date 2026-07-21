// app/h/[property_id]/marketing/prospects/sequences/page.tsx
// PBS 2026-07-21: page moved under Guest · Newsletters as a sub-tab.
// Preserves tenant scoping by redirecting to the same property's new URL.
import { redirect, notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  redirect(`/h/${pid}/guest/newsletters/sequences`);
}
