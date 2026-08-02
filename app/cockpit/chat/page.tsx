// app/cockpit/chat/page.tsx
// Legacy redirect stub — required by check-it2-orphans.mjs (all /cockpit/* must be stubs).
// Passes query params through to the live chat at /holding/chat.
// 2026-08-03: DeptEntry submitChat navigates here — redirected to /holding/chat.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function CockpitChatRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const params = new URLSearchParams();
  if (searchParams.q)     params.set('q',     searchParams.q);
  if (searchParams.dept)  params.set('dept',  searchParams.dept);
  if (searchParams.role)  params.set('role',  searchParams.role);
  if (searchParams.name)  params.set('name',  searchParams.name);
  if (searchParams.emoji) params.set('emoji', searchParams.emoji);
  if (searchParams.label) params.set('label', searchParams.label);
  redirect(`/holding/chat?${params.toString()}`);
}
