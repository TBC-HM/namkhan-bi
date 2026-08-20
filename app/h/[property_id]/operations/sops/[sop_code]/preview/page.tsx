// app/h/[property_id]/operations/sops/[sop_code]/preview/page.tsx
// PBS 2026-08-20 · Donna tenant stub (retry after 409 branch race).
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyIdOperationsSopsSopCodePreview({ params }: { params: { property_id: string; sop_code: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Operations"
      routeLabel={`SOP · ${params.sop_code} · Preview`}
      namkhanPath={`/operations/sops/${params.sop_code}/preview`}
      hint="SOP preview — activates once Donna knowledge.sop_content is seeded."
    />
  );
}
