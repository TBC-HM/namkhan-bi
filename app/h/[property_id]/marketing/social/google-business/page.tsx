// app/h/[property_id]/marketing/social/google-business/page.tsx
// PBS 2026-08-20 · Donna tenant stub for Google Business Profile.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaSocialGoogleBusiness({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Marketing"
      routeLabel="Social · Google Business Profile"
      namkhanPath="/marketing/social/google-business"
      hint="Google Business Profile — Donna wiring blocked on allowlist case 7-4375000040952 and Donna OAuth pending."
    />
  );
}
