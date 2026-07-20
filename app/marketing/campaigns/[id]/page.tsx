// app/marketing/campaigns/[id]/page.tsx
// PBS 2026-07-21: Migrated from PanelHero + Card + KpiCard shell to
// DashboardPage + KpiTile (design v6/v7). Paper white + hairlines + hardcoded
// tokens (Namkhan var(--paper-warm) resolves to dark — burn ref: memory).
// Preserves: campaign fetch, asset thumbnails, brief/schedule/caption/hashtags.

import type { CSSProperties } from 'react';
import TenantLink from '@/components/nav/TenantLink';
import { notFound } from 'next/navigation';
import {
  DashboardPage, KpiTile,
  type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { getCampaign, getCampaignAssets, CHANNEL_LABEL, STATUS_COLOR } from '@/lib/marketing';
import { supabase } from '@/lib/supabase';
import { MARKETING_SUBPAGES } from '../../_subpages';

export const dynamic = 'force-dynamic';

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const INK_L = '#8A8A8A';
const CREAM = '#F5F0E1';
const FOREST= '#084838';
const OXBLD = '#B04A2F';

function publicRenderUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/public/media-renders/${path}`;
}

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const [campaign, slots] = await Promise.all([
    getCampaign(params.id),
    getCampaignAssets(params.id),
  ]);

  if (!campaign) notFound();

  // Fetch each asset for thumbnails
  const assetIds = slots.map(s => s.asset_id);
  const assetsRes = assetIds.length > 0
    ? await supabase
        .schema('marketing')
        .from('v_media_ready')
        .select('asset_id, caption, alt_text, renders, primary_tier, captured_at')
        .in('asset_id', assetIds)
    : { data: [] };
  const assetMap = new Map((assetsRes.data ?? []).map((a: any) => [a.asset_id, a]));

  const sc = STATUS_COLOR[campaign.status];

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s: any) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/campaigns',
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Status',   value: sc.label,                                                     size: 'sm', footnote: `channel · ${CHANNEL_LABEL[campaign.channel]}` },
    { label: 'Assets',   value: slots.length,                                                 size: 'sm', footnote: 'in campaign' },
    { label: 'Hashtags', value: (campaign.hashtags ?? []).length,                             size: 'sm', footnote: 'ready' },
    { label: 'Created',  value: new Date(campaign.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      size: 'sm', footnote: new Date(campaign.created_at).toLocaleDateString('en-GB', { year: 'numeric' }) },
  ];

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title={campaign.name}
        subtitle={CHANNEL_LABEL[campaign.channel]}
        tabs={tabs}
      >
        {/* KPI strip */}
        <div style={{ ...fullRow, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* Brief + schedule */}
        <div style={{ ...fullRow, ...cardBox }}>
          <div style={sectionHeader}>Brief · marketing.campaigns</div>
          <div style={eyebrow}>brief</div>
          <div style={briefText}>{campaign.brief_text ?? '—'}</div>
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 12 }}>
            <div>
              <div style={eyebrow}>scheduled</div>
              <div style={{ color: INK }}>{campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString('en-GB') : '—'}</div>
            </div>
            <div>
              <div style={eyebrow}>published</div>
              <div style={{ color: INK }}>{campaign.published_at ? new Date(campaign.published_at).toLocaleString('en-GB') : '—'}</div>
            </div>
            <div>
              <div style={eyebrow}>vibes</div>
              <div style={{ color: INK }}>{(campaign.vibe_tags ?? []).join(', ') || '—'}</div>
            </div>
          </div>
        </div>

        {/* Assets grid */}
        <div style={{ ...fullRow, ...cardBox }}>
          <div style={sectionHeader}>Assets · {slots.length} slot{slots.length === 1 ? '' : 's'} · marketing.campaign_assets</div>
          {slots.length === 0 ? (
            <div style={{ padding: 24, fontSize: 12, color: INK_M, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4 }}>
              No assets yet.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {slots.map(s => {
                const a: any = assetMap.get(s.asset_id);
                const thumb = publicRenderUrl(a?.renders?.thumbnail) ?? publicRenderUrl(a?.renders?.web_2k);
                return (
                  <div key={s.slot_order} style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ aspectRatio: '4 / 3', background: '#1a1a1a', position: 'relative' }}>
                      {thumb
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={thumb} alt={s.alt_text_per_slot ?? a?.alt_text ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#888', fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11 }}>—</div>
                      }
                      <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.7)', color: WHITE, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 10, padding: '2px 6px', borderRadius: 3 }}>slot {s.slot_order}</div>
                    </div>
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{ fontSize: 12, color: INK, lineHeight: 1.4 }}>{s.caption_per_slot ?? a?.caption ?? '—'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Caption + hashtags */}
        <div style={{ ...fullRow, ...cardBox }}>
          <div style={sectionHeader}>Caption &amp; hashtags · marketing.campaigns</div>
          <div style={eyebrow}>caption</div>
          <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.6, color: INK }}>
            {campaign.caption ?? '—'}
          </div>
          <div style={{ ...eyebrow, marginTop: 14 }}>hashtags ({(campaign.hashtags ?? []).length})</div>
          <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12, color: INK, wordSpacing: 4 }}>
            {(campaign.hashtags ?? []).map(h => `#${h}`).join('  ')}
          </div>
        </div>

        {/* Actions row */}
        <div style={{ ...fullRow, display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          <TenantLink href="/marketing/campaigns" style={btnSecondary}>← all campaigns</TenantLink>
          <button style={btnSecondary}>edit</button>
          <button style={btnSecondary}>duplicate</button>
          <button style={{ ...btnSecondary, marginLeft: 'auto', color: OXBLD, borderColor: HAIR }}>archive</button>
        </div>
      </DashboardPage>
    </div>
  );
}

const fullRow: CSSProperties = { gridColumn: '1 / -1' };
const cardBox: CSSProperties = {
  background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4,
  padding: '14px 16px',
};
const sectionHeader: CSSProperties = {
  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: INK_M, fontWeight: 700, marginBottom: 10,
};
const eyebrow: CSSProperties = {
  fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: INK_L, fontWeight: 600, marginBottom: 4,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
};
const briefText: CSSProperties = {
  fontSize: 14, color: INK, lineHeight: 1.6,
};
const btnSecondary: CSSProperties = {
  padding: '6px 12px', fontSize: 12, fontWeight: 500,
  background: WHITE, color: INK, border: '1px solid ' + HAIR, borderRadius: 4,
  textDecoration: 'none', display: 'inline-block', cursor: 'pointer',
  fontFamily: 'inherit',
};
