// app/h/[property_id]/finance/acc/page.tsx — property-scoped Acc hub
// PBS 2026-05-16: lands on Banks for Donna (only data we have) — Transactions/POS
// tabs in the strip still take the user to the per-property routes, even if those
// pages aren't seeded yet (catch-all stub renders until per-property data lands).
// Namkhan-default Acc lives at /finance/acc and redirects to /finance/transactions.
import { redirect } from 'next/navigation';

export default function PropertyFinanceAccPage({ params }: { params: { property_id: string } }) {
  redirect(`/h/${params.property_id}/finance/banks`);
}
