// app/h/[property_id]/guest/newsletters/templates/[key]/page.tsx
// PBS 2026-08-20 · Donna tenant stub (retry after 409 branch race).
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PropertyIdGuestNewslettersTemplatesKey({ params }: { params: { property_id: string; key: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Guest"
      routeLabel={`Newsletter Template · ${params.key}`}
      namkhanPath={`/guest/newsletters/templates/${params.key}`}
      hint="Individual template editor — Donna template edits wire once tenant-scoped brand_kit is present."
    />
  );
}
