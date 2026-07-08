// app/marketing/library/page.tsx
// PBS 2026-07-05: Info hub · Library tab — new paper-white design.
// Migrated from legacy <Page>+<KpiBox>+<Card> shell to DashboardPage+KpiTile.
// 4-tab Info strip (Library · Events · Audiences · Taxonomy) rendered above KPIs.
//
// Data sources (all LIVE, from marketing.v_media_ready + siblings):
//   • getMediaReady       → mkt_v_media_ready
//   • getMediaTierCounts  → tier totals for the 5 tiers + logos
//   • getTaxonomy         → mkt_taxonomy tags for filter rail
//   • getCuratorPicks     → top qc + brand-fit picks
//   • getRoomTypeBuckets  → room-type coverage buckets
//   • getOtaPack          → 50-photo OTA carousel template
//
// Preserves all functional logic (URL-driven filters, tier + tag filter rail,
// AI search, drop zone, curator carousel, OTA pack, room buckets, main grid).

import type { CSSProperties } from 'react';
import TenantLink from '@/components/nav/TenantLink';
import {
  DashboardPage, KpiTile,
  type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import AssetGrid from '@/components/marketing/AssetGrid';
import LibraryAiSearch from '@/components/marketing/LibraryAiSearch';
import LibraryDropZone from '@/components/marketing/LibraryDropZone';
import LibraryCockpit from './_components/LibraryCockpit';
import {
  getMediaReady, getMediaTierCounts, getTaxonomy, getCuratorPicks,
  getRoomTypeBuckets, getOtaPack, TIER_LABEL,
} from '@/lib/marketing';
import { MARKETING_SUBPAGES } from '../_subpages';

type CockpitView = 'studio' | 'coverage' | 'briefs' | 'pipeline';
function parseCockpitView(v: string | string[] | undefined): CockpitView {
  const s = typeof v === 'string' ? v : 'studio';
  return (['studio', 'coverage', 'briefs', 'pipeline'] as string[]).includes(s) ? (s as CockpitView) : 'studio';
}

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_S = '#3A3A3A';
const INK_M = '#5A5A5A';
const CREAM = '#F7F0E1';
const FOREST= '#084838';
const RED   = '#B03826';

const INFO_TABS: Array<{ key: string; label: string; href: string }> = [
  { key: 'library',   label: 'Library',    href: '/marketing/library'   },
  { key: 'events',    label: 'Events',     href: '/marketing/events'    },
  { key: 'audiences', label: 'Audiences',  href: '/marketing/audiences' },
  { key: 'taxonomy',  label: 'Taxonomy',   href: '/marketing/taxonomy'  },
];

const TIERS = [
  { key: '',                  label: 'All' },
  { key: 'tier_ota_profile',  label: 'OTA' },
  { key: 'tier_website_hero', label: 'Website' },
  { key: 'tier_social_pool',  label: 'Social' },
  { key: 'tier_internal',     label: 'Internal' },
  { key: 'tier_archive',      label: 'Logos' },
];

interface SP { searchParams?: Record<string, string | string[] | undefined> }

export default async function LibraryPage({ searchParams }: SP) {
  const tier = (typeof searchParams?.tier === 'string' ? searchParams.tier : '') as string;
  const tag  = (typeof searchParams?.tag  === 'string' ? searchParams.tag  : '') as string;
  const q    = (typeof searchParams?.q    === 'string' ? searchParams.q    : '') as string;

  const [assets, tierRows, taxonomy, curatorPicks, roomBuckets, otaPack] = await Promise.all([
    getMediaReady({ limit: 80, tier: tier || undefined, tag: tag || undefined }),
    getMediaTierCounts(),
    getTaxonomy(),
    getCuratorPicks(12),
    getRoomTypeBuckets(),
    getOtaPack(),
  ]);

  const otaTotalFound  = otaPack.reduce((s, sl) => s + sl.found, 0);
  const otaTotalTarget = otaPack.reduce((s, sl) => s + sl.min_count, 0);
  const otaTotalGap    = otaPack.reduce((s, sl) => s + sl.gap,   0);
  const roomsUnderTarget = roomBuckets.filter(b => b.under_target).length;

  const archiveCount = Number(tierRows.find(r => r.primary_tier === 'tier_archive')?.total ?? 0);
  const totalReady   = tierRows.reduce((s, r) => s + Number(r.total ?? 0), 0) - archiveCount;
  const otaCount     = Number(tierRows.find(r => r.primary_tier === 'tier_ota_profile')?.total  ?? 0);
  const heroCount    = Number(tierRows.find(r => r.primary_tier === 'tier_website_hero')?.total ?? 0);
  const socialCount  = Number(tierRows.find(r => r.primary_tier === 'tier_social_pool')?.total  ?? 0);
  const internalCount = Number(tierRows.find(r => r.primary_tier === 'tier_internal')?.total ?? 0);

  const filtered = q
    ? assets.filter(a =>
        (a.caption ?? '').toLowerCase().includes(q.toLowerCase()) ||
        (a.alt_text ?? '').toLowerCase().includes(q.toLowerCase()) ||
        (a.original_filename ?? '').toLowerCase().includes(q.toLowerCase())
      )
    : assets;

  const tagsByCategory = new Map<string, Array<{ label: string; count?: number }>>();
  for (const t of taxonomy) {
    const arr = tagsByCategory.get(t.category) ?? [];
    arr.push({ label: t.label, count: t.used_count ?? undefined });
    tagsByCategory.set(t.category, arr);
  }

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s: any) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/library',
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Total ready',   value: totalReady,     size: 'sm', footnote: 'ex. logos' },
    { label: 'OTA',           value: otaCount,       size: 'sm', footnote: 'tier_ota_profile' },
    { label: 'Website',       value: heroCount,      size: 'sm', footnote: 'tier_website_hero' },
    { label: 'Social',        value: socialCount,    size: 'sm', footnote: 'tier_social_pool' },
    { label: 'Internal',      value: internalCount,  size: 'sm', footnote: 'tier_internal' },
    { label: 'OTA pack',      value: `${otaTotalFound}/${otaTotalTarget}`, size: 'sm', footnote: otaTotalGap > 0 ? `${otaTotalGap} short` : 'ready' },
    { label: 'Rooms short',   value: roomsUnderTarget, size: 'sm', footnote: `of ${roomBuckets.length}` },
  ];

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Marketing · Library"
        subtitle={`${totalReady} ready assets · ${curatorPicks.length} curator picks · ${otaTotalGap > 0 ? otaTotalGap + ' OTA slots still short' : 'OTA pack complete'}`}
        tabs={tabs}
      >
        {/* 4-tab Info hub strip */}
        <div style={{ ...fullRow, ...infoTabsBar }}>
          {INFO_TABS.map(t => {
            const active = t.key === 'library';
            return (
              <TenantLink key={t.key} href={t.href} style={{
                ...infoTab,
                color: active ? FOREST : INK_M,
                borderBottom: active ? `2px solid ${FOREST}` : '2px solid transparent',
                fontWeight: active ? 700 : 500,
              }}>{t.label}</TenantLink>
            );
          })}
        </div>

        {/* KPI strip */}
        <div style={{ ...fullRow, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* Existing AI-creation cockpit + drop zone + search */}
        <div style={fullRow}>
          <LibraryCockpit
            view={parseCockpitView(searchParams?.view)}
            liveCounts={{
              totalReady, ota: otaCount, hero: heroCount, social: socialCount, archive: archiveCount,
            }}
          />
        </div>

        <div style={fullRow}>
          <LibraryAiSearch />
          <LibraryDropZone />
        </div>

        {/* Fresh & ready — curator picks */}
        {curatorPicks.length > 0 && !tier && !tag && !q && (
          <div style={fullRow}>
            <div style={sectionHeader}>Fresh &amp; ready · {curatorPicks.length} picks · highest qc + brand-fit</div>
            <div style={panel}>
              <AssetGrid assets={curatorPicks} minColPx={180} />
            </div>
          </div>
        )}

        {/* OTA Pack */}
        {!tier && !tag && !q && (
          <div style={fullRow}>
            <div style={sectionHeader}>OTA pack · {otaTotalFound} of {otaTotalTarget} slots filled{otaTotalGap > 0 ? ` · ${otaTotalGap} still needed` : ' · ready to publish'}</div>
            <div style={panel}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {otaPack.map(slot => (
                  <div key={slot.slot}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
                      <h4 style={otaSlotLabel}>{slot.label}</h4>
                      <span style={{ fontSize: 11, color: slot.gap > 0 ? RED : FOREST, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                        {slot.found}/{slot.min_count}{slot.gap > 0 ? ` · ${slot.gap} short` : ' · ready'}
                      </span>
                    </div>
                    {slot.samples.length > 0 ? (
                      <AssetGrid assets={slot.samples} minColPx={150} />
                    ) : (
                      <div style={emptyRow}>
                        No qualifying photos for {slot.label.toLowerCase()}. Need {slot.min_count} with qc≥70 + brand-fit≥0.7.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* By room */}
        {!tier && !tag && !q && (
          <div style={fullRow}>
            <div style={sectionHeader}>By room · {roomBuckets.length} room types · {roomsUnderTarget > 0 ? `${roomsUnderTarget} below 5-photo target` : 'all rooms covered'}</div>
            <div style={panel}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {roomBuckets.map(b => (
                  <div key={b.slug}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
                      <h4 style={roomLabel}>{b.label}</h4>
                      <TenantLink href={`/marketing/library?tag=${encodeURIComponent(b.slug)}`}
                        style={{ fontSize: 11, textDecoration: 'none',
                          color: b.under_target ? RED : FOREST,
                          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                        }}>
                        {b.count} photo{b.count === 1 ? '' : 's'}{b.under_target ? ` · need ${5 - b.count} more` : ' · ok'} →
                      </TenantLink>
                    </div>
                    {b.samples.length > 0 ? (
                      <AssetGrid assets={b.samples} minColPx={150} />
                    ) : (
                      <div style={emptyRow}>
                        No photos tagged <code style={code}>{b.slug}</code>. Either no shots taken yet, or auto-tagger missed the room link.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Browse library — filter form + tier pills + grid */}
        <div style={fullRow}>
          <div style={{ ...sectionHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <span>Browse library · {filtered.length} asset{filtered.length === 1 ? '' : 's'}{tier ? ` · ${TIER_LABEL[tier as keyof typeof TIER_LABEL] ?? tier}` : ''}{q ? ` · matching "${q}"` : ''}</span>
            <form method="GET" action="/marketing/library" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {tag && <input type="hidden" name="tag" value={tag} />}
              <select name="tier" aria-label="Filter library by tier" defaultValue={tier} style={select}>
                {TIERS.map(t => {
                  const cnt =
                    t.key === ''                    ? totalReady :
                    t.key === 'tier_ota_profile'    ? otaCount :
                    t.key === 'tier_website_hero'   ? heroCount :
                    t.key === 'tier_social_pool'    ? socialCount :
                    t.key === 'tier_internal'       ? internalCount :
                    t.key === 'tier_archive'        ? archiveCount : 0;
                  return <option key={t.key || 'all'} value={t.key}>{t.label} · {cnt}</option>;
                })}
              </select>
              <input type="search" name="q" defaultValue={q} placeholder="Search caption, alt-text, filename…"
                aria-label="Search media library" style={inputSearch} />
              <button type="submit" style={btnPrimary}>Search</button>
              {(tier || q || tag) && (
                <TenantLink href="/marketing/library" style={btnGhost}>Clear</TenantLink>
              )}
              <TenantLink href="/marketing/upload" style={btnPrimary}>Upload ↗</TenantLink>
              <TenantLink href="/marketing/campaigns/new" style={btnPrimary}>+ Campaign</TenantLink>
            </form>
          </div>

          {/* Tier pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0 12px' }}>
            {TIERS.map(t => {
              const count =
                t.key === ''                    ? totalReady :
                t.key === 'tier_ota_profile'    ? otaCount :
                t.key === 'tier_website_hero'   ? heroCount :
                t.key === 'tier_social_pool'    ? socialCount :
                t.key === 'tier_internal'       ? internalCount :
                t.key === 'tier_archive'        ? archiveCount : 0;
              const active = tier === t.key;
              return (
                <TenantLink key={t.key || 'all'}
                  href={t.key ? `/marketing/library?tier=${t.key}` : '/marketing/library'}
                  style={{ ...pill,
                    background: active ? FOREST : WHITE,
                    color: active ? WHITE : INK,
                    borderColor: active ? FOREST : HAIR,
                  }}>
                  {t.label} <span style={{ opacity: 0.7, marginLeft: 4, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{count}</span>
                </TenantLink>
              );
            })}
          </div>

          {tag && (
            <div style={{ marginBottom: 12, fontSize: 12, color: INK_S }}>
              tag filter: <strong>{tag}</strong>
              <TenantLink href={`/marketing/library${tier ? `?tier=${tier}` : ''}`} style={{ marginLeft: 6, color: FOREST, textDecoration: 'none' }}>×</TenantLink>
            </div>
          )}

          {/* Sidebar + grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 18 }}>
            <aside style={{ fontSize: 12 }}>
              <FilterCategory title={`Tags (${taxonomy.length})`}>
                {Array.from(tagsByCategory.entries())
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .slice(0, 6)
                  .map(([cat, items]) => (
                    <div key={cat} style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: INK_M, marginBottom: 4, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                        {cat} · {items.length}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {items.slice(0, 8).map(t => (
                          <TenantLink key={t.label}
                            href={`/marketing/library?tag=${encodeURIComponent(t.label)}${tier ? `&tier=${tier}` : ''}`}
                            style={{
                              fontSize: 12,
                              color: tag === t.label ? FOREST : INK_S,
                              textDecoration: 'none',
                              fontWeight: tag === t.label ? 600 : 400,
                            }}>{tag === t.label ? '☑' : '☐'} {t.label}</TenantLink>
                        ))}
                        {items.length > 8 && <span style={{ fontSize: 10, color: INK_M }}>+{items.length - 8} more</span>}
                      </div>
                    </div>
                  ))}
              </FilterCategory>

              <FilterCategory title="Type">
                <FilterItem>☐ Photo</FilterItem>
                <FilterItem>☐ Video</FilterItem>
                <FilterItem>☐ Reel</FilterItem>
                <FilterItem>☐ 360</FilterItem>
              </FilterCategory>

              <FilterCategory title="Freshness">
                <FilterItem>◉ Any</FilterItem>
                <FilterItem>○ Used last 30d</FilterItem>
                <FilterItem>○ Unused 90d+</FilterItem>
                <FilterItem>○ Never used</FilterItem>
              </FilterCategory>

              <FilterCategory title="License">
                <FilterItem>☐ Owned only</FilterItem>
                <FilterItem>☐ Paid ads OK</FilterItem>
                <FilterItem>☐ Print OK</FilterItem>
              </FilterCategory>
            </aside>

            <div>
              <AssetGrid
                assets={filtered}
                emptyText={totalReady === 0 ? 'Library empty' : 'No assets match these filters'}
                emptyAction={
                  totalReady === 0
                    ? <p>Drop your first photos at <TenantLink href="/marketing/upload" style={{ color: FOREST }}>upload</TenantLink>, or sync via Google Drive.</p>
                    : <p style={{ fontSize: 12, color: INK_M }}>Try removing a filter or <TenantLink href="/marketing/library" style={{ color: FOREST }}>clear all</TenantLink>.</p>
                }
              />
            </div>
          </div>
        </div>
      </DashboardPage>
    </div>
  );
}

function FilterCategory({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid ' + HAIR }}>
      <div style={{ fontSize: 10, fontFamily: 'ui-monospace, SFMono-Regular, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', color: INK, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</div>
    </div>
  );
}
function FilterItem({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 12, color: INK_S, cursor: 'default' }}>{children}</span>;
}

const fullRow: CSSProperties = { gridColumn: '1 / -1' };
const infoTabsBar: CSSProperties = {
  display: 'flex', gap: 4, borderBottom: '1px solid ' + HAIR, marginBottom: 4,
};
const infoTab: CSSProperties = {
  padding: '8px 16px', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
  textDecoration: 'none', marginBottom: -1,
};
const sectionHeader: CSSProperties = {
  fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: INK_M, fontWeight: 600, margin: '8px 2px 8px',
};
const panel: CSSProperties = {
  background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: 14,
};
const otaSlotLabel: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11,
  letterSpacing: '0.06em', textTransform: 'uppercase', color: INK, margin: 0, fontWeight: 700,
};
const roomLabel: CSSProperties = { fontSize: 13, color: INK, margin: 0, fontWeight: 600 };
const emptyRow: CSSProperties = {
  padding: '10px 12px', background: CREAM, border: '1px dashed ' + HAIR, borderRadius: 4,
  fontSize: 11, color: INK_M,
};
const code: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  background: WHITE, color: INK_M, border: '1px solid ' + HAIR,
  padding: '1px 5px', borderRadius: 3, fontSize: 10,
};
const select: CSSProperties = {
  fontSize: 11, color: INK, background: WHITE, border: '1px solid ' + HAIR,
  padding: '6px 8px', height: 30, borderRadius: 4,
};
const inputSearch: CSSProperties = {
  fontSize: 12, color: INK, background: WHITE, border: '1px solid ' + HAIR,
  padding: '6px 10px', height: 30, minWidth: 200, borderRadius: 4,
};
const btnPrimary: CSSProperties = {
  padding: '6px 12px', fontSize: 11, fontWeight: 600, height: 30,
  background: FOREST, color: WHITE, border: 'none', borderRadius: 4,
  textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
};
const btnGhost: CSSProperties = {
  padding: '6px 12px', fontSize: 11, fontWeight: 600, height: 30,
  background: WHITE, color: INK, border: '1px solid ' + HAIR, borderRadius: 4,
  textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
};
const pill: CSSProperties = {
  padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 4,
  textDecoration: 'none', border: '1px solid transparent',
};
