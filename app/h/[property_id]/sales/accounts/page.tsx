// app/h/[property_id]/sales/accounts/page.tsx
// PBS 2026-07-11 pm — Property-scoped delegate for Sales · Accounts.

import AccountsPage from '@/app/sales/accounts/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DelegateSalesAccounts({ params }: { params: Promise<{ property_id: string }> }) {
  const { property_id } = await params;
  return <AccountsPage propertyId={Number(property_id)} />;
}
