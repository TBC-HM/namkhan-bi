// app/h/[property_id]/revenue/channel/page.tsx
// Singular slug retired on 2026-05-21 — merged into plural /channels.
// Property-scoped redirect preserves any saved links.

import { redirect } from 'next/navigation';

export default function PropertyChannelRedirect({
  params,
}: {
  params: { property_id: string };
}) {
  redirect(`/h/${params.property_id}/revenue/channels`);
}
