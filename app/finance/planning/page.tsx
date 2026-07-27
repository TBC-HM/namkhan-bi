// app/finance/planning/page.tsx
// Legacy unprefixed route — Namkhan-only 307 redirect (URL law, claude_md §0.7).
// Canonical page: /h/260955/finance/planning (FP&C module v1).
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LegacyFinancePlanningRedirect() {
  redirect('/h/260955/finance/planning');
}
