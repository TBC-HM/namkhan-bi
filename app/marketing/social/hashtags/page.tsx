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

// ── colour extras ─────────────────────────────────────────────────────────────
const RED = '#B04A2F';

// ── types ─────────────────────────────────────────────────────────────────────
type TaxTag  = { tag_slug: string; tag_label: string; is_active: boolean; category: string };
type SeoKw   = {
  keyword:            string;
  active:             boolean;
  monthly_searches:   number | null;
  keyword_difficulty: number | null;
  position:           number | null;
  location_name:      string | null;
};
type GscRow  = {
  query:        string;
  impressions:  number;
  clicks:       number;
  ctr:          number;
  avg_position: number;
  is_branded:   boolean;
};

// ── verdict helpers ───────────────────────────────────────────────────────────
function verdict(uses: number, isActive: boolean, hasGsc: boolean): { label: string; color: string } {
  if (!isActive) return { label: '✗ Off', color: '#888' };
  if (uses >= 5 || (uses >= 2 && hasGsc)) return { label: '✓ Keep', color: FOREST };
  if (uses >= 2) return { label: '~ Keep', color: AMBER };
  if (uses === 1) return { label: '? Monitor', color: AMBER };
  return { label: '✗ Unused', color: RED };
}

// ── page ─────────────────────────────────────────────────────────────────────
export default async function HashtagTaxonomyPage() {
  const sb = getSupabaseAdmin();

  const [taxRes, kwRes, gscRes, postsRes] = await Promise.all([
    sb.from('mkt_media_taxonomy')
      .select('category,tag_slug,tag_label,is_active')
      .order('category')
      .order('tag_label'),

    sb.from('v_seo_rankings')
      .select('keyword,active,monthly_searches,keyword_difficulty,position,location_name')
      .eq('property_id', 260955)
      .order('monthly_searches', { ascending: false, nullsFirst: false })
      .limit(60),

    // v_gsc_top_queries unnests the most recent queries report blob
    sb.from('v_gsc_top_queries')
      .select('query,impressions,clicks,ctr,avg_position,is_branded')
      .order('impressions', { ascending: false })
      .limit(50),

    // hashtag usage — how often each tag was used in actual social posts
    sb.from('v_social_posts')
      .select('hashtags')
      .eq('property_id', 260955)
      .not('hashtags', 'is', null),
  ]);

  const taxTags     = (taxRes.data ?? []) as TaxTag[];
  const seoKeywords = (kwRes.data  ?? []) as SeoKw[];
  const gscRows     = (gscRes.data ?? []) as GscRow[];
  const gscNonBrand = gscRows.filter(r => !r.is_branded);

  // Count per hashtag slug across all posts (hashtags stored as text[] with or without #)
  const usageCount = new Map<string, number>();
  for (const post of ((postsRes.data ?? []) as Array<{ hashtags: string[] | null }>)) {
    for (const h of (post.hashtags ?? [])) {
      const slug = h.replace(/^#/, '').toLowerCase();
      usageCount.set(slug, (usageCount.get(slug) ?? 0) + 1);
    }
  }

  // GSC signal: top non-branded queries with meaningful impressions
  const gscSignals = gscNonBrand.filter(r => r.impressions >= 50);

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
      <Section
        title="Google Search Console — top non-branded queries"
        badge={gscNonBrand.length > 0 ? `${gscNonBrand.length} queries` : 'no data'}
        color={gscNonBrand.length > 0 ? FOREST : AMBER}
      >
        {gscNonBrand.length > 0 ? (
          <>
            <div style={{ fontSize: 11, color: INK_M, marginBottom: 10 }}>
              High impressions + low clicks = content opportunity. These are the topics
              people search — post about them to capture intent.
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${HAIR}` }}>
                  {['Query', 'Impr.', 'Clicks', 'CTR', 'Avg. pos.'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '4px 10px 6px 0', fontSize: 10, color: INK_M, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gscNonBrand.map((r, i) => {
                  const pos = Number(r.avg_position);
                  const posColor = pos <= 10 ? FOREST : pos <= 20 ? AMBER : RED;
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${HAIR}` }}>
                      <td style={{ padding: '5px 10px 5px 0', color: INK }}>{r.query}</td>
                      <td style={{ padding: '5px 10px 5px 0', color: INK_M }}>{r.impressions.toLocaleString()}</td>
                      <td style={{ padding: '5px 10px 5px 0', color: INK_M }}>{r.clicks.toLocaleString()}</td>
                      <td style={{ padding: '5px 10px 5px 0', color: INK_M }}>
                        {r.impressions > 0 ? `${Math.round(Number(r.ctr) * 100)}%` : '—'}
                      </td>
                      <td style={{ padding: '5px 0', color: posColor, fontWeight: 600 }}>
                        #{Math.round(pos)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        ) : (
          <div style={{ fontSize: 12, color: INK_M }}>
            <strong style={{ color: AMBER }}>No data yet.</strong> GSC reports are loading — check back shortly.
          </div>
        )}
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

      {/* ── 4. Brand visual taxonomy — usage table ────────────────────────── */}
      <Section
        title="Brand visual taxonomy — usage & traffic"
        badge={`${activeCount} active tags · ${byCategory.size} categories`}
        color={FOREST}
      >
        <div style={{ fontSize: 11, color: INK_M, marginBottom: 12 }}>
          Each tag the AI can pick from — with how often it has been used in posts, whether it matches a
          Google Search query, and a keep / dump verdict. Managed in Supabase → <code>mkt_media_taxonomy</code>.
        </div>

        {/* Summary row */}
        {(() => {
          const allTags = taxTags;
          const unused  = allTags.filter(t => t.is_active && (usageCount.get(t.tag_slug.replace(/_/g,'').toLowerCase()) ?? 0) === 0).length;
          const totalUsed = allTags.reduce((s, t) => s + (usageCount.get(t.tag_slug.replace(/_/g,'').toLowerCase()) ?? 0), 0);
          return (
            <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 11 }}>
              <span style={{ color: FOREST, fontWeight: 600 }}>{totalUsed} total uses</span>
              <span style={{ color: unused > 0 ? RED : INK_M }}>{unused} tags never used</span>
              <span style={{ color: INK_M }}>{gscSignals.length} GSC signals matched</span>
            </div>
          );
        })()}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${HAIR}` }}>
                {['Hashtag', 'Label', 'Category', 'Platforms', 'Used', 'GSC signal', 'Verdict'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '4px 12px 6px 0', fontSize: 10, color: INK_M, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {taxTags
                .map(t => {
                  const slug     = t.tag_slug.replace(/_/g, '').toLowerCase();
                  const uses     = usageCount.get(slug) ?? 0;
                  const labelLow = t.tag_label.toLowerCase();
                  const gscMatch = gscSignals.find(g =>
                    g.query.toLowerCase().includes(labelLow) ||
                    labelLow.split(' ').some(w => w.length > 3 && g.query.toLowerCase().includes(w))
                  );
                  return { t, slug, uses, gscMatch };
                })
                .sort((a, b) => {
                  // active first, then by uses desc, then alpha
                  if (a.t.is_active !== b.t.is_active) return a.t.is_active ? -1 : 1;
                  if (b.uses !== a.uses) return b.uses - a.uses;
                  return a.t.tag_label.localeCompare(b.t.tag_label);
                })
                .map(({ t, slug, uses, gscMatch }, i) => {
                  const platforms = platformsForCategory(t.category);
                  const v         = verdict(uses, t.is_active, !!gscMatch);
                  const rowBg     = i % 2 === 0 ? WHITE : CREAM;
                  return (
                    <tr key={t.tag_slug} style={{ background: rowBg }}>
                      <td style={{ padding: '5px 12px 5px 0', fontFamily: 'monospace', fontSize: 11, color: t.is_active ? FOREST : INK_M, opacity: t.is_active ? 1 : 0.5, whiteSpace: 'nowrap' }}>
                        #{slug}
                      </td>
                      <td style={{ padding: '5px 12px 5px 0', color: INK, opacity: t.is_active ? 1 : 0.5 }}>{t.tag_label}</td>
                      <td style={{ padding: '5px 12px 5px 0', color: INK_M, fontSize: 11 }}>{CATEGORY_LABEL[t.category] ?? t.category}</td>
                      <td style={{ padding: '5px 12px 5px 0', color: INK_M, fontSize: 10 }}>{platforms.join(', ') || '—'}</td>
                      <td style={{ padding: '5px 12px 5px 0', color: uses > 0 ? INK : RED, fontWeight: uses > 0 ? 600 : 400, textAlign: 'right', paddingRight: 24 }}>
                        {uses > 0 ? uses : '0'}
                      </td>
                      <td style={{ padding: '5px 12px 5px 0', fontSize: 11 }}>
                        {gscMatch ? (
                          <span title={`"${gscMatch.query}" — ${gscMatch.impressions.toLocaleString()} impr · ${gscMatch.clicks} clicks`} style={{ color: BLUE, cursor: 'default' }}>
                            ✓ &ldquo;{gscMatch.query.slice(0, 28)}{gscMatch.query.length > 28 ? '…' : ''}&rdquo; · {gscMatch.impressions.toLocaleString()} impr
                          </span>
                        ) : (
                          <span style={{ color: INK_M, opacity: 0.4 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '5px 0', fontWeight: 600, fontSize: 11, color: v.color, whiteSpace: 'nowrap' }}>{v.label}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
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
