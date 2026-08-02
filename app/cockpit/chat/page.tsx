'use client';
// app/cockpit/chat/page.tsx
// DeptEntry submitChat navigates here with ?q=...&dept=...&role=...
// Redirects to the correct dept landing page where ChatShell is already embedded.
// The "ONE chat" per-dept lives on the dept HoD page itself.
// 2026-08-03: restored after fleet/chat redirect broke the brain button.

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const DEPT_ROUTES: Record<string, string> = {
  sales:      '/sales',
  revenue:    '/revenue',
  marketing:  '/marketing',
  operations: '/operations',
  finance:    '/finance',
  legal:      '/holding/legal',
  it:         '/holding/it2',
  architect:  '/holding/ceo',
  // Holding-level roles fall back to IT2
  lead:       '/holding/it2',
  it_manager: '/holding/it2',
};

export const dynamic = 'force-dynamic';

export default function CockpitChatRouter() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const dept = params.get('dept') ?? '';
    const role = params.get('role') ?? '';
    const target = DEPT_ROUTES[dept] ?? DEPT_ROUTES[role] ?? '/holding/ceo';
    router.replace(target);
  }, [router, params]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui', color: '#5A5A5A', fontSize: 13 }}>
      Opening chat…
    </div>
  );
}
