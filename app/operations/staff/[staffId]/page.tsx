// app/operations/staff/[staffId]/page.tsx
// PBS 2026-05-13 — Namkhan-default route, BUT now looks up the staff
// record's property_id first. If the staff belongs to a non-Namkhan
// property (e.g. Donna), we redirect to /h/[property_id]/operations/staff/[staffId]
// so ThemeInjector applies the right theme (Donna cream, not Namkhan dark).
import { redirect } from 'next/navigation';
import StaffDetailContent from '../_components/StaffDetailContent';
import { supabase } from '@/lib/supabase';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export default async function StaffDetailPage({ params }: { params: { staffId: string } }) {
  // Look up the staff's property from the register view (single row).
  // If not Namkhan, redirect to the property-scoped /h/[id]/... path so
  // the theme + dept strip + subnav all flip to the correct property.
  const { data } = await supabase
    .from('v_staff_register_extended')
    .select('property_id')
    .eq('staff_id', params.staffId)
    .maybeSingle();

  const propertyId = Number((data as { property_id?: number } | null)?.property_id ?? NAMKHAN_PROPERTY_ID);

  if (Number.isFinite(propertyId) && propertyId !== NAMKHAN_PROPERTY_ID) {
    redirect(`/h/${propertyId}/operations/staff/${params.staffId}`);
  }

  return (
    <StaffDetailContent
      staffId={params.staffId}
      propertyId={NAMKHAN_PROPERTY_ID}
      propertyLabel="Namkhan"
    />
  );
}
