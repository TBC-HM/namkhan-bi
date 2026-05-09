// app/marketing/media/page.tsx
// Marketing · Media library.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import { getMediaLinks } from '@/lib/marketing';
import MediaFilterBar from './_components/MediaFilterBar';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

const CATEGORY_LABEL: Record<string, string> = {
  photos: 'Photos',
  videos: 'Videos',
  reels: 'Reels',
  press_kit: 'Press Kit',
  logos: 'Logos',
  brand_guide: 'Brand Guide',
  testimonials: 'Testimonials',
  other: 'Other',
};

const CATEGORY_ORDER = [
  'photos', 'videos', 'reels', 'press_kit', 'logos', 'brand_guide', 'testimonials', 'other',
];

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function readParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return (v[0] ?? '').trim();
  return (v ?? '').trim();
}

export default async function MediaPage({
  searchParams,
}: {
  searchParams: { cat?: string | string[]; q?: string | string[] };
}) {
  const links = await getMediaLinks();

  const catFilter = readParam(searchParams.cat).toLowerCase();
  const qFilter = readParam(searchParams.q).toLowerCase();

  // Filter by URL params (in-memory; the underlying table is small).
  const filtered = links.filter((l) => {
    if (catFilter && (l.category ?? '').toLowerCase() !== catFilter) return false;
    if (qFilter) {
      const hay = `${l.label ?? ''} ${l.description ?? ''}`.toLowerCase();
      if (!hay.includes(qFilter)) return false;
    }
    return true;
  });

  // Distinct category options derived from the full data set so the dropdown
  // doesn't collapse as the user filters.
  const catCounts = new Map<string, number>();
  for (const l of links) {
    catCounts.set(l.category, (catCounts.get(l.category) ?? 0) + 1);
  }
  const orderedCats = [
    ...CATEGORY_ORDER.filter((k) => catCounts.has(k)),
    ...Array.from(catCounts.keys()).filter((k) => !CATEGORY_ORDER.includes(k)),
  ];
  const filterOptions = orderedCats.map((c) => ({
    value: c,
    label: CATEGORY_LABEL[c] ?? c,
    count: catCounts.get(c) ?? 0,
  }));

  // Group the filtered list for the per-category Cards.
  const grouped = new Map<string, typeof filtered>();
  for (const l of filtered) {
    const arr = grouped.get(l.category) ?? [];
    arr.push(l);
    grouped.set(l.category, arr);
  }
  const orderedKeys = [
    ...CATEGORY_ORDER.filter((k) => grouped.has(k)),
    ...Array.from(grouped.keys()).filter((k) => !CATEGORY_ORDER.includes(k)),
  ];

  const isFiltered = Boolean(catFilter || qFilter);

  return (
    <>
      <PanelHero
        eyebrow="Media · library"
        title="Brand"
        emphasis="assets"
        sub="Drive-linked photos · videos · press kits · logos"
        kpis={
          <>
            <KpiCard label="Total Assets" value={links.length} hint="linked items" />
            <KpiCard label="Categories" value={catCounts.size} hint="in use" />
            <KpiCard label="Storage" value="Drive" kind="text" hint="links open externally" />
            <KpiCard
              label="Last Added"
              value={links.length > 0 ? formatDate(links[0].added_at) : '—'}
              kind="text"
              hint="most recent upload"
            />
          </>
        }
      />

      {links.length > 0 && (
        <Card
          title="Filter library"
          sub={
            isFiltered
              ? `${filtered.length} of ${links.length} matching`
              : `${links.length} assets`
          }
          actions={<MediaFilterBar options={filterOptions} total={links.length} />}
          className="mt-22"
        >
          <div style={{ height: 0 }} />
        </Card>
      )}

      {links.length === 0 ? (
        <Card title="No media yet" sub="Awaiting first upload">
          <div className="stub" style={{ padding: 32 }}>
            <h3>No media links yet</h3>
            <p>
              Add Drive folder URLs via Supabase → marketing.media_links table.
              Categories: photos, videos, reels, press_kit, logos, brand_guide, testimonials, other.
            </p>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card title="No matches" sub="No assets match the current filter" className="mt-22">
          <div className="stub" style={{ padding: 24 }}>
            <p style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-base)' }}>
              {catFilter && qFilter
                ? `No items in "${CATEGORY_LABEL[catFilter] ?? catFilter}" matching "${qFilter}".`
                : qFilter
                ? `No items matching "${qFilter}".`
                : `No items in "${CATEGORY_LABEL[catFilter] ?? catFilter}".`}
            </p>
          </div>
        </Card>
      ) : (
        orderedKeys.map((cat) => {
          const items = grouped.get(cat) ?? [];
          return (
            <Card
              key={cat}
              title={CATEGORY_LABEL[cat] ?? cat}
              emphasis={`· ${items.length}`}
              sub={items.length === 1 ? '1 item' : `${items.length} items`}
              source="marketing.media_links"
              className="mt-22"
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 14,
                }}
              >
                {items.map((m: any) => (
                  <a
                    key={m.id}
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: 'var(--paper)',
                      border: '1px solid var(--line)',
                      padding: '14px 16px',
                      display: 'block',
                      textDecoration: 'none',
                      color: 'var(--ink)',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                    className="media-card"
                  >
                    <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: "var(--t-lg)", fontWeight: 500, color: 'var(--ink)' }}>
                      {m.label}
                    </div>
                    {m.description && (
                      <div style={{ fontSize: "var(--t-base)", color: 'var(--ink-mute)', marginTop: 4, lineHeight: 1.4 }}>
                        {m.description}
                      </div>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: 12,
                        paddingTop: 10,
                        borderTop: '1px solid var(--line-soft)',
                        fontFamily: 'var(--mono)',
                        fontSize: "var(--t-xs)",
                      }}
                    >
                      <span style={{ color: 'var(--ink-mute)' }}>{formatDate(m.added_at)}</span>
                      <span style={{ color: 'var(--brass)', fontWeight: 600 }}>Open ↗</span>
                    </div>
                  </a>
                ))}
              </div>
            </Card>
          );
        })
      )}
    </>
  );
}
