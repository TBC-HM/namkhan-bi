// app/marketing/website/preview/[...slug]/page.tsx
// v7 (SEO layer): adds generateMetadata for meta tags (title, description, OG, canonical)
// v6 (CMS-4): adds JSON-LD structured data per page (Hotel for homepage,
// WebPage for others); sections are typed blocks (block catalog, website-module-v1
// CMS v1) rendered via _site/blocks.tsx; nav/footer blocks are skipped as
// chrome. Legacy single 'copy' sections render exactly as v4 (renderMd
// fallback). Photos stay wired from media library (mkt_media_assets);
// room pages use room_type_id FK; others use property_area text match.
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import { SiteNav, PreviewBanner, BOOK_URL, type NavLink } from '../_site/Nav';
import { SiteFooter } from '../_site/Footer';
import { renderBlocks, type BlockRow } from '../_site/blocks';
import { generatePageJsonLd } from '../_site/jsonld';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* eslint-disable @next/next/no-img-element */

export async function generateMetadata({ params }: { params: { slug: string[] } }): Promise<Metadata> {
  const slug = '/' + (params.slug ?? []).join('/');
  const sb = getSupabaseAdmin();
  const baseUrl = 'https://www.thenamkhan.com';
  
  const { data: pd } = await sb.from('v_website_pages')
    .select('*').eq('property_id', PROPERTY_ID).eq('slug', slug).maybeSingle();
  
  if (!pd) {
    return {
      title: 'Not Found',
      description: 'Page not found'
    };
  }
  
  const page = pd as { 
    title: string | null; 
    meta: { seo_title?: string; description?: string; og_image?: string; canonical?: string } | null 
  };
  const meta = page.meta || {};
  
  const title = meta.seo_title || page.title || 'The Namkhan';
  const description = meta.description || '';
  const canonical = meta.canonical || `${baseUrl}${slug}`;
  const ogImage = meta.og_image ? `${baseUrl}${meta.og_image}` : `${baseUrl}/og-default.jpg`;
  
  return {
    title,
    description,
    alternates: {
      canonical
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'The Namkhan',
      images: [{ url: ogImage }],
      type: 'website',
      locale: 'en_US'
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage]
    }
  };
}

/* eslint-disable @next/next/no-img-element */

type PageRow = {
  id: number; slug: string; title: string | null; page_kind: string | null;
  status: string | null; meta: Record<string, unknown> | null;
  room_type_id: number | null; retreat_ref: string | null; updated_at: string | null;
};
type SectionRow = BlockRow;
type ImgMeta   = { id: number; alt: string | null; role: string | null };
type BlogImg   = { page_id: number; role: string | null };
type MediaRow  = { master_path: string | null; caption: string | null; alt_text: string | null; primary_tier: string | null };

const BG    = '#FDFAF5';
const HAIR  = '#D4C9B0';
const INK   = '#1C1812';
const INK2  = '#3a342a';
const CREAM = '#F0EAE0';
const GREEN = '#2C4A3E';
const SERIF = 'Georgia, serif';

// Supabase public storage URL for the media bucket
const STORAGE = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://kpenyneooigsyuuomgct.supabase.co')
  + '/storage/v1/object/public/media';

function mediaUrl(path: string | null): string | null {
  return path ? STORAGE + '/' + path : null;
}

// Slug prefix → property_area for non-room pages
const SLUG_AREA: [string, string][] = [
  ['/spa',                        'The Jungle Spa'],
  ['/wellness-center',            'wellness'],
  ['/eco-farm',                   'Organic Farm'],
  ['/dining/roots-restaurant',    'restaurant'],
  ['/dining/pool-bar',            'Pool Bar'],
  ['/dining/bbq-experience',      'grounds'],
  ['/dining',                     'restaurant'],
  ['/glamping/riverfront-glamping','Riverfront Glamping Tent'],
  ['/glamping/explorer-glamping', 'Explorer Glamping Tent'],
  ['/glamping/the-namkhan-glamping','The Namkhan Glamping Tent'],
  ['/glamping',                   'grounds'],
  ['/rooms',                      'rooms'],
  ['/accommodation',              'rooms'],
  ['/experiences',                'activities'],
  ['/retreats',                   'wellness'],
  ['/sustainability',             'Organic Farm'],
  ['/about',                      'lifestyle'],
  ['/contact',                    'grounds'],
  ['/blog',                       'lifestyle'],
  ['/offers',                     'lifestyle'],
  ['/private-events',             'Parties & Special Events'],
  ['/faq',                        'grounds'],
  ['/travel-trade',               'lifestyle'],
];

