// app/university/newsletter/page.tsx
// TBC University · Newsletter module guide. Sections follow the design brief's
// IA order: What it does → Getting started → Daily tasks → Periodic →
// Reference → Troubleshooting → FAQ. Grouping: article_type drives concept /
// troubleshooting / faq / reference; how_to articles carry a section keyword
// (getting-started | daily | periodic) that is stripped from display.

import type { CSSProperties } from 'react';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import AskWindow from '../_components/AskWindow';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const HAIR = '#E6DFCC';
const GREEN = '#084838';

type Article = {
  slug: string; article_type: string; title: string; purpose: string;
  audience: string; keywords: string[] | null;
};

function section(a: Article): string {
  const kw = a.keywords ?? [];
  if (a.article_type === 'concept') return 'what';
  if (a.article_type === 'troubleshooting') return 'trouble';
  if (a.article_type === 'faq') return 'faq';
  if (a.article_type === 'reference') return 'reference';
  if (kw.includes('getting-started')) return 'start';
  if (kw.includes('periodic')) return 'periodic';
  return 'daily';
}

const SECTIONS: { key: string; label: string; hint?: string }[] = [
  { key: 'what', label: 'What this module does' },
  { key: 'start', label: 'Getting started', hint: 'in order — this is the onboarding checklist' },
  { key: 'daily', label: 'Daily tasks' },
  { key: 'periodic', label: 'Periodic' },
  { key: 'reference', label: 'Reference' },
  { key: 'trouble', label: 'Troubleshooting' },
  { key: 'faq', label: 'FAQ & glossary' },
];

// Getting-started order matters (onboarding checklist source, per brief).
const START_ORDER = [
  'newsletter-plan-a-month', 'newsletter-accept-slots', 'newsletter-set-cadence', 'newsletter-audience-settings',
];
const DAILY_ORDER = [
  'newsletter-review-and-approve-draft', 'newsletter-write-email-now', 'newsletter-change-hero-photo',
  'newsletter-refine-instructions', 'newsletter-test-send', 'newsletter-schedule-broadcast',
];

function orderIn(list: string[], slug: string): number {
  const i = list.indexOf(slug);
  return i === -1 ? 99 : i;
}

export default async function NewsletterGuidePage() {
  let articles: Article[] = [];
  let loadError: string | null = null;
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('v_university_articles')
      .select('slug, article_type, title, purpose, audience, keywords')
      .eq('module', 'newsletter').eq('lang', 'en');
    if (error) loadError = error.message;
    articles = (data as Article[] | null) ?? [];
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'load failed';
  }

  const bySection = new Map<string, Article[]>();
  for (const a of articles) {
    const s = section(a);
    if (!bySection.has(s)) bySection.set(s, []);
    bySection.get(s)!.push(a);
  }
  bySection.get('start')?.sort((a, b) => orderIn(START_ORDER, a.slug) - orderIn(START_ORDER, b.slug));
  bySection.get('daily')?.sort((a, b) => orderIn(DAILY_ORDER, a.slug) - orderIn(DAILY_ORDER, b.slug));

  const row: CSSProperties = {
    display: 'flex', alignItems: 'baseline', gap: 10, padding: '9px 12px',
    background: '#FFFFFF', border: `1px solid ${HAIR}`, borderRadius: 5, textDecoration: 'none',
  };

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '20px 24px 60px', fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)' }}>
      <header style={{ marginBottom: 14 }}>
        <a href="/university" style={{ fontSize: 12, color: INK_SOFT, textDecoration: 'none' }}>← TBC University</a>
        <h1 style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 700, color: INK }}>Newsletter</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: INK_SOFT }}>
          Everything about planning, writing, reviewing and sending guest emails.
        </p>
      </header>

      <AskWindow module="newsletter" placeholder='Ask about newsletters — e.g. "Why is my draft only two sentences?"' />

      {loadError && (
        <div style={{ marginTop: 14, fontSize: 12.5, color: '#B03826' }}>Could not load articles: {loadError}</div>
      )}

      {SECTIONS.map((s) => {
        const list = bySection.get(s.key) ?? [];
        if (list.length === 0) return null;
        return (
          <section key={s.key} style={{ marginTop: 22 }}>
            <h2 style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_SOFT }}>
              {s.label}
            </h2>
            {s.hint && <div style={{ fontSize: 11, color: INK_SOFT, marginBottom: 6 }}>{s.hint}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {list.map((a) => (
                <a key={a.slug} href={`/university/newsletter/${a.slug}`} style={row}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: GREEN, whiteSpace: 'nowrap' }}>{a.title}</span>
                  <span style={{ fontSize: 12, color: INK_SOFT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.purpose}</span>
                  {a.audience === 'owner' && (
                    <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#B48A3A', border: '1px solid #B48A3A', borderRadius: 3, padding: '1px 5px' }}>OWNER</span>
                  )}
                </a>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
