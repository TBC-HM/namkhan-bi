// app/h/[property_id]/settings/property/page.tsx
// PBS 2026-07-18 v3 · adds spa_treatments + fnb_menus (+ items) fetches; rooms ORDER BY display_order.
// PBS 2026-07-20 · Rate Plans moved to its own top-level Settings sub-page —
// ratePlans fetch removed here + rate_plans tab inserted between Media and Guardrails.
// PBS 2026-07-22 · Newsletter tab restored between Rate Plans and Guardrails (mirrors
//                  the restored /h/[pid]/settings/property/audience page tabs strip).
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
    retreats, spaTreatments, fnbMenus, fnbMenuItems, teamFeatures,
  ] = await Promise.all([
    supabase.schema('property').from('identity').select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.schema('property').from('location').select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.schema('property').from('brand').select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.schema('property').from('brand_reality').select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.schema('property').from('policies').select('*').eq('property_id', propertyId).maybeSingle(),
    // PBS 2026-07-18 · rooms in curated order (tents → art → suites → villas)
    supabase.schema('property').from('rooms').select('*').eq('property_id', propertyId)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('room_type_id'),
    supabase.schema('property').from('facilities').select('*').eq('property_id', propertyId).order('category').order('name'),
    supabase.schema('property').from('activities').select('*').eq('property_id', propertyId).order('display_order').order('name'),
    supabase.schema('property').from('seasons').select('*').eq('property_id', propertyId).order('date_start'),
    supabase.schema('property').from('certifications').select('*').eq('property_id', propertyId).order('certification_name'),
    supabase.schema('property').from('contacts').select('*').eq('property_id', propertyId).order('purpose'),
    supabase.schema('property').from('social').select('*').eq('property_id', propertyId).order('platform'),
    supabase.from('v_team_directory')
      .select('staff_id, emp_id, full_name, dept_code, dept_name, position_title, notes, skills, phone, email, primary_language, english_proficiency, hire_date, tenure_years, employment_type')
      .eq('property_id', propertyId)
      .order('dept_name', { ascending: true, nullsFirst: false })
      .order('full_name', { ascending: true }),
    supabase.schema('property').from('owner_entity').select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.from('v_room_type_units').select('room_type_name, units').eq('property_id', propertyId),
    supabase.schema('property').from('transport_options').select('*').eq('property_id', propertyId).order('display_order', { ascending: true, nullsFirst: false }).order('name'),
    supabase.schema('property').from('boats').select('*').eq('property_id', propertyId).order('name'),
    supabase.schema('property').from('boat_cruises').select('*').eq('property_id', propertyId).order('display_order', { ascending: true, nullsFirst: false }).order('name'),
    supabase.schema('property').from('facilities').select('*').eq('property_id', propertyId).eq('is_meeting_space', true).order('name'),
    supabase.from('v_property_retreats').select('*').eq('property_id', propertyId).eq('is_active', true).order('retreat_id'),
    // PBS 2026-07-18 v2 · spa treatments + fnb menus/items via public bridge views.
    supabase.from('v_property_spa_treatments').select('*').eq('property_id', propertyId).order('display_order', { ascending: true, nullsFirst: false }).order('name'),
    supabase.from('v_property_fnb_menus').select('*').eq('property_id', propertyId).order('display_order', { ascending: true, nullsFirst: false }).order('name'),
    supabase.from('v_property_fnb_menu_items').select('*').eq('property_id', propertyId).order('display_order', { ascending: true, nullsFirst: false }).order('name'),
    supabase.from('v_property_team_features').select('*').eq('property_id', propertyId).order('display_order', { ascending: true, nullsFirst: false }).order('full_name'),
  ]);

  // Merge fnb items into their menus
  const fnbMenusRaw = (fnbMenus.data ?? []) as any[];
  const fnbItemsRaw = (fnbMenuItems.data ?? []) as any[];
  const fnbMenusWithItems = fnbMenusRaw.map(m => ({
    ...m,
    items: fnbItemsRaw.filter(it => it.menu_id === m.menu_id),
  }));

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
    spaTreatments: spaTreatments.data ?? [],
    fnbMenus: fnbMenusWithItems,
    teamFeatures: teamFeatures.data ?? [],
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
        { key: 'rate_plans', label: 'Rate Plans', href: `/h/${propertyId}/settings/rate-plans` },
        { key: 'audience',   label: 'Newsletter', href: `/h/${propertyId}/settings/property/audience` },
        { key: 'guardrails', label: 'Guardrails', href: `/h/${propertyId}/settings/guardrails` },
        { key: 'data',       label: 'Data',       href: `/h/${propertyId}/settings/data` },
        { key: 'brain',      label: 'Brain',      href: `/h/${propertyId}/settings/brain` },
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