function areaForSlug(slug: string): string | null {
  for (const [prefix, area] of SLUG_AREA) {
    if (slug === prefix || slug.startsWith(prefix + '/')) return area;
  }
  return null;
}

// Blank placeholder slot — shown when no media available for a slot
function Photo({ label, aspect = '4/3', h }: { label?: string; aspect?: string; h?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', background: CREAM, ...(h ? { height: h } : { aspectRatio: aspect }), borderRadius: 3 }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(90,80,65,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
      </svg>
      {label && <span style={{ fontSize: 9, color: 'rgba(80,70,55,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>}
    </div>
  );
}

// Real photo or fallback placeholder
function Img({ url, alt, aspect = '4/3', h, style }: { url: string | null; alt?: string | null; aspect?: string; h?: number; style?: React.CSSProperties }) {
  return url
    ? <img src={url} alt={alt ?? ''} style={{ width: '100%', ...(h ? { height: h } : { aspectRatio: aspect }), objectFit: 'cover', borderRadius: 3, ...style }} />
    : <Photo aspect={aspect} h={h} />;
}

function stripTitle(md: string | null): string {
  if (!md) return '';
  return md.replace(/^#\s.+$/m, '').trim();
}

// Extracts the small label from first paragraph of markdown (e.g., "GARDEN VIEW")
function extractLabel(md: string | null): string | null {
  if (!md) return null;
  const m = md.match(/^([A-Z\s&']+)$/m);
  return m ? m[1].trim() : null;
}

// Extracts lead paragraph that follows the label
function extractLead(md: string | null): string | null {
  if (!md) return null;
  const lines = md.split('\n').filter(l => l.trim());
  const lIdx = lines.findIndex(l => /^[A-Z\s&']+$/.test(l.trim()));
  if (lIdx === -1 || lIdx + 1 >= lines.length) return null;
  return lines[lIdx + 1].trim();
}

export default async function WebsiteSlugPage({ params }: { params: { slug: string[] } }) {
  const slug = '/' + (params.slug ?? []).join('/');
  const sb = getSupabaseAdmin();

  const { data: pd } = await sb.from('v_website_pages')
    .select('*').eq('property_id', PROPERTY_ID).eq('slug', slug).maybeSingle();
  if (!pd) return notFound();
  const page = pd as PageRow;

  const [{ data: sd }, { data: imgd }, { data: navd }] = await Promise.all([
    sb.from('v_website_sections').select('id,kind,heading,body_md,sort_order,data')
      .eq('property_id', PROPERTY_ID).eq('page_id', page.id).order('sort_order', { ascending: true }),
    sb.from('v_website_media').select('id,alt,role')
      .eq('property_id', PROPERTY_ID).eq('page_id', page.id),
    sb.from('v_website_nav_menus').select('items')
      .eq('property_id', PROPERTY_ID).eq('menu_key', 'header_main').maybeSingle(),
  ]);
  const navLinks = ((navd as { items?: NavLink[] } | null)?.items ?? null);
  const sections = (sd ?? []) as SectionRow[];
  const crawlImgs = (imgd ?? []) as ImgMeta[];
  const rawBody   = sections.map(s => s.body_md ?? '').join('\n');
  const body      = stripTitle(rawBody);
  const hasHero   = crawlImgs.some(i => i.role === 'hero' || i.role === 'og');
  const galCount  = crawlImgs.filter(i => i.role === 'gallery').length;
  const meta      = (page.meta ?? {}) as Record<string, string>;
  const metaDesc  = meta.description ?? null;

  // Fetch real photos from media library
  const area = areaForSlug(slug);
  let photos: string[] = [];

  if (page.room_type_id) {
    const { data: rd } = await sb.from('mkt_media_assets')
      .select('master_path')
      .eq('property_id', PROPERTY_ID)
      .eq('room_type_id', page.room_type_id)
      .in('asset_tier', ['primary', 'hero', 'detail'])
      .order('asset_tier', { ascending: true })
      .limit(12);
    photos = (rd ?? []).map((r: MediaRow) => mediaUrl(r.master_path) ?? '').filter(Boolean);
  } else if (area) {
    const { data: ad } = await sb.from('mkt_media_assets')
      .select('master_path')
      .eq('property_id', PROPERTY_ID)
      .eq('property_area', area)
      .in('asset_tier', ['primary', 'hero', 'detail'])
      .order('asset_tier', { ascending: true })
      .limit(12);
    photos = (ad ?? []).map((r: MediaRow) => mediaUrl(r.master_path) ?? '').filter(Boolean);
  }

  // Blog index → fetch all blog_post pages
  const kind = page.page_kind;
  let blogPosts: PageRow[] = [];
  const blogHasImg: Record<number, boolean> = {};
  if (kind === 'blog_index') {
    const { data: bpd } = await sb.from('v_website_pages')
      .select('*')
      .eq('property_id', PROPERTY_ID)
      .eq('page_kind', 'blog_post')
      .order('updated_at', { ascending: false });
    blogPosts = (bpd ?? []) as PageRow[];
    const { data: bimgd } = await sb.from('v_website_media')
      .select('page_id,role')
      .eq('property_id', PROPERTY_ID)
      .in('page_id', blogPosts.map(p => p.id))
      .in('role', ['hero', 'og']);
    const blogImgs = (bimgd ?? []) as BlogImg[];
    for (const bi of blogImgs) blogHasImg[bi.page_id] = true;
  }

  const jsonLd = generatePageJsonLd(page, { base_url: 'https://www.thenamkhan.com' });
  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <PreviewBanner slug={slug} />
      <SiteNav slug={slug} links={navLinks} />
      {kind === 'blog_index'  ? <BlogIndex page={page} posts={blogPosts} hasImg={blogHasImg} photos={photos} /> :
       kind === 'blog_post'   ? <BlogPost  page={page} hasHero={hasHero} sections={sections} body={body} heroUrl={photos[0] ?? null} /> :
       kind === 'legal'       ? <Legal     page={page} sections={sections} /> :
       kind === 'room'        ? <Room      page={page} photos={photos} galCount={galCount} sections={sections} body={body} metaDesc={metaDesc} /> :
                                <Core      page={page} hasHero={hasHero} photos={photos} galCount={galCount} sections={sections} body={body} metaDesc={metaDesc} />}
      <SiteFooter />
    </div>
  );
}

// ── Room ───────────────────────────────────────────────────────────────────
function Room({ page, photos, galCount, sections, body, metaDesc }: {
  page: PageRow; photos: string[]; galCount: number; sections: SectionRow[]; body: string; metaDesc: string | null;
}) {
  const heroUrl = photos[0] ?? null;
  const galUrls = photos.slice(1);
  const label   = extractLabel(body);
  const lead    = extractLead(body) ?? metaDesc;

  return (
    <main>
      <div style={{ position: 'relative', width: '100%', height: 640, overflow: 'hidden', background: '#2F2C27' }}>
        {heroUrl && <img src={heroUrl} alt={page.title ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.82 }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.30) 55%, rgba(0,0,0,0.05) 100%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 6% 72px', textAlign: 'center', color: '#FFF' }}>
          {label && <div style={{ fontSize: 12, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 18, opacity: 0.75 }}>{label}</div>}
          <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 4rem)', fontWeight: 700, fontFamily: SERIF, margin: '0 0 20px', lineHeight: 1.1 }}>{page.title}</h1>
          {lead && <p style={{ fontSize: '1.05rem', maxWidth: 580, margin: '0 auto', opacity: 0.88, lineHeight: 1.75 }}>{lead}</p>}
        </div>
      </div>

      <div style={{ background: '#FFF', borderBottom: '1px solid ' + HAIR, padding: '18px 5%' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 1, background: HAIR, border: '1px solid ' + HAIR, borderRadius: 2 }}>
          {['Arrival', 'Departure', 'Guests'].map(l => (
            <div key={l} style={{ background: '#FFF', padding: '11px 16px' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8B7355', marginBottom: 3 }}>{l}</div>
              <div style={{ fontSize: 13, color: '#B0A490' }}>Select date</div>
            </div>
          ))}
          <a href={BOOK_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', padding: '0 28px', background: GREEN, color: '#FFF', textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
            Book Now →
          </a>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '56px 24px 80px' }}>
        {body && <div>{renderBlocks(sections, { stripFirstH1: true })}</div>}
        {galCount > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, marginBottom: 48 }}>
            {Array.from({ length: galCount }).map((_, i) => (
              <Img key={i} url={galUrls[i] ?? null} aspect="4/3" />
            ))}
          </div>
        )}
        <div style={{ padding: '36px', background: CREAM, borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontFamily: SERIF, color: INK, marginBottom: 18 }}>Reserve this room</div>
          <a href={BOOK_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '14px 40px', background: INK, color: '#FFF', textDecoration: 'none', fontWeight: 700, fontSize: 13, borderRadius: 2, letterSpacing: '0.05em' }}>
            Check availability
          </a>
        </div>
      </div>
    </main>
  );
}

// ── Core ───────────────────────────────────────────────────────────────────
function Core({ page, hasHero, photos, galCount, sections, body, metaDesc }: {
  page: PageRow; hasHero: boolean; photos: string[]; galCount: number; sections: SectionRow[]; body: string; metaDesc: string | null;
}) {
  return (
    <main>
      {hasHero && (
        <div style={{ width: '100%', height: 520, overflow: 'hidden', background: '#2F2C27' }}>
          {photos[0] && <img src={photos[0]} alt={page.title ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />}
        </div>
      )}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '52px 24px 80px' }}>
        {!hasHero && <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: INK, fontFamily: SERIF, marginBottom: '1rem', letterSpacing: '-0.02em' }}>{page.title}</h1>}
        {metaDesc && !body && <p style={{ fontSize: '1.1rem', lineHeight: 1.8, color: INK2, marginBottom: '2rem' }}>{metaDesc}</p>}
        {body && <div>{renderBlocks(sections, { stripFirstH1: true })}</div>}
        {galCount > 0 && (
          <div style={{ marginTop: 56, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {Array.from({ length: galCount }).map((_, i) => <Img key={i} url={photos[i + 1] ?? null} />)}
          </div>
        )}
      </div>
    </main>
  );
}

// ── BlogPost ───────────────────────────────────────────────────────────────
function BlogPost({ page, hasHero, sections, body, heroUrl }: {
  page: PageRow; hasHero: boolean; sections: SectionRow[]; body: string; heroUrl: string | null;
}) {
  const meta = (page.meta ?? {}) as Record<string, string>;
  const date = meta.date ?? null;
  return (
    <main>
      {hasHero && heroUrl && (
        <div style={{ width: '100%', height: 480, overflow: 'hidden', background: '#2F2C27' }}>
          <img src={heroUrl} alt={page.title ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.88 }} />
        </div>
      )}
      <article style={{ maxWidth: 720, margin: '0 auto', padding: '52px 24px 80px' }}>
        {date && <div style={{ fontSize: 13, color: '#8B7355', marginBottom: 12 }}>{date}</div>}
        <h1 style={{ fontSize: '2.4rem', fontWeight: 700, color: INK, fontFamily: SERIF, marginBottom: '1.8rem', lineHeight: 1.15 }}>{page.title}</h1>
        <div style={{ fontSize: '1.02rem', lineHeight: 1.85, color: INK2 }}>{renderBlocks(sections, { stripFirstH1: true })}</div>
      </article>
    </main>
  );
}

// ── BlogIndex ──────────────────────────────────────────────────────────────
function BlogIndex({ page, posts, hasImg, photos }: {
  page: PageRow; posts: PageRow[]; hasImg: Record<number, boolean>; photos: string[];
}) {
  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '52px 24px 80px' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: INK, fontFamily: SERIF, marginBottom: '0.5rem' }}>{page.title}</h1>
      <p style={{ fontSize: '1.05rem', color: INK2, marginBottom: '3rem', lineHeight: 1.7 }}>Travel guides, festival calendars, recipes from our farm, and updates from the team.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 28 }}>
        {posts.map((post, idx) => {
          const m = (post.meta ?? {}) as Record<string, string>;
          return (
            <Link key={post.id} href={'/marketing/website/preview' + post.slug} style={{ display: 'block', textDecoration: 'none', border: '1px solid ' + HAIR, borderRadius: 6, overflow: 'hidden', background: '#FFF' }}>
              {hasImg[post.id] && <Img url={photos[idx] ?? null} h={200} style={{ borderRadius: 0 }} />}
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

// ── Legal ──────────────────────────────────────────────────────────────────
function Legal({ page, sections }: { page: PageRow; sections: SectionRow[] }) {
  return (
    <main style={{ maxWidth: 740, margin: '0 auto', padding: '52px 24px 80px' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, color: INK, fontFamily: SERIF, marginBottom: '2rem' }}>{page.title}</h1>
      <div style={{ fontSize: 14, lineHeight: 1.85, color: INK2 }}>{renderBlocks(sections, { stripFirstH1: true })}</div>
    </main>
  );
}
