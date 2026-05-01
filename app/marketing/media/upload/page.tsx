// app/marketing/media/upload/page.tsx
// Marketing · Media · Upload — owner-gated drag-drop ingestion.
//
// Flow per file:
//   1. Compute SHA256 in browser
//   2. POST /api/media/sign-upload  → { upload_url, asset_id }
//   3. PUT file to upload_url (Supabase signed URL)
//   4. POST /api/media/finalize    → triggers media-ingest Edge Function
//   5. Render result (ingested · duplicate · failed)

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import { getCurrentUser } from '@/lib/currentUser';
import { supabase } from '@/lib/supabase';
import UploadDropzone from './UploadDropzone';

export const dynamic = 'force-dynamic';

async function getStats() {
  const [tax, byTier] = await Promise.all([
    supabase.schema('marketing').from('media_taxonomy').select('tag_id', { count: 'exact', head: true }),
    supabase.schema('marketing').from('v_media_by_tier').select('*'),
  ]);
  const tagCount = tax.count ?? 0;
  const tierRows: Array<{ primary_tier: string | null; total: number }> = (byTier.data as any) ?? [];
  const totalReady = tierRows.reduce((s, r) => s + Number(r.total ?? 0), 0);
  return { tagCount, totalReady, tierRows };
}

export default async function MediaUploadPage() {
  const user = await getCurrentUser();
  const allowed = user.role === 'owner' || user.role === 'gm';

  if (!allowed) {
    return (
      <Card title="Restricted area" sub="Owner / GM only">
        <div className="stub" style={{ padding: 32 }}>
          <h3>Upload is gated to top-level roles</h3>
          <p>You are signed in as {user.display_name} ({user.role}). Ask Paul or a GM to upload media.</p>
        </div>
      </Card>
    );
  }

  const { tagCount, totalReady, tierRows } = await getStats();
  const otaCount = tierRows.find(r => r.primary_tier === 'tier_ota_profile')?.total ?? 0;
  const heroCount = tierRows.find(r => r.primary_tier === 'tier_website_hero')?.total ?? 0;
  const socialCount = tierRows.find(r => r.primary_tier === 'tier_social_pool')?.total ?? 0;

  return (
    <>
      <PanelHero
        eyebrow="Media · upload"
        title="Drop"
        emphasis="zone"
        sub="Photos · auto-tagged via controlled vocabulary · auto-tiered"
        kpis={
          <>
            <KpiCard label="Library" value={totalReady} hint="ready assets" />
            <KpiCard label="OTA profile" value={otaCount} hint="tier 1" />
            <KpiCard label="Website hero" value={heroCount} hint="tier 2" />
            <KpiCard label="Social pool" value={socialCount} hint="tier 3" />
          </>
        }
      />

      <Card title="Drag & drop" emphasis="photos" sub="JPG · PNG · HEIC · WebP · DNG · CR2 · NEF · ARW · max 500 MB each" source="POST /api/media">
        <UploadDropzone />
      </Card>

      <Card title="Taxonomy" emphasis="vocabulary" sub={`${tagCount} controlled tags · 12 categories`} className="mt-22">
        <div style={{ padding: '16px 4px', fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.6 }}>
          Each upload is matched against the Namkhan controlled vocabulary by Claude Vision.
          AI may return up to 3 free-text keywords if no taxonomy match exists; these surface in
          <code style={{ background: 'var(--paper)', padding: '1px 4px', margin: '0 2px' }}>marketing.media_keywords_free</code>
          for promotion to the taxonomy by an owner.
        </div>
      </Card>
    </>
  );
}
