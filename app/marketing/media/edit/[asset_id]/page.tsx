// app/marketing/media/edit/[asset_id]/page.tsx
// PBS 2026-07-12 — Server-rendered fallback for direct URL access to an
// asset's edit drawer (deep link). Loads the asset + renders <AssetEditPageClient/>
// inside DashboardPage — the client component reuses AssetEditDrawer's internals.
import { notFound } from 'next/navigation';
import { DashboardPage } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import AssetEditPageClient from '../../_client/AssetEditPageClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  params: { asset_id: string };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AssetEditPage({ params }: Props) {
  const asset_id = params.asset_id;
  if (!asset_id || !UUID_RE.test(asset_id)) notFound();

  const sb = getSupabaseAdmin();
  const [assetRes, areasRes] = await Promise.all([
    sb.from('v_marketing_media_page').select('*').eq('asset_id', asset_id).maybeSingle(),
    sb.from('v_marketing_media_page')
      .select('property_area')
      .not('property_area', 'is', null)
      .limit(500),
  ]);

  if (assetRes.error || !assetRes.data) notFound();

  const areaSet = new Set<string>();
  for (const row of (areasRes.data ?? [])) {
    const v = (row as any).property_area;
    if (v && typeof v === 'string') areaSet.add(v);
  }
  const areaOptions = Array.from(areaSet).sort((a, b) => a.localeCompare(b));

  const asset = assetRes.data as any;

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage
        title="Edit asset"
        subtitle={asset.original_filename ?? asset.asset_id}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <AssetEditPageClient asset={asset} areaOptions={areaOptions} />
        </div>
      </DashboardPage>
    </div>
  );
}
