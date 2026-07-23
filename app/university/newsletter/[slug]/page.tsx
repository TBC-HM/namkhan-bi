// app/university/newsletter/[slug]/page.tsx
// TBC University · article page. Title, purpose line, rendered body_md,
// related links, "Was this helpful?" thumbs (feeds the question log).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import Markdown from '../../_components/Markdown';
import Feedback from '../../_components/Feedback';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const HAIR = '#E6DFCC';
const GREEN = '#084838';

type Article = {
  slug: string; module: string; article_type: string; title: string; purpose: string;
  audience: string; body_md: string; related: string[] | null; updated_at: string; version: number;
};

const TYPE_LABEL: Record<string, string> = {
  how_to: 'How-to', concept: 'Concept', troubleshooting: 'Troubleshooting', faq: 'FAQ', reference: 'Reference',
};

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug ?? '');
  let article: Article | null = null;
  let relatedRows: { slug: string; title: string }[] = [];

  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from('v_university_articles')
      .select('slug, module, article_type, title, purpose, audience, body_md, related, updated_at, version')
      .eq('slug', slug).eq('lang', 'en').maybeSingle();
    article = (data as Article | null) ?? null;
    if (article && Array.isArray(article.related) && article.related.length > 0) {
      const { data: rel } = await sb.from('v_university_articles')
        .select('slug, title').in('slug', article.related);
      relatedRows = (rel as { slug: string; title: string }[] | null) ?? [];
      relatedRows.sort((a, b) => article!.related!.indexOf(a.slug) - article!.related!.indexOf(b.slug));
    }
  } catch { /* handled below */ }

  if (!article) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px', fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)' }}>
        <p style={{ fontSize: 14, color: INK_SOFT }}>Article not found.</p>
        <a href="/university/newsletter" style={{ fontSize: 13, color: GREEN }}>← Back to the Newsletter guide</a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 24px 60px', fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)' }}>
      <a href="/university/newsletter" style={{ fontSize: 12, color: INK_SOFT, textDecoration: 'none' }}>← Newsletter guide</a>

      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FFFFFF', background: GREEN, borderRadius: 3, padding: '2px 7px' }}>
          {TYPE_LABEL[article.article_type] ?? article.article_type}
        </span>
        {article.audience === 'owner' && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#B48A3A', border: '1px solid #B48A3A', borderRadius: 3, padding: '1px 6px' }}>OWNER</span>
        )}
      </div>

      <h1 style={{ margin: '8px 0 4px', fontSize: 22, fontWeight: 700, color: INK, lineHeight: 1.25 }}>{article.title}</h1>
      <p style={{ margin: '0 0 16px', fontSize: 13.5, color: INK_SOFT, fontStyle: 'italic' }}>{article.purpose}</p>

      <div style={{ background: '#FFFFFF', border: `1px solid ${HAIR}`, borderRadius: 6, padding: '18px 20px' }}>
        <Markdown md={article.body_md} />
      </div>

      {relatedRows.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_SOFT, marginBottom: 6 }}>Related</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {relatedRows.map((r) => (
              <a key={r.slug} href={`/university/newsletter/${r.slug}`} style={{ fontSize: 13, color: GREEN, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                {r.title}
              </a>
            ))}
          </div>
        </div>
      )}

      <Feedback slug={article.slug} module={article.module} />

      <div style={{ marginTop: 10, fontSize: 10.5, color: '#8A8A8A' }}>
        v{article.version} · updated {new Date(article.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · owner PBS
      </div>
    </div>
  );
}
