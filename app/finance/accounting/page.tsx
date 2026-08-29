// app/finance/accounting/page.tsx — Namkhan-default stub.
// Real implementation lives at app/h/[property_id]/finance/accounting/.
// This route is loaded by legacy /finance/* links; redirect to Namkhan property.
import { PROPERTY_ID } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export default function FinanceAccountingDefault() {
  redirect(`/h/${PROPERTY_ID}/finance/accounting`);
}
