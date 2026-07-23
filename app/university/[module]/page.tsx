// app/university/[module]/page.tsx
// TBC University · generic module guide. Works for ANY module slug — module
// identity comes from public.v_university_modules (fallback list until the
// view ships), articles from public.v_university_articles. Grouped IA
// sections per _lib/ia.ts; a module with no live articles gets a friendly
// "being written" state instead of an empty page.

import type { CSSProperties } from 'react';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import AskWindow from '../_components/AskWindow';
import Breadcrumbs from '../_components/Breadcrumbs';
import { FALLBACK_MODULES, groupArticles, type ArticleMeta, type ModuleCard } from '../_lib/ia';
import { INK, INK_SOFT, HAIR, GREEN, GOLD, WARM, SANS } from '../_lib/theme';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ModuleGuidePage({ params }: { params: { module: string } }) {
  const moduleSlug = decodeURIComponent(params.module ?? '').toLowerCase();
  let mod: ModuleCard | null = null;
  let articles: ArticleMeta[] = [];
  let loadError: string | null = null;

  try {
    const sb = getSupabaseAdmin();
    const [modRes, artRes] = await Promise.all([
      sb.from('v_university_modules')
        .select('slug, title, description, icon_hint, status, sort_order, dept, audience')
        .eq('slug', moduleSlug).maybeSingle(),
      sb.from('v_university_articles')
        .select('slug, article_type, title, purpose, audience, keywords')
        .eq('module', moduleSlug).eq('lang', 'en'),
    ]);
    mod = (modRes.data as ModuleCard | null) ?? null;
    if (artRes.error) loadError = artRes.error.message;
    articles = (artRes.data as ArticleMeta[] | null) ?? [];
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'load failed';
  }
  if (!mod) mod = FALLBACK_MODULES.find((m) => m.slug === moduleSlug) ?? null;

  const title = mod?.title ?? moduleSlug.charAt(0).toUpperCase() + moduleSlug.slice(1);
  const { sections } = groupArticles(moduleSlug, articles);

  const row: CSSProperties = {
    display: 'flex', alignItems: 'baseline', gap: 10, padding: '11px 14px',
    background: '#FFFFFF', border: `1px solid ${HAIR}`, borderRadius: 6, textDecoration: 'none',
  };

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '20px 24px 60px', fontFamily: SANS }}>
      <header style={{ marginBottom: 14 }}>
        <Breadcrumbs items={[{ label: 'TBC University', href: '/university' }, { label: title }]} />
        <h1 style={{ margin: '8px 0 0', fontSize: 24, fontWeight: 700, color: INK }}>{title}</h1>
        {mod?.description && (
          <p style={{ margin: '5px 0 0', fontSize: 14.5, lineHeight: 1.6, color: INK_SOFT }}>{mod.description}</p>
        )}
      </header>

      <AskWindow module={moduleSlug} placeholder={`Ask about ${title.toLowerCase()} — plain words are fine.`} />

      {loadError && (
        <div style={{ marginTop: 14, fontSize: 13, color: '#B03826' }}>Could not load articles: {loadError}</div>
      )}

      {articles.length === 0 && !loadError && (
        <div style={{
          marginTop: 20, border: `1.5px dashed ${HAIR}`, borderRadius: 8, background: WARM,
          padding: '30px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, lineHeight: 1 }} aria-hidden>✍️</div>
          <div style={{ marginTop: 10, fontSize: 15, fontWeight: 600, color: INK }}>
            This guide is being written.
          </div>
          <div style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.6, color: INK_SOFT }}>
            The articles for {title} are on the way. In the meantime, ask your question in the box above —
            or ask PBS directly. Your question also tells us what to write first.
          </div>
        </div>
      )}

      {sections.map((s) => (
        <section key={s.key} style={{ marginTop: 24 }}>
          <h2 style={{ margin: '0 0 2px', fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_SOFT }}>
            {s.label}
          </h2>
          {s.hint && <div style={{ fontSize: 11.5, color: INK_SOFT, marginBottom: 6 }}>{s.hint}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 7 }}>
            {s.articles.map((a) => (
              <a key={a.slug} href={`/university/${moduleSlug}/${a.slug}`} style={row}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: GREEN, whiteSpace: 'nowrap' }}>{a.title}</span>
                <span style={{ fontSize: 12.5, color: INK_SOFT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.purpose}</span>
                {a.audience === 'owner' && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 3, padding: '1px 5px', flex: 'none' }}>OWNER</span>
                )}
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
