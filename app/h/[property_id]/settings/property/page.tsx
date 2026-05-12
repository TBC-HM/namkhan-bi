// app/p/[property_id]/settings/property/page.tsx
// Property Settings — now under /p/[property_id]/... routing.
// Property comes from the URL, not a hardcoded constant.
// ADR-021 + ADR-024.

import { createClient } from '@/lib/supabase/server';
import PropertySettingsClient from '@/components/settings/PropertySettingsClient';
import Page from '@/components/page/Page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getPropertyData(propertyId: number) {
  const supabase = createClient();

  const [
    identity, location, brand, policies,
    rooms, facilities, activities, seasons, certifications, contacts, social,
  ] = await Promise.all([
    supabase.schema('property').from('identity').select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.schema('property').from('location').select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.schema('property').from('brand').select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.schema('property').from('policies').select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.schema('property').from('rooms').select('*').eq('property_id', propertyId).order('room_type_id'),
    supabase.schema('property').from('facilities').select('*').eq('property_id', propertyId).order('category').order('name'),
    supabase.schema('property').from('activities').select('*').eq('property_id', propertyId).order('display_order').order('name'),
    supabase.schema('property').from('seasons').select('*').eq('property_id', propertyId).order('date_start'),
    supabase.schema('property').from('certifications').select('*').eq('property_id', propertyId).order('certification_name'),
    supabase.schema('property').from('contacts').select('*').eq('property_id', propertyId).order('purpose'),
    supabase.schema('property').from('social').select('*').eq('property_id', propertyId).order('platform'),
  ]);

  return {
    identity: identity.data,
    location: location.data,
    brand: brand.data,
    policies: policies.data,
    rooms: rooms.data ?? [],
    facilities: facilities.data ?? [],
    activities: activities.data ?? [],
    seasons: seasons.data ?? [],
    certifications: certifications.data ?? [],
    contacts: contacts.data ?? [],
    social: social.data ?? [],
  };
}

export default async function PropertySettingsPage({
  params,
}: {
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);
  const data = await getPropertyData(propertyId);

  return (
    <Page
      eyebrow="Settings · Property"
      title={<>{data.identity?.trading_name ?? 'Property'} <em style={{ color: 'var(--brass)' }}>Settings</em></>}
    >
      <div style={{ padding: '0 0 16px 0', fontSize: 12, color: 'var(--ink-soft)' }}>
        {data.identity?.legal_name}
        {data.identity?.star_rating && ` · ${'★'.repeat(data.identity.star_rating)}`}
        {data.location?.city && ` · ${data.location.city}, ${data.location.country}`}
        {` · Property ID: ${propertyId}`}
      </div>
      <PropertySettingsClient data={data} propertyId={propertyId} />
    </Page>
  );
}
