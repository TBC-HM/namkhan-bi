// app/revenue/page.tsx
// Redesign v2 (30 Apr 2026): bare /revenue redirects to /revenue/pulse — the new landing tab.
// Old Snapshot KPIs/cards folded into /revenue/pulse. Existing rail/topnav links continue to work via this redirect.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function RevenueIndexPage() {
  redirect('/revenue/pulse');
}
