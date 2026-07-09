// app/holding/finance/invoices/page.tsx
// PBS 2026-07-09: page split into /create (generator) and /send-log (ledger).
// This route now redirects to /create so old bookmarks / links keep working.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HoldingInvoicesRedirect(): never {
  redirect('/holding/finance/invoices/create');
}
