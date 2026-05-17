// app/finance/acc/page.tsx — Finance · Acc hub
// PBS 2026-05-15: Acc consolidates Transactions + Banks + POS under one
// submenu button. The hub itself just lands the user on the Transactions
// tab; all 3 pages render the shared ACC_TABS strip at the top so the
// 3-tab UI is consistent regardless of entry point.
import { redirect } from 'next/navigation';

export default function FinanceAccPage() {
  redirect('/finance/transactions');
}
