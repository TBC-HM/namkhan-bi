// app/marketing/media/page.tsx
// Marketing · Media library — pipeline view + legacy Drive links.
//
// Top: Phase 1 ingest pipeline (marketing.v_media_ready)
// Bottom: legacy marketing.media_links Drive folders (kept for backward compat)

import Link from 'next/link';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import { getMediaLinks, getMediaReady, getMediaTierCounts } from '@/lib/marketing';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const TIER_LABEL: Record<string, string> = {
  tier_ota_profile: 'OTA profile',
  tier_website_hero: 'Website hero',
  tier_social_pool: 'Social pool',
  tier_internal: 'Internal',
  tier_archive: 'Archive',
};

const CATEGORY_LABEL: Record<string, string> = {
  photos: 'Photos', videos: 'Videos', reels: 'Reels',
  press_kit: 'Press Kit', logos: 'Logos', brand_guide: 'Brand Guide',
  testimonials: 'Testimonials', other: 'Other',
};

const CATEGORY_ORDER = ['photos','videos','reels','press_kit','logos','brand_guide','testimonials','other'];

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function publicRenderUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/public/media-renders/${path}`;
}

export default async function MediaPage() {
  const [links, assets, tierRows] = await Promise.all([
    getMediaLinks(),
    getMediaReady({ limit: 60 }),
    getMediaTierCounts(),
  ]);

  const totalReady = tierRows.reduce((s, r) => s + Number(r.total ?? 0), 0);
  const otaCount = tierRows.find(r => r.primary_tier === 'tier_ota_profile')?.total ?? 0;
  const heroCount = tierRows.find(r => r.primary_tier === 'tier_website_hero')?.total ?? 0;

  // Group legacy Drive links
  const grouped = new Map<string, typeof links>();
  for (const l of links) {
    const arr = grouped.get(l.category) ?? [];
    arr.push(l);
    grouped.set(l.category, arr);
  }
  const orderedKeys = [
    ...CATEGORY_ORDER.filter((k) => grouped.has(k)),
    ...Array.from(grouped.keys()).filter((k) => !CATEGORY_ORDER.includes(k)),
  ];

  return (
    <>
      <PanelHero
        eyebrow="Media · library"
        title="Brand"
        emphasis="assets"
        sub="Auto-tagged ingest pipeline · controlled vocabulary · usage-tier sorted"
        kpis={
          <>
            <KpiCard label="Library" value={totalReady} hint="ready assets" />
            <KpiCard label="OTA tier" value={otaCount} hint="best of best" />
            <KpiCard label="Web hero" value={heroCount} hint="thenamkhan.com" />
            <KpiCard label="Drive links" value={links.length} hint="legacy" kind="text" />
          </>
        }
      />

      <Card
        title="Pipeline"
        emphasis="ingested"
        sub={assets.length > 0 ? `${assets.length} most recent · v_media_ready` : 'Awaiting first upload'}
        source="marketing.v_media_ready"
        actions={
          <Link
            href="/marketing/media/upload"
            style={{
              display: 'inline-block',
              padding: '6px 14px',
              background: 'var(--brass, #b8860b)',
              color: '#fff',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              textDecoration: 'none',
            }}
          >
            Upload ↗
          </Link>
        }
      >
        {assets.length === 0 ? (
          <div className="stub" style={{ padding: 32 }}>
            <h3>No assets yet</h3>
            <p>
              Drop photos at <Link href="/marketing/media/upload" style={{ color: 'var(--brass)' }}>/marketing/media/upload</Link>.
              Each upload is hashed, dedup-checked, dimension-validated, and auto-tagged
              against {/* taxonomy lives in marketing.media_taxonomy */} the controlled vocabulary.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
              marginTop: 8,
            }}
          >
            {assets.map((a) => {
              const thumb = publicRenderUrl(a.renders?.thumbnail) ?? publicRenderUrl(a.renders?.web_2k);
              return (
                <div
                  key={a.asset_id}
                  style={{
                    background: 'var(--paper)',
                    border: '1px solid var(--line)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ aspectRatio: '4 / 3', background: '#1a1a1a', position: 'relative', overflow: 'hidden' }}>
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt={a.alt_text ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#888', fontFamily: 'var(--mono)', fontSize: 10 }}>
                        no render yet
                      </div>
                    )}
                    {a.primary_tier && (
                      <div style={{
                        position: 'absolute', top: 6, left: 6,
                        background: 'rgba(0,0,0,0.7)', color: '#fff',
                        fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 600,
                        padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {TIER_LABEL[a.primary_tier] ?? a.primary_tier}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '8px 10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink)', lineHeight: 1.3 }}>
                      {a.caption ?? a.original_filename}
                    </div>
                    {a.tags && a.tags.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {a.tags.slice(0, 4).map((t) => (
                          <span key={t} style={{
                            fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-mute)',
                            background: 'var(--line-soft, #efeae0)', padding: '1px 5px',
                          }}>
                            {t}
                          </span>
                        ))}
                        {a.tags.length > 4 && (
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-mute)' }}>
                            +{a.tags.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                    <div style={{ marginTop: 'auto', paddingTop: 6, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-mute)' }}>
                      {formatDate(a.captured_at)} · {a.width_px ?? '?'}×{a.height_px ?? '?'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {links.length > 0 && (
        <Card title="Drive" emphasis="folders" sub="Legacy media links · pre-pipeline" source="marketing.media_links" className="mt-22">
          {orderedKeys.map((cat) => {
            const items = grouped.get(cat) ?? [];
            return (
              <div key={cat} style={{ marginTop: 16 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-mute)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {CATEGORY_LABEL[cat] ?? cat} · {items.length}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                  {items.map((m) => (
                    <a
                      key={m.id}
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: 'var(--paper)',
                        border: '1px solid var(--line)',
                        padding: '10px 12px',
                        textDecoration: 'none',
                        color: 'var(--ink)',
                      }}
                    >
                      <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, fontWeight: 500 }}>{m.label}</div>
                      {m.description && (
                        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 3, lineHeight: 1.4 }}>{m.description}</div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: 'var(--mono)', fontSize: 9 }}>
                        <span style={{ color: 'var(--ink-mute)' }}>{formatDate(m.added_at)}</span>
                        <span style={{ color: 'var(--brass)', fontWeight: 600 }}>Open ↗</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}
