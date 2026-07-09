// app/holding/page.tsx
// PBS 2026-07-09 pm: /holding is now a redirect to /holding/ceo — the
// CEO landing IS the Beyond Circle landing. Prior DeptEntry surface removed;
// same content still reachable per dept slot in the top strip and via /holding/ceo.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function HoldingHome() {
  redirect('/holding/ceo');
}
