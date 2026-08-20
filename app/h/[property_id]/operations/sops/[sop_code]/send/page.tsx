// app/h/[property_id]/operations/sops/[sop_code]/send/page.tsx
// PBS 2026-08-20 · Donna SOP send stub.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaSopSend({ params }: { params: { property_id: string; sop_code: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Operations"
      routeLabel={`SOP · ${params.sop_code} · Send`}
      namkhanPath={`/operations/sops/${params.sop_code}/send`}
      hint="SOP send-to-team — Donna recipient list activates via emp.employees tenant slice."
    />
  );
}
