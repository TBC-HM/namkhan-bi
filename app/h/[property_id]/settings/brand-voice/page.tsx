// app/h/[property_id]/settings/brand-voice/page.tsx
// PBS 2026-09-14: Brand Voice settings — editable banned_phrases, tone_dos, tone_donts
// backed by property.brand_reality via fn_update_brand_voice.
// Agents pick these up dynamically from v_reality_profile on every run.

import { DashboardPage } from '@/app/(cockpit)/_design';
import { getSettingsTabs } from '@/lib/property-settings-tabs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import BrandVoiceClient from './_components/BrandVoiceClient';

export const dynamic = 'force-dynamic';

export default async function BrandVoicePage({
  params,
}: {
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);
  const sb = getSupabaseAdmin();

  const { data } = await sb
    .from('v_reality_profile')
    .select('banned_phrases, tone_dos, tone_donts')
    .eq('property_id', propertyId)
    .maybeSingle();

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Settings · Brand Voice"
        tabs={getSettingsTabs(propertyId, 'brand_voice')}
      >
        <div style={{ gridColumn: '1 / -1', maxWidth: 680 }}>
          <p style={{ fontSize: 13, color: 'var(--tbl-fg-mute, #666)', marginBottom: 28, lineHeight: 1.5 }}>
            These lists are the single editable source of truth for brand voice constraints.
            Every content agent reads them on each run — no code deploy needed when you change them here.
          </p>
          <BrandVoiceClient
            propertyId={propertyId}
            initialBannedPhrases={data?.banned_phrases ?? []}
            initialToneDos={data?.tone_dos ?? []}
            initialToneDonts={data?.tone_donts ?? []}
          />
        </div>
      </DashboardPage>
    </div>
  );
}
