// app/h/[property_id]/operations/sops/[sop_code]/edit/page.tsx
// PBS 2026-08-20 · Donna tenant stub (retry after 409 branch race).
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyIdOperationsSopsSopCodeEdit({ params }: { params: { property_id: string; sop_code: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Operations"
      routeLabel={`SOP · ${params.sop_code} · Edit`}
      namkhanPath={`/operations/sops/${params.sop_code}/edit`}
      hint="SOP editor — Donna SOPs land when knowledge.sop_content adds Donna-scoped rows."
    />
  );
}
