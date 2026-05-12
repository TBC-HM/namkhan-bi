// app/settings/property/page.tsx
// Property Settings — master configuration page
// 11 tabs, one per property.* table
// ADR-021 + stopgap multi-property via ?property= query param.
// Full /p/[property_id]/... routing comes in next iteration.

import { createClient } from '@/lib/supabase/server';
import PropertySettingsClient from '@/components/settings/PropertySettingsClient';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN_PROPERTY_ID = 260955;
const DONNA_PROPERTY_ID   = 1000001;
const KNOWN_PROPERTIES    = [NAMKHAN_PROPERTY_ID, DONNA_PROPERTY_ID];

async function getPropertyData(propertyId: number) {
  const supabase = createClient();

  const [
    identity,
    location,
    brand,
    policies,
    rooms,
    facilities,
    activities,
    seasons,
    certifications,
    contacts,
    social,
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

function propertyLabel(id: number): string {
  if (id === NAMKHAN_PROPERTY_ID) return 'The Namkhan';
  if (id === DONNA_PROPERTY_ID)   return 'Donna Portals';
  return `Property ${id}`;
}

export default async function PropertySettingsPage({
  searchParams,
}: {
  searchParams?: { property?: string };
}) {
  const requested = Number(searchParams?.property);
  const propertyId = KNOWN_PROPERTIES.includes(requested) ? requested : NAMKHAN_PROPERTY_ID;

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
                {data.identity?.trading_name ?? propertyLabel(propertyId)} Settings
              </h1>
              <p className="text-sm text-[var(--primary,#1F3A2E)]/60 mt-1">
                {data.identity?.legal_name}
                {data.identity?.star_rating && ` · ${'★'.repeat(data.identity.star_rating)}`}
                {data.location?.city && ` · ${data.location.city}, ${data.location.country}`}
              </p>
            </div>
            <div className="text-right space-y-2">
              {/* Property switcher (stopgap until /p/[property_id]/... routing) */}
              <div className="flex gap-2 justify-end">
                {KNOWN_PROPERTIES.map((id) => {
                  const active = id === propertyId;
                  return (
                    <Link
                      key={id}
                      href={`/settings/property?property=${id}`}
                      prefetch={false}
                      className={
                        active
                          ? 'px-3 py-1 rounded-full text-xs font-medium bg-[var(--primary,#1F3A2E)] text-white'
                          : 'px-3 py-1 rounded-full text-xs font-medium bg-[var(--primary,#1F3A2E)]/10 text-[var(--primary,#1F3A2E)] hover:bg-[var(--primary,#1F3A2E)]/20 transition'
                      }
                    >
                      {propertyLabel(id)}
                    </Link>
                  );
                })}
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[var(--primary,#1F3A2E)]/5 text-[var(--primary,#1F3A2E)]/70">
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
