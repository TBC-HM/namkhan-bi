// app/marketing/website/preview/[...slug]/page.tsx
// v4: photos wired from media library (mkt_media_assets). Placeholder shown
// when no photo available for a slot. Room pages use room_type_id FK;
// others use property_area text match.
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import { SiteNav, PreviewBanner, BOOK_URL } from '../_site/Nav';
import { SiteFooter } from '../_site/Footer';
import { renderMd } from '../_site/md';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* eslint-disable @next/next/no-img-element */

type PageRow = {
  id: number; slug: string; title: string | null; page_kind: string | null;
  status: string | null; meta: Record<string, unknown> | null;
  room_type_id: number | null; retreat_ref: string | null; updated_at: string | null;
};
type SectionRow = { id: number; heading: string | null; body_md: string | null; sort_order: number | null };
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
function Photo({ aspect = '4/3', h, label }: { aspect?: string; h?: number; label?: string }) {
  return (
    <div style={{ width: '100%', background: '#C9C0AF', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 5, ...(h ? { height: h } : { aspectRatio: aspect }) }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(100,90,75,0.45)" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
      </svg>
      {label && <span style={{ fontSize: 9, color: 'rgba(80,70,55,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>}
    </div>
  );
}

// Real photo or fallback placeholder
function Img({ url, alt, aspect = '4/3', h, style }: { url: string | null; alt?: string | null; aspect?: string; h?: number; style?: React.CSSProperties }) {
  if (url) {
    return <img src={url} alt={alt ?? ''} style={{ width: '100%', objectFit: 'cover', borderRadius: 3, ...(h ? { height: h } : { aspectRatio: aspect }), ...style }} />;
  }
  return <Photo aspect={aspect} h={h} />;
}

function stripTitle(md: string): string { return md.replace(/^#\s+[^\n]+\n*/, ''); }
function extractLabel(md: string): string | null { const m = md.match(/^##\s+(.+)/m); return m ? m[1].trim() : null; }
function extractLead(md: string): string | null {
  const m = md.match(/^(?:[#][^\n]+\n+)+([^\n#][^\n]{15,})/m);
  if (m) return m[1].trim();
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

  const [{ data: sd }, { data: imgd }] = await Promise.all([
    sb.from('v_website_sections').select('id,heading,body_md,sort_order')
      .eq('property_id', PROPERTY_ID).eq('page_id', page.id).order('sort_order', { ascending: true }),
    sb.from('v_website_media').select('id,alt,role')
      .eq('property_id', PROPERTY_ID).eq('page_id', page.id),
  ]);
  const sections = (sd ?? []) as SectionRow[];
  const crawlImgs = (imgd ?? []) as ImgMeta[];
  const rawBody   = sections[0]?.body_md ?? '';
  const body      = stripTitle(rawBody);
  const hasHero   = crawlImgs.some(i => i.role === 'hero' || i.role === 'og');
  const galCount  = crawlImgs.filter(i => i.role === 'gallery').length;
  const meta      = (page.meta ?? {}) as Record<string, string>;
  const metaDesc  = meta.description ?? null;

  // Fetch real photos from media library
  const area = areaForSlug(slug);
  let photos: string[] = [];

  if (page.room_type_id) {
    // Room: query by room_type_id FK
    const { data } = await sb.from('mkt_media_assets')
      .select('master_path')
      .eq('property_id', PROPERTY_ID)
      .eq('room_type_id', page.room_type_id)
      .eq('status', 'ready')
      .eq('asset_type', 'photo')
      .not('master_path', 'is', null)
      .order('primary_tier', { ascending: true })
      .limit(14);
    photos = ((data ?? []) as MediaRow[]).map(r => mediaUrl(r.master_path)).filter(Boolean) as string[];
  } else if (area) {
    // Other pages: query by property_area
    const { data } = await sb.from('mkt_media_assets')
      .select('master_path')
      .eq('property_id', PROPERTY_ID)
      .eq('property_area', area)
      .eq('status', 'ready')
      .eq('asset_type', 'photo')
      .not('master_path', 'is', null)
      .limit(12);
    photos = ((data ?? []) as MediaRow[]).map(r => mediaUrl(r.master_path)).filter(Boolean) as string[];
  }

  // Blog index
  let blogPosts: PageRow[] = [];
  let blogHasImg: Record<number, boolean> = {};
  if (page.page_kind === 'blog_index') {
    const { data: bp } = await sb.from('v_website_pages')
      .select('id,slug,title,page_kind,status,meta,room_type_id,retreat_ref,updated_at')
      .eq('property_id', PROPERTY_ID).eq('page_kind', 'blog_post')
      .order('updated_at', { ascending: false });
    blogPosts = (bp ?? []) as PageRow[];
    if (blogPosts.length) {
      const ids = blogPosts.map(p => p.id);
      const { data: bi } = await sb.from('v_website_media')
        .select('page_id,role').eq('property_id', PROPERTY_ID).in('page_id', ids);
      for (const r of (bi ?? []) as BlogImg[]) {
        if (!blogHasImg[r.page_id]) blogHasImg[r.page_id] = true;
      }
    }
  }

  const kind = page.page_kind;
  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <PreviewBanner slug={slug} />
      <SiteNav slug={slug} />
      {kind === 'blog_index'  ? <BlogIndex page={page} posts={blogPosts} hasImg={blogHasImg} photos={photos} /> :
       kind === 'blog_post'   ? <BlogPost  page={page} hasHero={hasHero} body={body} heroUrl={photos[0] ?? null} /> :
       kind === 'legal'       ? <Legal     page={page} body={body} /> :
       kind === 'room'        ? <Room      page={page} photos={photos} galCount={galCount} body={body} metaDesc={metaDesc} /> :
                                <Core      page={page} hasHero={hasHero} photos={photos} galCount={galCount} body={body} metaDesc={metaDesc} />}
      <SiteFooter />
    </div>
  );
}

// ── Room ───────────────────────────────────────────────────────────────────
function Room({ page, photos, galCount, body, metaDesc }: {
  page: PageRow; photos: string[]; galCount: number; body: string; metaDesc: string | null;
}) {
  const heroUrl = photos[0] ?? null;
  const galUrls = photos.slice(1);
  const label   = extractLabel(body);
  const lead    = extractLead(body) ?? metaDesc;

  return (
    <main>
      {/* Hero */}
      <div style={{ position: 'relative', width: '100%', height: 640, overflow: 'hidden', background: '#2F2C27' }}>
        {heroUrl && <img src={heroUrl} alt={page.title ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.82 }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.30) 55%, rgba(0,0,0,0.05) 100%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 6% 72px', textAlign: 'center', color: '#FFF' }}>
          {label && <div style={{ fontSize: 12, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 18, opacity: 0.75 }}>{label}</div>}
          <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 4rem)', fontWeight: 700, fontFamily: SERIF, margin: '0 0 20px', lineHeight: 1.1 }}>{page.title}</h1>
          {lead && <p style={{ fontSize: '1.05rem', maxWidth: 580, margin: '0 auto', opacity: 0.88, lineHeight: 1.75 }}>{lead}</p>}
        </div>
      </div>

      {/* Booking widget */}
      <div style={{ background: '#FFF', borderBottom: '1px solid ' + HAIR, padding: '18px 5%' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 1, background: HAIR, border: '1px solid ' + HAIR, borderRadius: 2 }}>
          {['Arrival', 'Departure', 'Guests'].map(l => (
            <div key={l} style={{ background: '#FFF', padding: '11px 16px' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8B7355', marginBottom: 3 }}>{l}</div>
              <div style={{ fontSize: 13, color: '#B0A490' }}>Select date</div>
            </div>
          ))}
          <a href={BOOK_URL} target="_blank" rel="noopener noreferrer" style={{ background: INK, color: '#FFF', padding: '11px 24px', textDecoration: 'none', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}>
            Check availability
          </a>
        </div>
      </div>

      {/* Body + gallery */}
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '52px 24px 80px' }}>
        <div style={{ marginBottom: 40 }}>{renderMd(body)}</div>
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
function Core({ page, hasHero, photos, galCount, body, metaDesc }: {
  page: PageRow; hasHero: boolean; photos: string[]; galCount: number; body: string; metaDesc: string | null;
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
        {body && <div>{renderMd(body)}</div>}
        {galCount > 0 && (
          <div style={{ marginTop: 56, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {Array.from({ length: galCount }).map((_, i) => <Img key={i} url={photos[i + 1] ?? null} />)}
          </div>
        )}
      </div>
    </main>
  );
}

// ── Blog post ──────────────────────────────────────────────────────────────
function BlogPost({ page, hasHero, body, heroUrl }: { page: PageRow; hasHero: boolean; body: string; heroUrl: string | null }) {
  const date = (page.meta as Record<string, string>)?.date ?? null;
  return (
    <main>
      {hasHero && <Img url={heroUrl} h={460} style={{ borderRadius: 0 }} />}
      <div style={{ maxWidth: 740, margin: '0 auto', padding: '48px 24px 80px' }}>
        <Link href="/marketing/website/preview/blog" style={{ fontSize: 12, color: GREEN, textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 24 }}>← The Namkhan Journal</Link>
        {date && <div style={{ fontSize: 13, color: '#8B7355', marginBottom: 8 }}>{date}</div>}
        <h1 style={{ fontSize: '2.2rem', fontWeight: 700, color: INK, fontFamily: SERIF, marginBottom: '1.5rem', lineHeight: 1.3, letterSpacing: '-0.02em' }}>{page.title}</h1>
        <div>{renderMd(body)}</div>
      </div>
    </main>
  );
}

// ── Blog index ─────────────────────────────────────────────────────────────
function BlogIndex({ page, posts, hasImg, photos }: { page: PageRow; posts: PageRow[]; hasImg: Record<number, boolean>; photos: string[] }) {
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
function Legal({ page, body }: { page: PageRow; body: string }) {
  return (
    <main style={{ maxWidth: 740, margin: '0 auto', padding: '52px 24px 80px' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, color: INK, fontFamily: SERIF, marginBottom: '2rem' }}>{page.title}</h1>
      <div style={{ fontSize: 14, lineHeight: 1.85, color: INK2 }}>{renderMd(body)}</div>
    </main>
  );
}
