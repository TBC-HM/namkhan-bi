// app/university/_lib/ia.ts
// TBC University · information architecture shared by the module page and the
// article page (prev/next). Grouping is generic — it works for ANY module:
// article_type drives concept / troubleshooting / faq / reference; how_to
// articles carry a section keyword (getting-started | daily | periodic).

export type ArticleMeta = {
  slug: string; article_type: string; title: string; purpose: string;
  audience: string; keywords: string[] | null;
};

export type ModuleCard = {
  slug: string; title: string; description: string; icon_hint: string | null;
  status: string; sort_order: number; dept: string | null; audience: string | null;
};

// Hardcoded fallback until public.v_university_modules ships (read contract:
// tolerate the view not existing yet). Landing + module pages fall back here.
export const FALLBACK_MODULES: ModuleCard[] = [
  { slug: 'newsletter', title: 'Newsletter', description: 'Planning the calendar, accepting slots, reviewing drafts, photos, test sends, scheduling — and the automatic lifecycle emails.', icon_hint: 'mail', status: 'live', sort_order: 1, dept: 'marketing', audience: 'staff' },
  { slug: 'media', title: 'Media', description: 'The photo library, tiers and coverage.', icon_hint: 'image', status: 'coming-soon', sort_order: 2, dept: 'marketing', audience: 'staff' },
  { slug: 'director', title: 'Director', description: 'The planning calendar in depth.', icon_hint: 'calendar', status: 'coming-soon', sort_order: 3, dept: 'marketing', audience: 'staff' },
  { slug: 'socials', title: 'Socials', description: 'Social posting and scheduling.', icon_hint: 'share', status: 'coming-soon', sort_order: 4, dept: 'marketing', audience: 'staff' },
];

export function sectionOf(a: ArticleMeta): string {
  const kw = a.keywords ?? [];
  if (a.article_type === 'concept') return 'what';
  if (a.article_type === 'troubleshooting') return 'trouble';
  if (a.article_type === 'faq') return 'faq';
  if (a.article_type === 'reference') return 'reference';
  if (kw.includes('getting-started')) return 'start';
  if (kw.includes('periodic')) return 'periodic';
  return 'daily';
}

export const SECTIONS: { key: string; label: string; hint?: string }[] = [
  { key: 'what', label: 'What this module does' },
  { key: 'start', label: 'Getting started', hint: 'in order — this is the onboarding checklist' },
  { key: 'daily', label: 'Daily tasks' },
  { key: 'periodic', label: 'Periodic' },
  { key: 'reference', label: 'Reference' },
  { key: 'trouble', label: 'Troubleshooting' },
  { key: 'faq', label: 'FAQ & glossary' },
];

// Per-module explicit ordering inside a section (onboarding order matters).
const MODULE_ORDERS: Record<string, Record<string, string[]>> = {
  newsletter: {
    start: ['newsletter-plan-a-month', 'newsletter-accept-slots', 'newsletter-set-cadence', 'newsletter-audience-settings'],
    daily: ['newsletter-review-and-approve-draft', 'newsletter-write-email-now', 'newsletter-change-hero-photo',
      'newsletter-refine-instructions', 'newsletter-test-send', 'newsletter-schedule-broadcast'],
  },
};

function orderIn(list: string[] | undefined, slug: string): number {
  if (!list) return 99;
  const i = list.indexOf(slug);
  return i === -1 ? 99 : i;
}

// Group + order a module's articles. Returns sections in canonical order,
// each with its ordered article list; also the flat reading order (used by
// prev/next on the article page).
export function groupArticles(moduleSlug: string, articles: ArticleMeta[]) {
  const bySection = new Map<string, ArticleMeta[]>();
  for (const a of articles) {
    const s = sectionOf(a);
    if (!bySection.has(s)) bySection.set(s, []);
    bySection.get(s)!.push(a);
  }
  const orders = MODULE_ORDERS[moduleSlug] ?? {};
  for (const [key, list] of Array.from(bySection.entries())) {
    list.sort((a, b) => {
      const d = orderIn(orders[key], a.slug) - orderIn(orders[key], b.slug);
      return d !== 0 ? d : a.title.localeCompare(b.title);
    });
  }
  const sections = SECTIONS
    .map((s) => ({ ...s, articles: bySection.get(s.key) ?? [] }))
    .filter((s) => s.articles.length > 0);
  const flat = sections.flatMap((s) => s.articles);
  return { sections, flat };
}
