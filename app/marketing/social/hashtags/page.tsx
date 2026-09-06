// app/marketing/social/hashtags/page.tsx
// Social hashtag taxonomy — read-only view of public.mkt_media_taxonomy.
// Shows every tag the AI draws from when drafting captions, grouped by category.
// Which categories are used per platform mirrors HASHTAG_CATEGORIES in accept-slot.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';
const AMBER  = '#A06020';

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

// Mirrors HASHTAG_CATEGORIES in accept-slot/route.ts — which categories each platform uses
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
    .map(([p]) => p.toUpperCase().replace('_', ' '));
}

type Tag = { tag_slug: string; tag_label: string; is_active: boolean; category: string };

export default async function HashtagTaxonomyPage() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('mkt_media_taxonomy')
    .select('category,tag_slug,tag_label,is_active')
    .order('category')
    .order('tag_label');

  if (error) {
    return (
      <div style={{ padding: 24, color: '#B04A2F', fontFamily: 'monospace', fontSize: 13 }}>
        Error loading taxonomy: {error.message}
      </div>
    );
  }

  const tags = (data ?? []) as Tag[];

  // Group by category preserving sort
  const byCategory = new Map<string, Tag[]>();
  for (const tag of tags) {
    if (!byCategory.has(tag.category)) byCategory.set(tag.category, []);
    byCategory.get(tag.category)!.push(tag);
  }

  const activeCount = tags.filter(t => t.is_active).length;

  return (
    <div style={{ padding: '20px 24px', maxWidth: 960, fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: INK, marginBottom: 4 }}>
          Social hashtag taxonomy
        </div>
        <div style={{ fontSize: 13, color: INK_M }}>
          {activeCount} active tags across {byCategory.size} categories — these are the brand-approved keywords
          the AI selects hashtags from when drafting posts. Each platform uses a subset of categories (shown below).
        </div>
      </div>

      {/* Platform → categories reference */}
      <div style={{ background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: INK_M, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          Which categories each platform draws from
        </div>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
          <tbody>
            {Object.entries(PLATFORM_USES).map(([plat, cats]) => (
              <tr key={plat} style={{ borderBottom: `1px solid ${HAIR}` }}>
                <td style={{ padding: '5px 12px 5px 0', color: FOREST, fontWeight: 600, width: 140 }}>
                  {plat === 'google_business' ? 'Google Business' : plat.charAt(0).toUpperCase() + plat.slice(1)}
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
      </div>

      {/* Tag grid by category */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Array.from(byCategory.entries()).map(([cat, catTags]) => {
          const platforms = platformsForCategory(cat);
          return (
            <div key={cat} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: INK }}>
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {catTags.map((t) => {
                  const hashtag = `#${t.tag_slug.replace(/_/g, '')}`;
                  return (
                    <div key={t.tag_slug}
                      style={{
                        padding: '4px 10px', borderRadius: 20,
                        background: t.is_active ? FOREST : HAIR,
                        color: t.is_active ? WHITE : INK_M,
                        fontSize: 12, opacity: t.is_active ? 1 : 0.55,
                      }}
                      title={`${hashtag} · ${t.tag_label}`}>
                      <span style={{ fontWeight: 600 }}>{hashtag}</span>
                      <span style={{ fontSize: 10, marginLeft: 5, opacity: 0.75 }}>{t.tag_label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 20, fontSize: 11, color: INK_M }}>
        Tags are managed in Supabase (table <code>mkt_media_taxonomy</code>).
        Inactive tags (greyed out) are excluded from AI generation.
        Contact your platform admin to add or modify tags.
      </div>
    </div>
  );
}
