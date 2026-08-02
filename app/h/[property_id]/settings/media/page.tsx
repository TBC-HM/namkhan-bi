// app/h/[property_id]/settings/media/page.tsx
// PBS 2026-08-02 — All photo settings consolidated here.
// Imports SettingsTab directly from marketing/media/_client so the component
// is NOT duplicated — same code, rendered in property settings context.
// Marketing/media > Photo Settings tab to be redirected here in follow-up.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import MediaQaPanel from '@/components/settings/panels/MediaQaPanel';
import SettingsTab from '@/app/marketing/media/_client/SettingsTab';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function fetchAllSettingsData(propertyId: number) {
  const sb = getSupabaseAdmin();
  const [
    naming, captions, altText, tiers, ratios, textPolicy, palette,
    channelSpecs, rulesActive, reality, categories, rooms, facilities,
  ] = await Promise.all([
    // Photo guardrails (already in this page)
    sb.from('v_media_naming_conventions').select('*'),
    sb.from('v_media_caption_rules').select('*'),
    sb.from('v_media_alt_text_rules').select('*'),
    sb.from('v_media_tier_thresholds').select('*'),
    sb.from('v_media_aspect_ratio_rules').select('*'),
    sb.from('v_media_text_policy').select('*').eq('id', 1).maybeSingle(),
    sb.from('v_media_brand_palette').select('*'),
    // Photo settings (new — feeds SettingsTab)
    sb.from('v_media_channel_specs').select('*'),
    sb.from('v_media_rules_active').select('*'),
    sb.from('v_reality_profile').select('*').eq('property_id', propertyId).maybeSingle(),
    sb.from('v_ai_prompt_categories').select('*').eq('property_id', propertyId),
    sb.from('v_room_grounding').select('*').eq('property_id', propertyId).order('room_type_id', { ascending: true }),
    sb.from('v_facility_grounding').select('*').eq('property_id', propertyId).eq('active', true).order('sort_order', { ascending: true }),
  ]);

  return {
    guardrails: {
      naming:          (naming.data ?? []) as any[],
      captions:        (captions.data ?? []) as any[],
      altText:         (altText.data ?? []) as any[],
      tierThresholds:  (tiers.data ?? []) as any[],
      aspectRatios:    (ratios.data ?? []) as any[],
      textPolicy:      (textPolicy.data ?? null) as any,
      brandPalette:    (palette.data ?? []) as any[],
    },
    channelSpecs:  (channelSpecs.data ?? []) as any[],
    rulesActive:   (rulesActive.data ?? []) as any[],
    reality:       (reality.data ?? null) as any,
    categories:    (categories.data ?? []) as any[],
    rooms:         (rooms.data ?? []) as any[],
    facilities:    (facilities.data ?? []) as any[],
  };
}

export default async function MediaSettingsPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  const d = await fetchAllSettingsData(propertyId);

  const TABS = [
    { key: 'property',   label: 'Property',   href: `/h/${propertyId}/settings/property`   },
    { key: 'media',      label: 'Media',      href: `/h/${propertyId}/settings/media`, active: true },
    { key: 'rate_plans', label: 'Rate Plans', href: `/h/${propertyId}/settings/rate-plans` },
    { key: 'guardrails', label: 'Guardrails', href: `/h/${propertyId}/settings/guardrails` },
    { key: 'data',       label: 'Data',       href: `/h/${propertyId}/settings/data` },
    { key: 'brain',      label: 'Brain',      href: `/h/${propertyId}/settings/brain` },
    { key: 'send_logs',  label: 'Send Logs',  href: `/h/${propertyId}/settings/send-logs`  },
    { key: 'knowledge',  label: 'Knowledge',  href: `/h/${propertyId}/settings/knowledge` },
  ];

  return (
    <DashboardPage
      title="Settings · Media"
      subtitle={`Photo settings · naming rules · scoring · guardrails · channels · AI profiles · property ${propertyId}`}
      tabs={TABS}
    >
      {/* Media QA — backfill re-score + naming conventions */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Media QA" subtitle="naming convention rules · scoring · backfill re-score">
          <div style={{ padding: 16 }}>
            <MediaQaPanel propertyId={propertyId} />
          </div>
        </Container>
      </div>

      {/* Photo Settings — full 6-tab panel (Link Photos · Guardrails · Output Channels · AI Profiles · Photo Guardrails · Prompt Categories) */}
      <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
        <Container
          title="Photo Settings"
          subtitle="Link photos · guardrails · output channels · AI profiles · photo guardrails · prompt categories — same content as Marketing › Media › Photo Settings"
        >
          <SettingsTab
            propertyId={propertyId}
            channelSpecs={d.channelSpecs}
            rulesActive={d.rulesActive}
            reality={d.reality}
            categories={d.categories}
            rooms={d.rooms}
            facilities={d.facilities}
            mediaPage={[]}
            guardrails={d.guardrails}
          />
        </Container>
      </div>
    </DashboardPage>
  );
}
