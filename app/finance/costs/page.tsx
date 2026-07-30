// app/finance/costs/page.tsx
// Legacy unprefixed route — Namkhan-only 307 redirect (URL law, claude_md L6).
// Canonical page: /h/260955/finance/costs (Cost Governance Engine v1).
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LegacyFinanceCostsRedirect() {
  redirect('/h/260955/finance/costs');
}
