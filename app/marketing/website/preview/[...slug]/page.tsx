/* eslint-disable @next/next/no-img-element */
// app/marketing/website/preview/[...slug]/page.tsx
// v2: fix duplicate title + room hero overlay matching thenamkhan.com layout.
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import { SiteNav, PreviewBanner, BOOK_URL } from '../_site/Nav';
import { SiteFooter } from '../_site/Footer';
import { renderMd } from '../_site/md';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageRow = {
  id: number; slug: string; title: string | null; page_kind: string | null;
  status: string | null; meta: Record<string, unknown> | null;
  room_type_id: number | null; retreat_ref: string | null; updated_at: string | null;
};
type SectionRow = { id: number; heading: string | null; body_md: string | null; sort_order: number | null };
type ImageRow  = { id: number; src_url: string | null; alt: string | null; role: string | null };
type BlogImg   = { page_id: number; src_url: string | null; role: string | null };

const BG   = '#FDFAF5';
const HAIR = '#D4C9B0';
const INK  = '#1C1812';
const INK2 = '#3a342a';
const CREAM= '#F0EAE0';
const GREEN= '#2C4A3E';
const SERIF= 'Georgia, serif';

// Strips the leading "# Page Title" from crawled body_md — it's always present
// and duplicates the title we already render separately.
function stripTitle(md: string): string {
  return md.replace(/^#\s+[^\n]+\n*/, '');
}

// From body_md, extracts the first "## Subtitle" label (e.g. "Garden View").
function extractLabel(md: string): string | null {
  const m = md.match(/^##\s+(.+)/m);
  return m ? m[1].trim() : null;
}

// Extracts the first substantial paragraph after any headings.
function extractLead(md: string): string | null {
  const m = md.match(/^(?:[#][^\n]+\n+)+([^\n#][^\n]{15,})/m);
  if (m) return m[1].trim();
  // fallback: first non-heading, non-empty line
  const m2 = md.match(/^(?!#)([^\n]{20,})/m);
  return m2 ? m2[1].trim() : null;
}

export default async function WebsiteSlugPage({ params }: { params: { slug: string[] } }) {
  const slug = '/' + (params.slug ?? []).join('/');
  const sb = getSupabaseAdmin();

  const { data: pd } = await sb.from('v_website_pages')
    .select('*').eq('property_id', PROPERTY_ID).eq('slug', slug).maybeSingle();
  if (!pd) return notFound();
  const page = pd as PageRow;

  const [{ data: sd }, { data: id }] = await Promise.all([
    sb.from('v_website_sections').select('id,heading,body_md,sort_order')
      .eq('property_id', PROPERTY_ID).eq('page_id', page.id).order('sort_order', { ascending: true }),
    sb.from('v_website_media').select('id,src_url,alt,role')
      .eq('property_id', PROPERTY_ID).eq('page_id', page.id),
  ]);
  const sections = (sd ?? []) as SectionRow[];
  const images   = (id ?? []) as ImageRow[];
  const rawBody  = sections[0]?.body_md ?? '';
  const body     = stripTitle(rawBody);
  const hero     = images.find(i => i.role === 'hero') ?? images.find(i => i.role === 'og') ?? null;
  const gallery  = images.filter(i => i.role === 'gallery');
  const meta     = (page.meta ?? {}) as Record<string, string>;
  const metaDesc = meta.description ?? null;

  let blogPosts: PageRow[] = [];
  let blogImgs: Record<number, string | null> = {};
  if (page.page_kind === 'blog_index') {
    const { data: bp } = await sb.from('v_website_pages')
      .select('id,slug,title,page_kind,status,meta,room_type_id,retreat_ref,updated_at')
      .eq('property_id', PROPERTY_ID).eq('page_kind', 'blog_post')
      .order('updated_at', { ascending: false });
    blogPosts = (bp ?? []) as PageRow[];
    if (blogPosts.length) {
      const ids = blogPosts.map(p => p.id);
      const { data: bi } = await sb.from('v_website_media')
        .select('page_id,src_url,role').eq('property_id', PROPERTY_ID).in('page_id', ids);
      for (const r of (bi ?? []) as BlogImg[]) {
        if (!blogImgs[r.page_id] && r.src_url) blogImgs[r.page_id] = r.src_url;
      }
    }
  }

  const kind = page.page_kind;
  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <PreviewBanner slug={slug} />
      <SiteNav slug={slug} />
      {kind === 'blog_index'  ? <BlogIndex page={page} posts={blogPosts} imgs={blogImgs} /> :
       kind === 'blog_post'   ? <BlogPost  page={page} hero={hero} body={body} /> :
       kind === 'legal'       ? <Legal     page={page} body={body} /> :
       kind === 'room'        ? <Room      page={page} hero={hero ?? gallery[0] ?? null} gallery={gallery} body={body} metaDesc={metaDesc} /> :
                                <Core      page={page} hero={hero} gallery={gallery} body={body} metaDesc={metaDesc} />}
      <SiteFooter />
    </div>
  );
}

// ── Room template — hero overlay matching thenamkhan.com layout ────────────
function Room({ page, hero, gallery, body, metaDesc }: {
  page: PageRow; hero: ImageRow | null; gallery: ImageRow[]; body: string; metaDesc: string | null;
}) {
  const rest  = hero ? gallery.filter(i => i.id !== hero.id) : gallery;
  const label = extractLabel(body);          // "Garden View"
  const lead  = extractLead(body) ?? metaDesc; // "38m² of considered space..."

  return (
    <main>
      {/* Hero with overlay — title/label/description layered on dark image */}
      <div style={{ position: 'relative', width: '100%', height: 640, overflow: 'hidden', background: '#2a2620' }}>
        {hero?.src_url && (
          <img src={hero.src_url} alt={hero.alt ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
        )}
        {/* Bottom gradient */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.10) 100%)' }} />
        {/* Overlay text */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 6% 72px', textAlign: 'center', color: '#FFFFFF' }}>
          {label && (
            <div style={{ fontSize: 12, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 18, opacity: 0.8, fontWeight: 500 }}>
              {label}
            </div>
          )}
          <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 4rem)', fontWeight: 700, fontFamily: SERIF, margin: '0 0 20px', letterSpacing: '-0.01em', lineHeight: 1.1, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
            {page.title}
          </h1>
          {lead && (
            <p style={{ fontSize: '1.05rem', maxWidth: 580, margin: '0 auto', opacity: 0.88, lineHeight: 1.75, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
              {lead}
            </p>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: '0 auto', padding: '52px 24px 80px' }}>
        <div style={{ marginBottom: 40 }}>{renderMd(body)}</div>
        {rest.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, marginBottom: 48 }}>
            {rest.map(img => img.src_url && (
              <img key={img.id} src={img.src_url} alt={img.alt ?? ''} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 3 }} />
            ))}
          </div>
        )}
        <div style={{ padding: '36px', background: CREAM, borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontFamily: SERIF, color: INK, marginBottom: 18 }}>Reserve this room</div>
          <a href={BOOK_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '14px 40px', background: INK, color: '#FFF', textDecoration: 'none', fontWeight: 700, fontSize: 13, borderRadius: 3, letterSpacing: '0.05em' }}>
            Check availability
          </a>
        </div>
      </div>
    </main>
  );
}

// ── Core template ──────────────────────────────────────────────────────────
function Core({ page, hero, gallery, body, metaDesc }: {
  page: PageRow; hero: ImageRow | null; gallery: ImageRow[]; body: string; metaDesc: string | null;
}) {
  return (
    <main>
      {hero?.src_url && (
        <div style={{ width: '100%', height: 500, overflow: 'hidden', background: INK }}>
          <img src={hero.src_url} alt={hero.alt ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />
        </div>
      )}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '52px 24px 80px' }}>
        {!hero && (
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: INK, fontFamily: SERIF, marginBottom: '1rem', letterSpacing: '-0.02em' }}>
            {page.title}
          </h1>
        )}
        {metaDesc && !body && <p style={{ fontSize: '1.1rem', lineHeight: 1.8, color: INK2, marginBottom: '2rem' }}>{metaDesc}</p>}
        {body && <div>{renderMd(body)}</div>}
        {gallery.length > 0 && (
          <div style={{ marginTop: 56, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {gallery.map(img => img.src_url && (
              <img key={img.id} src={img.src_url} alt={img.alt ?? ''} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 3 }} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// ── Blog post template ─────────────────────────────────────────────────────
function BlogPost({ page, hero, body }: { page: PageRow; hero: ImageRow | null; body: string }) {
  const date = (page.meta as Record<string, string>)?.date ?? null;
  return (
    <main>
      {hero?.src_url && (
        <div style={{ width: '100%', height: 460, overflow: 'hidden', background: INK }}>
          <img src={hero.src_url} alt={hero.alt ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
      <div style={{ maxWidth: 740, margin: '0 auto', padding: '48px 24px 80px' }}>
        <Link href="/marketing/website/preview/blog" style={{ fontSize: 12, color: GREEN, textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 24 }}>
          ← The Namkhan Journal
        </Link>
        {date && <div style={{ fontSize: 13, color: '#8B7355', marginBottom: 8 }}>{date}</div>}
        <h1 style={{ fontSize: '2.2rem', fontWeight: 700, color: INK, fontFamily: SERIF, marginBottom: '1.5rem', lineHeight: 1.3, letterSpacing: '-0.02em' }}>
          {page.title}
        </h1>
        <div>{renderMd(body)}</div>
      </div>
    </main>
  );
}

// ── Blog index template ────────────────────────────────────────────────────
function BlogIndex({ page, posts, imgs }: { page: PageRow; posts: PageRow[]; imgs: Record<number, string | null> }) {
  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '52px 24px 80px' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: INK, fontFamily: SERIF, marginBottom: '0.5rem' }}>{page.title}</h1>
      <p style={{ fontSize: '1.05rem', color: INK2, marginBottom: '3rem', lineHeight: 1.7 }}>
        Travel guides, festival calendars, recipes from our farm, and updates from the team.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 28 }}>
        {posts.map(post => {
          const m = (post.meta ?? {}) as Record<string, string>;
          return (
            <Link key={post.id} href={'/marketing/website/preview' + post.slug}
              style={{ display: 'block', textDecoration: 'none', border: '1px solid ' + HAIR, borderRadius: 6, overflow: 'hidden', background: '#FFF' }}>
              {imgs[post.id] && (
                <img src={imgs[post.id]!} alt={post.title ?? ''} style={{ width: '100%', height: 200, objectFit: 'cover' }} />
              )}
              <div style={{ padding: '16px 18px 20px' }}>
                {m.date && <div style={{ fontSize: 12, color: '#8B7355', marginBottom: 6 }}>{m.date}</div>}
                <div style={{ fontSize: '1rem', fontWeight: 600, color: INK, lineHeight: 1.45, fontFamily: SERIF }}>{post.title}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

// ── Legal template ─────────────────────────────────────────────────────────
function Legal({ page, body }: { page: PageRow; body: string }) {
  return (
    <main style={{ maxWidth: 740, margin: '0 auto', padding: '52px 24px 80px' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, color: INK, fontFamily: SERIF, marginBottom: '2rem' }}>{page.title}</h1>
      <div style={{ fontSize: 14, lineHeight: 1.85, color: INK2 }}>{renderMd(body)}</div>
    </main>
  );
}
