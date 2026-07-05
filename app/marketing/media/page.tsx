// app/marketing/media/page.tsx
// PBS 2026-07-05 v2: Media Library — new-design shell (DashboardPage + KPI + gallery).
// Force-rebuild marker: MEDIA_V2_20260705_1200

import Link from 'next/link';
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import MediaGallery from './_components/MediaGallery';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface MediaRow {
  asset_id: string;
  asset_type: string;
  original_filename: string;
  caption: string | null;
  primary_tier: string | null;
  property_area: string | null;
  captured_at: string | null;
  qc_score: number | null;
  public_url: string | null;
  width_px: number | null;
  height_px: number | null;
}

export default async function MarketingMediaPage() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('v_marketing_media_page').select('*').limit(500);
  const rows: MediaRow[] = (data as MediaRow[]) ?? [];

  const photos = rows.filter(r => r.asset_type === 'photo');
  const videos = rows.filter(r => r.asset_type === 'video');
  const tiers = new Set(rows.map(r => r.primary_tier).filter((v): v is string => !!v));
  const areas = new Set(rows.map(r => r.property_area).filter((v): v is string => !!v));
  const withUrl = rows.filter(r => r.public_url).length;
  const avgQc = rows.length ? (rows.reduce((s,r) => s + (r.qc_score ?? 0), 0) / rows.length).toFixed(1) : '—';

  const tiles: KpiTileProps[] = [
    { label: 'Total assets',    value: rows.length,   size: 'sm', footnote: 'in media library' },
    { label: 'Photos',          value: photos.length, size: 'sm' },
    { label: 'Videos',          value: videos.length, size: 'sm' },
    { label: 'With public URL', value: withUrl,       size: 'sm', footnote: 'usable in newsletters' },
    { label: 'Tiers',           value: tiers.size,    size: 'sm', footnote: 'quality bands' },
    { label: 'Areas',           value: areas.size,    size: 'sm', footnote: 'property zones' },
    { label: 'Avg QC score',    value: avgQc,         size: 'sm', footnote: '/100' },
  ];

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/media',
  }));

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }} data-page="MEDIA_V2_20260705">
      <DashboardPage
        title="Marketing · Media Library (new)"
        subtitle={`${rows.length.toLocaleString()} asset${rows.length===1?'':'s'} · ${error ? 'ERROR: ' + error.message : 'click any photo to copy its URL for a newsletter'}`}
        tabs={tabs}
      >
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        <div style={{ gridColumn: '1 / -1', display:'flex', justifyContent:'flex-end', gap: 8 }}>
          <Link href="/marketing/upload" style={{
            padding:'6px 14px', fontSize:12, fontWeight:600, background:'#084838', color:'#FFFFFF',
            border:'none', borderRadius:4, textDecoration:'none',
          }}>+ Upload new</Link>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <MediaGallery rows={rows} />
        </div>
      </DashboardPage>
    </div>
  );
}
