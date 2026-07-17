// app/h/[property_id]/settings/property/page.tsx
// PBS #160 (2026-05-24): paper-white DashboardPage chrome to match the rest
// of the cockpit. Tab content still rendered by PropertySettingsClient.
//
// 2026-07-07 (PBS): sticky-strip tabs added so operators can flip between
// Property and Guardrails inside the property-scoped settings shell.
//
// 2026-07-15 (item 4): Team tab is now a read-only mirror of HR. Fetch from
// public.v_team_directory (bridge over v_staff_register_extended + hr.employees).
// Old source tenancy.property_users retained no longer — HR is source of truth.

import { createClient } from '@/lib/supabase/server';
import PropertySettingsClient from '@/components/settings/PropertySettingsClient';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getPropertyData(propertyId: number) {
  const supabase = createClient();
  const [
    identity, location, brand, brandReality, policies,
    rooms, facilities, activities, seasons, certifications, contacts, social,
    team, owner, roomUnits, transport, boats, boatCruises, meetingSpaces,
    retreats,
  ] = await Promise.all([
    supabase.schema('property').from('identity').select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.schema('property').from('location').select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.schema('property').from('brand').select('*').eq('property_id', propertyId).maybeSingle(),
    // 2026-07-13: single source of truth for AI/reality grounding — moved from media.reality_profile
    supabase.schema('property').from('brand_reality').select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.schema('property').from('policies').select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.schema('property').from('rooms').select('*').eq('property_id', propertyId).order('room_type_id'),
    supabase.schema('property').from('facilities').select('*').eq('property_id', propertyId).order('category').order('name'),
    supabase.schema('property').from('activities').select('*').eq('property_id', propertyId).order('display_order').order('name'),
    supabase.schema('property').from('seasons').select('*').eq('property_id', propertyId).order('date_start'),
    supabase.schema('property').from('certifications').select('*').eq('property_id', propertyId).order('certification_name'),
    supabase.schema('property').from('contacts').select('*').eq('property_id', propertyId).order('purpose'),
    supabase.schema('property').from('social').select('*').eq('property_id', propertyId).order('platform'),
    // PBS 2026-07-15 (item 4): Team panel now READS from HR (source of truth).
    // Bridge view scoped by property_id. No salary, no writes.
    supabase
      .from('v_team_directory')
      .select('staff_id, emp_id, full_name, dept_code, dept_name, position_title, notes, skills, phone, email, primary_language, english_proficiency, hire_date, tenure_years, employment_type')
      .eq('property_id', propertyId)
      .order('dept_name', { ascending: true, nullsFirst: false })
      .order('full_name', { ascending: true }),
    // PBS 2026-07-03: owner entity (Namkhan Group Ltd etc.)
    supabase.schema('property').from('owner_entity').select('*').eq('property_id', propertyId).maybeSingle(),
    // PBS 2026-07-03: unit counts for the Rooms tab — public view over PMS silver.
    supabase.from('v_room_type_units').select('room_type_name, units').eq('property_id', propertyId),
    supabase.schema('property').from('transport_options').select('*').eq('property_id', propertyId).order('display_order', { ascending: true, nullsFirst: false }).order('name'),
    supabase.schema('property').from('boats').select('*').eq('property_id', propertyId).order('name'),
    supabase.schema('property').from('boat_cruises').select('*').eq('property_id', propertyId).order('display_order', { ascending: true, nullsFirst: false }).order('name'),
    supabase.schema('property').from('facilities').select('*').eq('property_id', propertyId).eq('is_meeting_space', true).order('name'),
    // PBS 2026-07-18 · retreats via public.v_property_retreats (bridge over
    // content.retreat_programs + retreat_pricing). 3 programs · 2 tiers each.
    supabase.from('v_property_retreats').select('*').eq('property_id', propertyId).eq('is_active', true).order('retreat_id'),
  ]);

  return {
    identity: identity.data,
    location: location.data,
    brand: brand.data,
    brandReality: brandReality.data,
    policies: policies.data,
    rooms: rooms.data ?? [],
    facilities: facilities.data ?? [],
    activities: activities.data ?? [],
    seasons: seasons.data ?? [],
    certifications: certifications.data ?? [],
    contacts: contacts.data ?? [],
    social: social.data ?? [],
    team: team.data ?? [],
    owner: owner.data,
    roomUnits: (roomUnits.data ?? []) as Array<{ room_type_name: string; units: number }>,
    transport: transport.data ?? [],
    boats: boats.data ?? [],
    boatCruises: boatCruises.data ?? [],
    meetingSpaces: meetingSpaces.data ?? [],
    retreats: retreats.data ?? [],
  };
}

export default async function PropertySettingsPage({
  params,
}: {
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);
  const data = await getPropertyData(propertyId);

  const subtitleParts = [
    data.identity?.legal_name,
    data.identity?.star_rating ? '★'.repeat(data.identity.star_rating) : null,
    data.location?.city && data.location?.country ? `${data.location.city}, ${data.location.country}` : null,
    `Property ID ${propertyId}`,
  ].filter(Boolean).join(' · ');

  const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };

  return (
    <DashboardPage
      title={`Settings · ${data.identity?.trading_name ?? 'Property'}`}
      subtitle={subtitleParts}
      tabs={[
        { key: 'property',   label: 'Property',   href: `/h/${propertyId}/settings/property`,   active: true },
        { key: 'media',      label: 'Media',      href: `/h/${propertyId}/settings/media` },
        { key: 'guardrails', label: 'Guardrails', href: `/h/${propertyId}/settings/guardrails` },
        { key: 'data',       label: 'Data',       href: `/h/${propertyId}/settings/data` },
        { key: 'send_logs',  label: 'Send Logs',  href: `/h/${propertyId}/settings/send-logs`  },
      ]}
    >
      <div style={fullRow}>
        <Container title="Property" subtitle="identity · brand · rooms · facilities · activities · seasons · team">
          <PropertySettingsClient data={data} propertyId={propertyId} />
        </Container>
      </div>
    </DashboardPage>
  );
}