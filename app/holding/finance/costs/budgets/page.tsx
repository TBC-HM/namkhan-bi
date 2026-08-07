// app/holding/finance/costs/budgets/page.tsx
// ADR-230 §3b redesign (brief cost-governance-v2, 2026-08-07): the F3 budget
// surface is now the Budgets subtab of the tabbed costs page — one cost surface,
// one budget surface. This route redirects to keep deep links working.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function CostsBudgetsRedirect() {
  redirect('/holding/finance/costs?tab=budgets');
}
