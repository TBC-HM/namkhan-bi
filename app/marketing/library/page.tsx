// app/marketing/library/page.tsx
// Brand & Marketing · Library — main media browser.
// 3-column layout: filter rail · asset grid · (right drawer mounted globally in layout).
// Uses URL search params for filter state (server-component-friendly).

import Link from 'next/link';
import Page from '@/components/page/Page';
import Card from '@/components/sections/Card';
import KpiBox from '@/components/kpi/KpiBox';
import AssetGrid from '@/components/marketing/AssetGrid';
import LibraryAiSearch from '@/components/marketing/LibraryAiSearch';
import LibraryDropZone from '@/components/marketing/LibraryDropZone';
import { getMediaReady, getMediaTierCounts, getTaxonomy, getCuratorPicks, getRoomTypeBuckets, getOtaPack, TIER_LABEL } from '@/lib/marketing';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

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

  const otaTotalFound = otaPack.reduce((s, sl) => s + sl.found, 0);
  const otaTotalTarget = otaPack.reduce((s, sl) => s + sl.min_count, 0);
  const otaTotalGap = otaPack.reduce((s, sl) => s + sl.gap, 0);
  const roomsUnderTarget = roomBuckets.filter(b => b.under_target).length;

  // Total ready EXCLUDES tier_archive (logos / decommissioned) so the visible
  // KPI matches the visible grid by default.
  const archiveCount = Number(tierRows.find(r => r.primary_tier === 'tier_archive')?.total ?? 0);
  const totalReady   = tierRows.reduce((s, r) => s + Number(r.total ?? 0), 0) - archiveCount;
  const otaCount     = tierRows.find(r => r.primary_tier === 'tier_ota_profile')?.total  ?? 0;
  const heroCount    = tierRows.find(r => r.primary_tier === 'tier_website_hero')?.total ?? 0;
  const socialCount  = tierRows.find(r => r.primary_tier === 'tier_social_pool')?.total  ?? 0;

  // Filter to text-search match on the server (since we don't have a full-text index yet)
  const filtered = q
    ? assets.filter(a =>
        (a.caption ?? '').toLowerCase().includes(q.toLowerCase()) ||
        (a.alt_text ?? '').toLowerCase().includes(q.toLowerCase()) ||
        (a.original_filename ?? '').toLowerCase().includes(q.toLowerCase())
      )
    : assets;

  // Group taxonomy by category for the filter rail
  const tagsByCategory = new Map<string, Array<{ label: string; count?: number }>>();
  for (const t of taxonomy) {
    const arr = tagsByCategory.get(t.category) ?? [];
    arr.push({ label: t.label, count: t.used_count ?? undefined });
    tagsByCategory.set(t.category, arr);
  }

  return (
    <Page
      eyebrow="Marketing · Library"
      title={<>Media <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>library</em>.</>}
      subPages={MARKETING_SUBPAGES}
    >
      {/* AI search bar — routes to /cockpit/chat?dept=marketing so Lumen handles
          natural-language asset queries. */}
      <LibraryAiSearch />

      {/* Drop zone — drag/drop new media straight into /api/marketing/upload. */}
      <LibraryDropZone />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={totalReady}   unit="count" label="Total ready"  tooltip="all tiers" />
        <KpiBox value={Number(otaCount)}     unit="count" label="OTA profile"  tooltip="best of best" />
        <KpiBox value={Number(heroCount)}    unit="count" label="Website hero" tooltip="thenamkhan.com" />
        <KpiBox value={Number(socialCount)}  unit="count" label="Social pool"  tooltip="rotate weekly" />
      </div>

      {/* Curator: Fresh & ready — top 12 by qc + brand-fit */}
      {curatorPicks.length > 0 && !tier && !tag && !q && (
        <Card
          title="Fresh"
          emphasis="& ready"
          sub={`${curatorPicks.length} picks · highest qc + brand-fit · pull these for OTAs, hero, social`}
          source="auto-tagger · vision · tier-classifier"
        >
          <AssetGrid assets={curatorPicks} minColPx={180} />
        </Card>
      )}

      {/* OTA Pack: 50-photo carousel template */}
      {!tier && !tag && !q && (
        <Card
          title="OTA"
          emphasis="pack"
          sub={`${otaTotalFound} of ${otaTotalTarget} slots filled${otaTotalGap > 0 ? ` · ${otaTotalGap} photos still needed` : ' · ready to publish'}`}
          source="canonical Booking.com / Expedia / SLH carousel"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {otaPack.map(slot => (
              <div key={slot.slot}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
                  <h4 style={{
                    fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                    letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                    color: 'var(--ink)', margin: 0, fontWeight: 700,
                  }}>{slot.label}</h4>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                    color: slot.gap > 0 ? 'var(--st-bad)' : 'var(--moss-glow)',
                  }}>
                    {slot.found}/{slot.min_count}{slot.gap > 0 ? ` · ${slot.gap} short` : ' · ✓'}
                  </span>
                </div>
                {slot.samples.length > 0 ? (
                  <AssetGrid assets={slot.samples} minColPx={150} />
                ) : (
                  <div style={{
                    padding: '12px 14px', background: 'var(--st-bad-bg)',
                    border: '1px dashed var(--st-bad-bd)', borderRadius: 4,
                    fontSize: 'var(--t-sm)', color: 'var(--st-bad)',
                  }}>
                    No qualifying photos for {slot.label.toLowerCase()}. Need {slot.min_count} with qc≥70 + brand-fit≥0.7.
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* By-Room: 10 room types, 5+ photos each, gap warnings */}
      {!tier && !tag && !q && (
        <Card
          title="By"
          emphasis="room"
          sub={`${roomBuckets.length} room types · ${roomsUnderTarget > 0 ? `${roomsUnderTarget} below 5-photo target` : 'all rooms covered'}`}
          source="marketing.media_taxonomy.room_type"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {roomBuckets.map(b => (
              <div key={b.slug}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
                  <h4 style={{
                    fontFamily: 'var(--serif)', fontSize: 'var(--t-md)',
                    color: 'var(--ink)', margin: 0,
                  }}>{b.label}</h4>
                  <Link
                    href={`/marketing/library?tag=${encodeURIComponent(b.slug)}`}
                    style={{
                      fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                      color: b.under_target ? 'var(--st-bad)' : 'var(--moss-glow)',
                      textDecoration: 'none',
                    }}
                  >
                    {b.count} photo{b.count === 1 ? '' : 's'}{b.under_target ? ` · need ${5 - b.count} more` : ' · ✓'} →
                  </Link>
                </div>
                {b.samples.length > 0 ? (
                  <AssetGrid assets={b.samples} minColPx={150} />
                ) : (
                  <div style={{
                    padding: '12px 14px', background: 'var(--st-bad-bg)',
                    border: '1px dashed var(--st-bad-bd)', borderRadius: 4,
                    fontSize: 'var(--t-sm)', color: 'var(--st-bad)',
                  }}>
                    No photos tagged <code>{b.slug}</code>. Either no shots taken yet, or photos exist but the auto-tagger missed the room link — open one and add the tag manually.
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tier-toggle pills + actions */}
      <Card
        title="Browse"
        emphasis="library"
        sub={`${filtered.length} asset${filtered.length === 1 ? '' : 's'}${tier ? ` · ${TIER_LABEL[tier as keyof typeof TIER_LABEL] ?? tier}` : ''}${q ? ` · matching "${q}"` : ''}`}
        source="marketing.v_media_ready"
        actions={
          <form method="GET" action="/marketing/library" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {tag && <input type="hidden" name="tag" value={tag} />}
            <label
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                letterSpacing: 'var(--ls-extra)',
                textTransform: 'uppercase',
                color: 'var(--ink-mute)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Tier
              <select
                name="tier"
                aria-label="Filter library by tier"
                defaultValue={tier}
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--t-xs)',
                  letterSpacing: 'var(--ls-extra)',
                  textTransform: 'uppercase',
                  color: 'var(--ink)',
                  background: 'var(--paper-warm)',
                  border: '1px solid var(--line)',
                  padding: '6px 8px',
                  height: 32,
                }}
              >
                {TIERS.map((t) => {
                  const internalCount = Number(tierRows.find(r => r.primary_tier === 'tier_internal')?.total ?? 0);
                  const cnt =
                    t.key === ''                    ? totalReady :
                    t.key === 'tier_ota_profile'    ? Number(otaCount) :
                    t.key === 'tier_website_hero'   ? Number(heroCount) :
                    t.key === 'tier_social_pool'    ? Number(socialCount) :
                    t.key === 'tier_internal'       ? internalCount :
                    t.key === 'tier_archive'        ? archiveCount :
                    0;
                  return (
                    <option key={t.key || 'all'} value={t.key}>
                      {t.label} · {cnt}
                    </option>
                  );
                })}
              </select>
            </label>
            <input
              type="search"
              name="q"
              defaultValue={q}
              aria-label="Search media library"
              placeholder="Search caption, alt-text, filename…"
              style={{
                fontFamily: 'var(--sans)',
                fontSize: 'var(--t-sm)',
                color: 'var(--ink)',
                background: 'var(--paper-warm)',
                border: '1px solid var(--line)',
                padding: '6px 10px',
                height: 32,
                minWidth: 220,
              }}
            />
            <button
              type="submit"
              className="btn"
              style={{ fontSize: 'var(--t-xs)', height: 32 }}
            >
              Search
            </button>
            {(tier || q || tag) && (
              <Link
                href="/marketing/library"
                className="btn"
                style={{ fontSize: 'var(--t-xs)', height: 32, textDecoration: 'none' }}
              >
                Clear
              </Link>
            )}
            <Link href="/marketing/upload" className="btn" style={{ fontSize: "var(--t-sm)", textDecoration: 'none', background: 'var(--brass)', color: 'var(--paper-warm)', borderColor: 'var(--brass)' }}>upload ↗</Link>
            <Link href="/marketing/campaigns/new" className="btn" style={{ fontSize: "var(--t-sm)", textDecoration: 'none', background: 'var(--moss)', color: 'var(--paper-warm)', borderColor: 'var(--moss)' }}>+ new campaign</Link>
          </form>
        }
      >
        {/* Tier pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {TIERS.map(t => {
            const internalCount = Number(tierRows.find(r => r.primary_tier === 'tier_internal')?.total ?? 0);
            const count =
              t.key === ''                    ? totalReady :
              t.key === 'tier_ota_profile'    ? Number(otaCount) :
              t.key === 'tier_website_hero'   ? Number(heroCount) :
              t.key === 'tier_social_pool'    ? Number(socialCount) :
              t.key === 'tier_internal'       ? internalCount :
              t.key === 'tier_archive'        ? archiveCount :
              0;
            const active = tier === t.key;
            return (
              <Link
                key={t.key || 'all'}
                href={t.key ? `/marketing/library?tier=${t.key}` : '/marketing/library'}
                className="btn"
                style={{
                  fontSize: "var(--t-sm)",
                  textDecoration: 'none',
                  background: active ? 'var(--moss)' : 'var(--paper-warm)',
                  color: active ? 'var(--paper-warm)' : 'var(--ink)',
                  borderColor: active ? 'var(--moss)' : 'var(--line)',
                }}
              >{t.label} <span style={{ fontFamily: 'var(--mono)', opacity: 0.7, marginLeft: 4 }}>{count}</span></Link>
            );
          })}
        </div>

        {/* Tag chip filter (single-tag for now). Search + tier dropdown are
            now in the Card header actions slot above. */}
        {tag && (
          <div style={{ marginBottom: 12, fontSize: "var(--t-sm)", color: 'var(--ink-soft)' }}>
            tag filter: <strong>{tag}</strong>
            <Link href={`/marketing/library${tier ? `?tier=${tier}` : ''}`} style={{ marginLeft: 6, color: 'var(--moss)' }}>×</Link>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 18 }}>
          {/* Filter rail */}
          <aside style={{ fontSize: "var(--t-base)" }}>
            <FilterCategory title={`Tags (${taxonomy.length})`}>
              {Array.from(tagsByCategory.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .slice(0, 6)
                .map(([cat, items]) => (
                  <div key={cat} style={{ marginTop: 12 }}>
                    <div style={{ fontSize: "var(--t-xs)", textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink-mute)', marginBottom: 4, fontFamily: 'var(--mono)' }}>
                      {cat} · {items.length}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {items.slice(0, 8).map(t => (
                        <Link
                          key={t.label}
                          href={`/marketing/library?tag=${encodeURIComponent(t.label)}${tier ? `&tier=${tier}` : ''}`}
                          style={{
                            fontSize: "var(--t-sm)",
                            color: tag === t.label ? 'var(--moss)' : 'var(--ink-soft)',
                            textDecoration: 'none',
                            fontWeight: tag === t.label ? 600 : 400,
                          }}
                        >{tag === t.label ? '☑' : '☐'} {t.label}</Link>
                      ))}
                      {items.length > 8 && <span style={{ fontSize: "var(--t-xs)", color: 'var(--ink-mute)' }}>+{items.length - 8} more</span>}
                    </div>
                  </div>
                ))}
            </FilterCategory>

            <FilterCategory title="Type">
              <Label>☐ Photo</Label>
              <Label>☐ Video</Label>
              <Label>☐ Reel</Label>
              <Label>☐ 360</Label>
            </FilterCategory>

            <FilterCategory title="Freshness">
              <Label>◉ Any</Label>
              <Label>○ Used last 30d</Label>
              <Label>○ Unused 90d+</Label>
              <Label>○ Never used</Label>
            </FilterCategory>

            <FilterCategory title="License">
              <Label>☐ Owned only</Label>
              <Label>☐ Paid ads OK</Label>
              <Label>☐ Print OK</Label>
            </FilterCategory>
          </aside>

          {/* Grid */}
          <div>
            <AssetGrid
              assets={filtered}
              emptyText={totalReady === 0 ? 'Library empty' : 'No assets match these filters'}
              emptyAction={
                totalReady === 0
                  ? <p>Drop your first photos at <Link href="/marketing/upload" style={{ color: 'var(--brass)' }}>upload</Link>, or sync via Google Drive (Phase 1 ingest pipeline).</p>
                  : <p style={{ fontSize: "var(--t-base)", color: 'var(--ink-mute)' }}>Try removing a filter or <Link href="/marketing/library" style={{ color: 'var(--moss)' }}>clear all</Link>.</p>
              }
            />
          </div>
        </div>
      </Card>
    </Page>
  );
}

function FilterCategory({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--line-soft)' }}>
      <div style={{ fontSize: "var(--t-xs)", fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--ink)', fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: "var(--t-sm)", color: 'var(--ink-soft)', cursor: 'default' }}>{children}</span>;
}
