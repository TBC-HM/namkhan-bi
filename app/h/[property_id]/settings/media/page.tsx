// app/h/[property_id]/settings/media/page.tsx
// PBS 2026-07-18 · Media settings promoted to sibling top-level tab
// (Property · Media · Guardrails · Send Logs). Consolidates: MediaQaPanel
// (naming rules + re-score) + PhotoGuardrailsPanel (7 rule datasets:
// naming_conventions, caption_rules, alt_text_rules, tier_thresholds,
// aspect_ratio_rules, text_policy, brand_palette). Data loads server-side
// from the same public.v_media_* views the /marketing/media page uses.
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import MediaQaPanel from '@/components/settings/panels/MediaQaPanel';
import PhotoGuardrailsPanel from '@/app/marketing/media/_client/PhotoGuardrailsPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadGuardrails() {
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
    naming: naming.data ?? [],
    captions: captions.data ?? [],
    altText: altText.data ?? [],
    tierThresholds: tiers.data ?? [],
    aspectRatios: ratios.data ?? [],
    textPolicy: textPolicy.data ?? null,
    brandPalette: palette.data ?? [],
  };
}

export default async function MediaSettingsPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  const guardrails = await loadGuardrails();
  return (
    <DashboardPage
      title="Settings · Media"
      subtitle={`Naming rules · guardrails · aspect ratios · brand palette · property ${propertyId}`}
      tabs={[
        { key: 'property',   label: 'Property',   href: `/h/${propertyId}/settings/property`   },
        { key: 'media',      label: 'Media',      href: `/h/${propertyId}/settings/media`, active: true },
        { key: 'guardrails', label: 'Guardrails', href: `/h/${propertyId}/settings/guardrails` },
        { key: 'send_logs',  label: 'Send Logs',  href: `/h/${propertyId}/settings/send-logs`  },
      ]}
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Container title="Media QA" subtitle="naming convention rules · scoring · backfill re-score">
          <div style={{ padding: 16 }}>
            <MediaQaPanel propertyId={propertyId} />
          </div>
        </Container>
        <Container title="Photo Guardrails" subtitle="captions · alt-text · tiers · aspect ratios · text policy · brand palette">
          <div style={{ padding: 16 }}>
            <PhotoGuardrailsPanel propertyId={propertyId} guardrails={guardrails as any} />
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}