// app/marketing/social/hashtags/page.tsx
// Central keyword & hashtag hub — single source of truth for:
//   1. Brand visual taxonomy (mkt_media_taxonomy)  → social AI draws hashtags from here
//   2. SEO target keywords (v_seo_rankings)        → ranking targets, also hashtag-worthy
//   3. Google Search Console                       → empty state until GSC is wired
//
// The AI caption generator in accept-slot/route.ts draws from section 1, filtered by platform.
// Full keyword management lives at /h/[property_id]/marketing/seo → Keywords tab.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// ── colour palette ────────────────────────────────────────────────────────────
const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';
const AMBER  = '#A06020';
const BLUE   = '#1A5A8A';

// ── label maps ────────────────────────────────────────────────────────────────
const CATEGORY_LABEL: Record<string, string> = {
  subject:       'Subject',
  mood:          'Mood',
  time_of_day:   'Time of day',
  season:        'Season',
  weather:       'Weather',
  room_type:     'Room type',
  property_area: 'Property area',
  activity:      'Activity',
  food_beverage: 'Food & Beverage',
  people:        'People',
  style:         'Style',
  event:         'Event',
};

// Which taxonomy categories each platform draws from (mirrors accept-slot/route.ts)
const PLATFORM_USES: Record<string, string[]> = {
  x:               ['subject', 'activity'],
  instagram:       ['subject', 'mood', 'activity', 'food_beverage', 'property_area', 'style'],
  pinterest:       ['subject', 'style', 'property_area', 'season', 'time_of_day'],
  tiktok:          ['activity', 'subject', 'mood'],
  facebook:        ['activity', 'subject', 'property_area'],
  linkedin:        ['activity', 'event', 'food_beverage'],
  google_business: [],
};

function platformsForCategory(cat: string): string[] {
  return Object.entries(PLATFORM_USES)
    .filter(([, cats]) => cats.includes(cat))
    .map(([p]) => p === 'google_business' ? 'GBP' : p.charAt(0).toUpperCase() + p.slice(1));
}

// ── types ─────────────────────────────────────────────────────────────────────
type TaxTag = { tag_slug: string; tag_label: string; is_active: boolean; category: string };
type SeoKw  = {
  keyword:            string;
  active:             boolean;
  monthly_searches:   number | null;
  keyword_difficulty: number | null;
  position:           number | null;
  location_name:      string | null;
};

