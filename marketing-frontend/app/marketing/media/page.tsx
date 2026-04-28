// app/marketing/media/page.tsx

import { getMediaLinks } from '@/lib/marketing';

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
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default async function MediaPage() {
  const links = await getMediaLinks();

  // Group by category
  const grouped = new Map<string, typeof links>();
  for (const l of links) {
    const arr = grouped.get(l.category) ?? [];
    arr.push(l);
    grouped.set(l.category, arr);
  }

  const orderedKeys = [
    ...CATEGORY_ORDER.filter(k => grouped.has(k)),
    ...Array.from(grouped.keys()).filter(k => !CATEGORY_ORDER.includes(k)),
  ];

  return (
    <>
      <div className="kpi-strip cols-3">
        <div className="kpi-tile">
          <div className="kpi-label">Total Assets</div>
          <div className="kpi-value">{links.length}</div>
          <div className="kpi-deltas">linked items</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Categories</div>
          <div className="kpi-value">{grouped.size}</div>
          <div className="kpi-deltas">in use</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Storage</div>
          <div className="kpi-value serif" style={{ fontSize: 18 }}>Google Drive</div>
          <div className="kpi-deltas">links open in Drive</div>
        </div>
      </div>

      {links.length === 0 ? (
        <div className="empty-state">
          <div className="empty-title">No media links yet</div>
          <div className="empty-body">
            Add Drive folder URLs via Supabase dashboard → marketing.media_links table.
            Categories: photos, videos, reels, press_kit, logos, brand_guide, testimonials, other.
          </div>
        </div>
      ) : (
        orderedKeys.map((cat) => {
          const items = grouped.get(cat) ?? [];
          return (
            <div key={cat} className="section">
              <div className="section-head">
                <div className="section-title">{CATEGORY_LABEL[cat] ?? cat}</div>
                <div className="section-tag">{items.length} {items.length === 1 ? 'item' : 'items'}</div>
              </div>
              <div className="media-grid">
                {items.map((m) => (
                  <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="media-card">
                    <div className="media-card-label">{m.label}</div>
                    {m.description && <div className="media-card-desc">{m.description}</div>}
                    <div className="media-card-foot">
                      <span className="muted">{formatDate(m.added_at)}</span>
                      <span className="link-out">Open ↗</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
