// app/university/[module]/[slug]/page.tsx
// TBC University · article page, generic for any module. The full reader
// layout per the University design standard: breadcrumbs, type + audience
// badges, title, "What you'll be able to do" outcome box (from purpose),
// rich body (steps / callouts / screenshots / outcome box), related links,
// prev/next within the module reading order, feedback thumbs, version line.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import Markdown from '../../_components/Markdown';
import Feedback from '../../_components/Feedback';
import Breadcrumbs from '../../_components/Breadcrumbs';
import { FALLBACK_MODULES, groupArticles, type ArticleMeta } from '../../_lib/ia';
import { INK, INK_SOFT, HAIR, GREEN, GOLD, WARM, TIP_BG, TIP_BORDER, SANS } from '../../_lib/theme';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Article = {
  slug: string; module: string; article_type: string; title: string; purpose: string;
  audience: string; body_md: string; related: string[] | null; updated_at: string; version: number;
};

const TYPE_LABEL: Record<string, string> = {
  how_to: 'How-to', concept: 'Concept', troubleshooting: 'Troubleshooting', faq: 'FAQ', reference: 'Reference',
};

export default async function ArticlePage({ params }: { params: { module: string; slug: string } }) {
  const moduleSlug = decodeURIComponent(params.module ?? '').toLowerCase();
  const slug = decodeURIComponent(params.slug ?? '');
  let article: Article | null = null;
  let relatedRows: { slug: string; title: string }[] = [];
  let moduleTitle = moduleSlug.charAt(0).toUpperCase() + moduleSlug.slice(1);
  let prev: ArticleMeta | null = null;
  let next: ArticleMeta | null = null;

  try {
    const sb = getSupabaseAdmin();
    const [artRes, siblingsRes, modRes] = await Promise.all([
      sb.from('v_university_articles')
        .select('slug, module, article_type, title, purpose, audience, body_md, related, updated_at, version')
        .eq('slug', slug).eq('lang', 'en').maybeSingle(),
      sb.from('v_university_articles')
        .select('slug, article_type, title, purpose, audience, keywords')
        .eq('module', moduleSlug).eq('lang', 'en'),
      sb.from('v_university_modules').select('title').eq('slug', moduleSlug).maybeSingle(),
    ]);
    article = (artRes.data as Article | null) ?? null;
    const siblings = (siblingsRes.data as ArticleMeta[] | null) ?? [];
    const viewTitle = (modRes.data as { title: string } | null)?.title;
    moduleTitle = viewTitle ?? FALLBACK_MODULES.find((m) => m.slug === moduleSlug)?.title ?? moduleTitle;

    if (article) {
      // prev/next in the module's reading order
      const { flat } = groupArticles(moduleSlug, siblings);
      const idx = flat.findIndex((a) => a.slug === slug);
      if (idx > 0) prev = flat[idx - 1];
      if (idx !== -1 && idx < flat.length - 1) next = flat[idx + 1];

      if (Array.isArray(article.related) && article.related.length > 0) {
        const { data: rel } = await sb.from('v_university_articles')
          .select('slug, title').in('slug', article.related);
        relatedRows = (rel as { slug: string; title: string }[] | null) ?? [];
        relatedRows.sort((a, b) => article!.related!.indexOf(a.slug) - article!.related!.indexOf(b.slug));
      }
    }
  } catch { /* handled below */ }

  if (!article) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px', fontFamily: SANS }}>
        <div style={{
          border: `1.5px dashed ${HAIR}`, borderRadius: 8, background: WARM,
          padding: '30px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, lineHeight: 1 }} aria-hidden>✍️</div>
          <div style={{ marginTop: 10, fontSize: 15, fontWeight: 600, color: INK }}>
            This article isn&rsquo;t ready yet.
          </div>
          <div style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.6, color: INK_SOFT }}>
            It may still be being written, or the link is old. Ask your question on the module page —
            the guide will answer from the articles that already exist.
          </div>
          <a href={`/university/${moduleSlug}`} style={{ display: 'inline-block', marginTop: 14, fontSize: 13.5, fontWeight: 600, color: GREEN, textDecoration: 'none' }}>
            ← Back to the {moduleTitle} guide
          </a>
        </div>
      </div>
    );
  }

  const navLink = (a: ArticleMeta, dir: 'prev' | 'next') => (
    <a href={`/university/${moduleSlug}/${a.slug}`} style={{
      flex: 1, display: 'flex', flexDirection: 'column', gap: 3, textDecoration: 'none',
      border: `1px solid ${HAIR}`, borderRadius: 6, padding: '10px 14px', background: '#FFFFFF',
      textAlign: dir === 'next' ? 'right' : 'left',
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_SOFT }}>
        {dir === 'prev' ? '← Previous' : 'Next →'}
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: GREEN, lineHeight: 1.4 }}>{a.title}</span>
    </a>
  );

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 24px 60px', fontFamily: SANS }}>
      <Breadcrumbs items={[
        { label: 'TBC University', href: '/university' },
        { label: moduleTitle, href: `/university/${moduleSlug}` },
        { label: article.title },
      ]} />

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF', background: GREEN, borderRadius: 3, padding: '2px 7px' }}>
          {TYPE_LABEL[article.article_type] ?? article.article_type}
        </span>
        {article.audience === 'owner' && (
          <span style={{ fontSize: 10, fontWeight: 700, color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 3, padding: '1px 6px' }}>OWNER</span>
        )}
      </div>

      <h1 style={{ margin: '10px 0 0', fontSize: 25, fontWeight: 700, color: INK, lineHeight: 1.3 }}>{article.title}</h1>

      {article.purpose && (
        <div style={{
          margin: '14px 0 18px', background: TIP_BG, border: `1px solid ${TIP_BORDER}`,
          borderRadius: 6, padding: '12px 16px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: GREEN, marginBottom: 5 }}>
            <span aria-hidden style={{ marginRight: 6 }}>🎯</span>What you&rsquo;ll be able to do
          </div>
          <div style={{ fontSize: 14.5, lineHeight: 1.6, color: INK }}>{article.purpose}</div>
        </div>
      )}

      <div style={{ background: '#FFFFFF', border: `1px solid ${HAIR}`, borderRadius: 8, padding: '22px 26px' }}>
        <Markdown md={article.body_md} />
      </div>

      {relatedRows.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_SOFT, marginBottom: 7 }}>
            Keep reading
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {relatedRows.map((r) => (
              <a key={r.slug} href={`/university/${moduleSlug}/${r.slug}`} style={{ fontSize: 13.5, fontWeight: 600, color: GREEN, textDecoration: 'none' }}>
                → {r.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {(prev || next) && (
        <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
          {prev ? navLink(prev, 'prev') : <div style={{ flex: 1 }} />}
          {next ? navLink(next, 'next') : <div style={{ flex: 1 }} />}
        </div>
      )}

      <Feedback slug={article.slug} module={article.module} />

      <div style={{ marginTop: 10, fontSize: 10.5, color: '#8A8A8A' }}>
        v{article.version} · updated {new Date(article.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · owner PBS
      </div>
    </div>
  );
}
