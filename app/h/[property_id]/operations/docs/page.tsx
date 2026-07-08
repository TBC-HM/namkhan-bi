// app/h/[property_id]/operations/docs/page.tsx
// PBS 2026-07-08 — Donna operations/docs delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaOperationsDocs({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Operations"
      routeLabel="Docs"
      namkhanPath="/operations/docs"
      hint="Will surface Donna operations SOPs · guides once document tagging includes Donna property scoping."
    />
  );
}
