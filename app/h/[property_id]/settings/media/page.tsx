// app/h/[property_id]/settings/media/page.tsx
// PBS 2026-07-18 v2 · full PhotoGuardrailsPanel port with server-side fetch of
// all 7 guardrail datasets (naming/captions/altText/tiers/ratios/textPolicy/palette).
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import MediaQaPanel from '@/components/settings/panels/MediaQaPanel';
import PhotoGuardrailsPanel from '@/app/marketing/media/_client/PhotoGuardrailsPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getGuardrails() {
  const sb = getSupabaseAdmin();
  const [naming, captions, altText, tiers, ratios, textPolicy, palette] = await Promise.all([
    sb.from('v_media_naming_conventions').select('*'),
    sb.from('v_media_caption_rules').select('*'),
    sb.from('v_media_alt_text_rules').select('*'),
    sb.from('v_media_tier_thresholds').select('*'),
    sb.from('v_media_aspect_ratio_rules').select('*'),
    sb.from('v_media_text_policy').select('*').eq('id', 1).maybeSingle(),
    sb.from('v_media_brand_palette').select('*'),
  ]);
  return {
    naming: (naming.data ?? []) as any[],
    captions: (captions.data ?? []) as any[],
    altText: (altText.data ?? []) as any[],
    tierThresholds: (tiers.data ?? []) as any[],
    aspectRatios: (ratios.data ?? []) as any[],
    textPolicy: (textPolicy.data ?? null) as any,
    brandPalette: (palette.data ?? []) as any[],
  };
}

export default async function MediaSettingsPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  const g = await getGuardrails();
  return (
    <DashboardPage
      title="Settings · Media"
      subtitle={`Naming rules · scoring · photo guardrails · property ${propertyId}`}
      tabs={[
        { key: 'property',   label: 'Property',   href: `/h/${propertyId}/settings/property`   },
        { key: 'media',      label: 'Media',      href: `/h/${propertyId}/settings/media`, active: true },
        { key: 'guardrails', label: 'Guardrails', href: `/h/${propertyId}/settings/guardrails` },
        { key: 'data',       label: 'Data',       href: `/h/${propertyId}/settings/data` },
        { key: 'send_logs',  label: 'Send Logs',  href: `/h/${propertyId}/settings/send-logs`  },
      ]}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Media QA" subtitle="naming convention rules · scoring · backfill re-score">
          <div style={{ padding: 16 }}>
            <MediaQaPanel propertyId={propertyId} />
          </div>
        </Container>
      </div>
      <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
        <Container title="Photo Guardrails" subtitle="captions · alt-text · tiers · aspect ratios · text policy · brand palette">
          <PhotoGuardrailsPanel
            propertyId={propertyId}
            naming={g.naming as any}
            captions={g.captions as any}
            altText={g.altText as any}
            tierThresholds={g.tierThresholds as any}
            aspectRatios={g.aspectRatios as any}
            textPolicy={g.textPolicy as any}
            brandPalette={g.brandPalette as any}
          />
        </Container>
      </div>
    </DashboardPage>
  );
}
