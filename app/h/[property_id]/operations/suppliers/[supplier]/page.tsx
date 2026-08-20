// app/h/[property_id]/operations/suppliers/[supplier]/page.tsx
// PBS 2026-08-20 · Donna tenant stub (retry after 409 branch race).
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyIdOperationsSuppliersSupplier({ params }: { params: { property_id: string; supplier: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Operations"
      routeLabel={`Supplier · ${params.supplier}`}
      namkhanPath={`/operations/suppliers/${params.supplier}`}
      hint="Supplier detail — Donna suppliers land via procurement.suppliers.property_id filter once seeded."
    />
  );
}
