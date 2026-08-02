// app/cockpit/chat/page.tsx
// DeptEntry submitChat navigates here with ?q=...&dept=...&role=...
// Server-side redirect to the correct dept HoD page.
// 2026-08-03: restored after fleet/chat redirect broke the brain button.
// Uses searchParams prop (RSC) — no useSearchParams, no Suspense needed.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const DEPT_ROUTES: Record<string, string> = {
  sales:      '/sales',
  revenue:    '/revenue',
  marketing:  '/marketing',
  operations: '/operations',
  finance:    '/finance',
  legal:      '/holding/legal',
  it:         '/holding/it2',
  architect:  '/holding/ceo',
  lead:       '/holding/ceo',
  it_manager: '/holding/it2',
};

export default function CockpitChatRouter({
  searchParams,
}: {
  searchParams: { dept?: string; role?: string; q?: string };
}) {
  const dept = searchParams.dept ?? '';
  const role = searchParams.role ?? '';
  const target = DEPT_ROUTES[dept] ?? DEPT_ROUTES[role] ?? '/holding/ceo';
  redirect(target);
}
