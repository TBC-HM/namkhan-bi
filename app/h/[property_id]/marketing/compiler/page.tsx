// app/h/[property_id]/marketing/compiler/page.tsx
// PBS 2026-07-08 — Donna marketing/compiler delegate.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaMarketingCompiler({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Marketing"
      routeLabel="Compiler"
      namkhanPath="/marketing/compiler"
      hint="Will surface Donna Lock & Distribute compilation once Donna marketing assets are eligible."
    />
  );
}
