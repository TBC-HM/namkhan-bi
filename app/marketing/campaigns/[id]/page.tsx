// app/marketing/campaigns/[id]/page.tsx
// Brand & Marketing · Campaign detail.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import { getCampaign, getCampaignAssets, CHANNEL_LABEL, STATUS_COLOR } from '@/lib/marketing';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

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

  return (
    <>
      <PanelHero
        eyebrow="Brand · Marketing · campaigns"
        title={campaign.name}
        emphasis=""
        sub={CHANNEL_LABEL[campaign.channel]}
        kpis={
          <>
            <KpiCard label="Status" value={sc.label} kind="text" hint={`channel · ${CHANNEL_LABEL[campaign.channel]}`} />
            <KpiCard label="Assets" value={slots.length} hint="in campaign" />
            <KpiCard label="Hashtags" value={(campaign.hashtags ?? []).length} hint="ready" />
            <KpiCard label="Created" value={new Date(campaign.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} kind="text" hint={new Date(campaign.created_at).toLocaleDateString('en-GB', { year: 'numeric' })} />
          </>
        }
      />

      <Card title="Brief" emphasis="& schedule" sub="" source="marketing.campaigns">
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink-mute)', marginBottom: 6 }}>brief</div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink)', lineHeight: 1.6 }}>{campaign.brief_text ?? '—'}</div>
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, fontSize: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 4 }}>scheduled</div>
            <div>{campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString('en-GB') : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 4 }}>published</div>
            <div>{campaign.published_at ? new Date(campaign.published_at).toLocaleString('en-GB') : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 4 }}>vibes</div>
            <div>{(campaign.vibe_tags ?? []).join(', ') || '—'}</div>
          </div>
        </div>
      </Card>

      <Card title="Assets" emphasis="in this campaign" sub={`${slots.length} slot${slots.length === 1 ? '' : 's'}`} source="marketing.campaign_assets" className="mt-22">
        {slots.length === 0 ? (
          <div className="stub" style={{ padding: 24 }}>No assets yet.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {slots.map(s => {
              const a: any = assetMap.get(s.asset_id);
              const thumb = publicRenderUrl(a?.renders?.thumbnail) ?? publicRenderUrl(a?.renders?.web_2k);
              return (
                <div key={s.slot_order} style={{ background: 'var(--paper)', border: '1px solid var(--line)', overflow: 'hidden' }}>
                  <div style={{ aspectRatio: '4 / 3', background: 'var(--ink)', position: 'relative' }}>
                    {thumb
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={thumb} alt={s.alt_text_per_slot ?? a?.alt_text ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#888', fontFamily: 'var(--mono)', fontSize: 10 }}>—</div>
                    }
                    <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.7)', color: '#fff', fontFamily: 'var(--mono)', fontSize: 10, padding: '2px 6px' }}>slot {s.slot_order}</div>
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink)' }}>{s.caption_per_slot ?? a?.caption ?? '—'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Caption" emphasis="& hashtags" sub="" source="marketing.campaigns" className="mt-22">
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6 }}>caption</div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--ink)' }}>
          {campaign.caption ?? '—'}
        </div>
        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', textTransform: 'uppercase', color: 'var(--ink-mute)', marginTop: 14, marginBottom: 6 }}>hashtags ({(campaign.hashtags ?? []).length})</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)' }}>
          {(campaign.hashtags ?? []).map(h => `#${h}`).join('  ')}
        </div>
      </Card>

      <div style={{ marginTop: 22, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href="/marketing/campaigns" className="btn" style={{ fontSize: 11, textDecoration: 'none' }}>← all campaigns</Link>
        <button className="btn" style={{ fontSize: 11 }}>edit</button>
        <button className="btn" style={{ fontSize: 11 }}>duplicate</button>
        <button className="btn" style={{ fontSize: 11, marginLeft: 'auto', color: 'var(--oxblood)' }}>archive</button>
      </div>
    </>
  );
}
