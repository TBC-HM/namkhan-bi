// app/finance/hr/[staffId]/page.tsx
// PBS 2026-06-08 #135 — Staff detail belongs under HR (not Operations).
// Mirror of /operations/staff/[staffId]/page.tsx, but the Namkhan-canonical URL
// now lives inside the finance/hr tree so the HR sub-strip stays visible.
import { redirect } from 'next/navigation';
import StaffDetailContent from '@/app/operations/staff/_components/StaffDetailContent';
import { supabase } from '@/lib/supabase';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function StaffDetailHrPage({ params }: { params: { staffId: string } }) {
  // Same routing rule as the operations sibling: non-Namkhan staff redirect
  // to /h/[property_id]/finance/hr/[staffId] so the property theme + strip apply.
  const { data } = await supabase
    .from('v_staff_register_extended')
    .select('property_id')
    .eq('staff_id', params.staffId)
    .maybeSingle();

  const propertyId = Number((data as { property_id?: number } | null)?.property_id ?? NAMKHAN_PROPERTY_ID);

  if (Number.isFinite(propertyId) && propertyId !== NAMKHAN_PROPERTY_ID) {
    redirect(`/h/${propertyId}/finance/hr/${params.staffId}`);
  }

  return (
    <StaffDetailContent
      staffId={params.staffId}
      propertyId={NAMKHAN_PROPERTY_ID}
      propertyLabel="Namkhan"
    />
  );
}
