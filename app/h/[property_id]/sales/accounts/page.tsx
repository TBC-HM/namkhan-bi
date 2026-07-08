// app/h/[property_id]/sales/accounts/page.tsx
// PBS 2026-07-08 — Donna sales/accounts delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaSalesAccounts({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Sales"
      routeLabel="Accounts"
      namkhanPath="/sales/accounts"
      hint="Will surface Donna B2B account contracts (DMC · OTA · Wholesale) once contracts are Donna-scoped."
    />
  );
}
