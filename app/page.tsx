// app/page.tsx
// PBS 2026-07-14: post-login default landing.
// Was rendering DeptEntry (the "Ask Felix" legacy cockpit — black bg,
// primitive tiles). PBS wants the modern Beyond Circle CEO landing here.
// Per-user override lives in tenancy.holding_users.landing_page and is
// honoured by the sign-in flow (see /api/auth/post-login) — this page is
// only reached when a signed-in user lands on '/' directly (deep-link,
// bookmark, top-nav logo click).
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function Home() {
  redirect('/holding/ceo');
}
