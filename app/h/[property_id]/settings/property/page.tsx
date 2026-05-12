// app/p/[property_id]/settings/property/page.tsx
// Property Settings — now under /p/[property_id]/... routing.
// Property comes from the URL, not a hardcoded constant.
// ADR-021 + ADR-024.

import { createClient } from '@/lib/supabase/server';
import PropertySettingsClient from '@/components/settings/PropertySettingsClient';

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
    <div className="min-h-screen bg-[var(--bg,#F4EFE2)]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <header className="mb-8 pb-6 border-b border-[var(--sand,#B8A878)]/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--sand,#B8A878)] font-medium mb-2">
                Settings · Property
              </p>
              <h1 className="text-3xl font-serif text-[var(--primary,#1F3A2E)]">
                {data.identity?.trading_name ?? 'Property'} Settings
              </h1>
              <p className="text-sm text-[var(--primary,#1F3A2E)]/60 mt-1">
                {data.identity?.legal_name}
                {data.identity?.star_rating && ` · ${'★'.repeat(data.identity.star_rating)}`}
                {data.location?.city && ` · ${data.location.city}, ${data.location.country}`}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[var(--primary,#1F3A2E)]/10 text-[var(--primary,#1F3A2E)]">
                Property ID: {propertyId}
              </span>
            </div>
          </div>
        </header>

        <PropertySettingsClient data={data} propertyId={propertyId} />
      </div>
    </div>
  );
}
