// app/marketing/library/page.tsx
// Brand & Marketing · Library — main media browser.
// 3-column layout: filter rail · asset grid · (right drawer mounted globally in layout).
// Uses URL search params for filter state (server-component-friendly).

import Link from 'next/link';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import AssetGrid from '@/components/marketing/AssetGrid';
import { getMediaReady, getMediaTierCounts, getTaxonomy, getCuratorPicks, TIER_LABEL } from '@/lib/marketing';

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

  const [assets, tierRows, taxonomy, curatorPicks] = await Promise.all([
    getMediaReady({ limit: 80, tier: tier || undefined, tag: tag || undefined }),
    getMediaTierCounts(),
    getTaxonomy(),
    getCuratorPicks(12),
  ]);

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
    <>
      <PanelHero
        eyebrow="Brand · Marketing · library"
        title="Media"
        emphasis="library"
        sub="Tagged · classified · render-ready · usage-tier sorted"
        kpis={
          <>
            <KpiCard label="Total ready"    value={totalReady}  hint="all tiers" />
            <KpiCard label="OTA profile"    value={otaCount}    hint="best of best" />
            <KpiCard label="Website hero"   value={heroCount}   hint="thenamkhan.com" />
            <KpiCard label="Social pool"    value={socialCount} hint="rotate weekly" />
          </>
        }
      />

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

      {/* Tier-toggle pills + actions */}
      <Card
        title="Browse"
        emphasis="library"
        sub={`${filtered.length} asset${filtered.length === 1 ? '' : 's'}${tier ? ` · ${TIER_LABEL[tier as keyof typeof TIER_LABEL] ?? tier}` : ''}${q ? ` · matching "${q}"` : ''}`}
        source="marketing.v_media_ready"
        actions={
          <div style={{ display: 'flex', gap: 6 }}>
            <Link href="/marketing/upload" className="btn" style={{ fontSize: "var(--t-sm)", textDecoration: 'none', background: 'var(--brass)', color: 'var(--paper-warm)', borderColor: 'var(--brass)' }}>upload ↗</Link>
            <Link href="/marketing/campaigns/new" className="btn" style={{ fontSize: "var(--t-sm)", textDecoration: 'none', background: 'var(--moss)', color: 'var(--paper-warm)', borderColor: 'var(--moss)' }}>+ new campaign</Link>
          </div>
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

        {/* Search */}
        <form method="GET" action="/marketing/library" style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {tier && <input type="hidden" name="tier" value={tier} />}
          {tag  && <input type="hidden" name="tag"  value={tag} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="search caption, alt-text, filename…"
            style={{
              flex: 1,
              fontSize: "var(--t-base)",
              padding: '8px 12px',
              border: '1px solid var(--line)',
              borderRadius: 4,
              background: 'var(--paper-warm)',
              fontFamily: 'var(--sans)',
            }}
          />
          <button type="submit" className="btn" style={{ fontSize: "var(--t-sm)" }}>search</button>
          {q && <Link href="/marketing/library" className="btn" style={{ fontSize: "var(--t-sm)", textDecoration: 'none' }}>clear</Link>}
        </form>

        {/* Tag chip filter (single-tag for now) */}
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
    </>
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