// ── page ─────────────────────────────────────────────────────────────────────
export default async function HashtagTaxonomyPage() {
  const sb = getSupabaseAdmin();

  const [taxRes, kwRes] = await Promise.all([
    sb.from('mkt_media_taxonomy')
      .select('category,tag_slug,tag_label,is_active')
      .order('category')
      .order('tag_label'),

    // v_seo_rankings is a public SECURITY DEFINER bridge — safe for admin reads
    sb.from('v_seo_rankings')
      .select('keyword,active,monthly_searches,keyword_difficulty,position,location_name')
      .eq('property_id', 260955)  // legacy unprefixed path — Namkhan only
      .order('monthly_searches', { ascending: false, nullsFirst: false })
      .limit(60),
  ]);

  const taxTags     = (taxRes.data ?? []) as TaxTag[];
  const seoKeywords = (kwRes.data  ?? []) as SeoKw[];

  // Deduplicate keywords by text (v_seo_rankings can have rows per market)
  const kwByText = new Map<string, SeoKw>();
  for (const kw of seoKeywords) {
    if (!kwByText.has(kw.keyword)) kwByText.set(kw.keyword, kw);
  }
  const uniqueKws = Array.from(kwByText.values());

  // Group taxonomy by category
  const byCategory = new Map<string, TaxTag[]>();
  for (const tag of taxTags) {
    if (!byCategory.has(tag.category)) byCategory.set(tag.category, []);
    byCategory.get(tag.category)!.push(tag);
  }

  const activeCount = taxTags.filter(t => t.is_active).length;

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1100, fontFamily: 'system-ui,sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: INK, marginBottom: 4 }}>
          Keywords &amp; Hashtags — central hub
        </div>
        <div style={{ fontSize: 13, color: INK_M, maxWidth: 700 }}>
          Three layers: brand visual taxonomy (social AI draws hashtags from here) ·
          SEO target keywords (ranking targets — each is also a hashtag) ·
          Google Search Console queries (what people search — content topic fuel).
        </div>
      </div>

      {/* ── 1. Google Search Console ──────────────────────────────────────── */}
      <Section title="Google Search Console — top queries" badge="not connected" color={AMBER}>
        <div style={{ fontSize: 12, color: INK_M }}>
          <strong style={{ color: AMBER }}>Not connected yet.</strong>{' '}
          GSC data appears here once Google Search Console is synced via the
          Digital → Analytics page. When live it shows non-branded queries
          driving traffic — high-impression / low-CTR queries are content
          opportunities for both blog posts and social captions.
        </div>
      </Section>

      {/* ── 2. SEO target keywords ────────────────────────────────────────── */}
      <Section
        title="SEO target keywords"
        badge={uniqueKws.length > 0 ? `${uniqueKws.length} keywords` : 'none loaded'}
        color={BLUE}
      >
        {uniqueKws.length > 0 ? (
          <>
            <div style={{ fontSize: 11, color: INK_M, marginBottom: 10 }}>
              Your ranking targets, each also a potential hashtag —
              e.g. <em>eco lodge laos</em> → <code>#ecolodgelaos</code>.{' '}
              Full management (add / remove / volume data) is in the{' '}
              <a href="/h/260955/marketing/seo?tab=keywords" style={{ color: FOREST }}>
                SEO → Keywords tab
              </a>.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {uniqueKws.map((kw, i) => (
                <div
                  key={i}
                  style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 12,
                    background: kw.active !== false ? BLUE : HAIR,
                    color: kw.active !== false ? WHITE : INK_M,
                  }}
                  title={[
                    kw.monthly_searches ? `${kw.monthly_searches.toLocaleString()}/mo` : null,
                    kw.position ? `pos #${kw.position}` : null,
                    kw.location_name ?? null,
                  ].filter(Boolean).join(' · ')}
                >
                  <span style={{ fontWeight: 600 }}>
                    #{kw.keyword.replace(/\s+/g, '').toLowerCase()}
                  </span>
                  <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.7 }}>{kw.keyword}</span>
                  {kw.monthly_searches ? (
                    <span style={{ fontSize: 10, marginLeft: 5, opacity: 0.55 }}>
                      {kw.monthly_searches.toLocaleString()}/mo
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: INK_M }}>
            <strong style={{ color: AMBER }}>No keywords loaded yet.</strong>{' '}
            Add your target keywords in the{' '}
            <a href="/h/260955/marketing/seo?tab=keywords" style={{ color: FOREST }}>
              SEO → Keywords tab
            </a>.
            They will appear here as hashtag pills.
          </div>
        )}
      </Section>

      {/* ── 3. Platform hashtag rules ─────────────────────────────────────── */}
      <Section title="Platform hashtag rules" badge="which categories each platform uses" color={INK_M}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, width: 'auto' }}>
          <tbody>
            {Object.entries(PLATFORM_USES).map(([plat, cats]) => (
              <tr key={plat} style={{ borderBottom: `1px solid ${HAIR}` }}>
                <td style={{ padding: '5px 14px 5px 0', color: FOREST, fontWeight: 600, width: 145 }}>
                  {plat === 'google_business'
                    ? 'Google Business'
                    : plat.charAt(0).toUpperCase() + plat.slice(1)}
                </td>
                <td style={{ padding: '5px 0', color: INK_M }}>
                  {cats.length === 0
                    ? <em>no hashtags</em>
                    : cats.map(c => CATEGORY_LABEL[c] ?? c).join(' · ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ── 4. Brand visual taxonomy ──────────────────────────────────────── */}
      <Section
        title="Brand visual taxonomy"
        badge={`${activeCount} active tags · ${byCategory.size} categories`}
        color={FOREST}
      >
        <div style={{ fontSize: 11, color: INK_M, marginBottom: 12 }}>
          Brand-approved visual/mood tags the AI selects hashtags from when drafting posts.
          Green = active (included); grey = inactive (excluded).
          Managed in Supabase → <code>mkt_media_taxonomy</code>.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Array.from(byCategory.entries()).map(([cat, catTags]) => {
            const platforms = platformsForCategory(cat);
            return (
              <div key={cat}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: INK }}>
                    {CATEGORY_LABEL[cat] ?? cat}
                    <span style={{ fontSize: 10, color: INK_M, fontWeight: 400, marginLeft: 8 }}>
                      {catTags.filter(t => t.is_active).length} active
                    </span>
                  </div>
                  {platforms.length > 0 && (
                    <div style={{ fontSize: 10, color: FOREST }}>
                      used by: {platforms.join(', ')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {catTags.map(t => (
                    <div
                      key={t.tag_slug}
                      style={{
                        padding: '3px 9px', borderRadius: 20, fontSize: 11,
                        background: t.is_active ? FOREST : HAIR,
                        color:      t.is_active ? WHITE  : INK_M,
                        opacity:    t.is_active ? 1      : 0.5,
                      }}
                      title={`#${t.tag_slug.replace(/_/g, '')} · ${t.tag_label}`}
                    >
                      <span style={{ fontWeight: 600 }}>#{t.tag_slug.replace(/_/g, '')}</span>
                      <span style={{ fontSize: 10, marginLeft: 5, opacity: 0.7 }}>{t.tag_label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

    </div>
  );
}

// ── helper (module scope — safe to use in RSC) ────────────────────────────────
function Section({
  title, badge, color, children,
}: {
  title: string; badge?: string; color: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: INK }}>{title}</div>
        {badge && (
          <div style={{
            fontSize: 10, color, fontWeight: 600, letterSpacing: '0.05em',
            background: CREAM, padding: '2px 8px', borderRadius: 10, border: `1px solid ${HAIR}`,
          }}>
            {badge}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
