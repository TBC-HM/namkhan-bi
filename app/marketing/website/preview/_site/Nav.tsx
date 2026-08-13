// app/marketing/website/preview/_site/Nav.tsx
// v2: olive-green nav matching thenamkhan.com
import Link from 'next/link';

export const BOOK_URL = 'https://hotels.cloudbeds.com/en/reservation/lKAMWp?hkc=a0m0';

const BASE = '/marketing/website/preview';

// Olive green matching thenamkhan.com
const NAV_BG   = '#3A4633';
const NAV_TEXT = '#FFFFFF';

export type NavLink = { label: string; href: string };

// Fallback only — the live menu is website.nav_menus (menu_key='header_main'),
// edited in /marketing/website → Header Navigation and passed in via `links`.
const DEFAULT_LINKS: NavLink[] = [
  { label: 'Stay',        href: '/accommodation' },
  { label: 'Offers',      href: '/offers' },
  { label: 'Wellness',    href: '/wellness-center' },
  { label: 'Retreats',    href: '/retreats' },
  { label: 'Dining',      href: '/dining' },
  { label: 'Experiences', href: '/experiences' },
  { label: 'About',       href: '/about' },
  { label: 'Contact',     href: '/contact' },
];

export function SiteNav({ slug, links }: { slug: string; links?: NavLink[] | null }) {
  const LINKS = links && links.length ? links : DEFAULT_LINKS;
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: NAV_BG,
      padding: '0 24px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72, gap: 16 }}>
        {/* Logo */}
        <Link href={BASE + '/'} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: NAV_TEXT, letterSpacing: '0.05em', textTransform: 'uppercase' }}>The Namkhan</span>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 9, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 3 }}>Luang Prabang</span>
        </Link>
        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {LINKS.map(l => (
            <Link key={l.href} href={BASE + l.href} style={{
              padding: '6px 11px', fontSize: 13, color: NAV_TEXT, textDecoration: 'none', fontWeight: 400,
              opacity: slug === l.href || slug.startsWith(l.href + '/') ? 1 : 0.85,
              borderBottom: slug === l.href || slug.startsWith(l.href + '/') ? '1px solid rgba(255,255,255,0.6)' : '1px solid transparent',
            }}>{l.label}</Link>
          ))}
          <a href={BOOK_URL} target="_blank" rel="noopener noreferrer" style={{
            marginLeft: 12, padding: '8px 20px', fontSize: 13, fontWeight: 600,
            background: 'rgba(255,255,255,0.12)', color: NAV_TEXT,
            border: '1px solid rgba(255,255,255,0.35)',
            borderRadius: 2, textDecoration: 'none', whiteSpace: 'nowrap',
          }}>Book now</a>
        </div>
      </div>
    </nav>
  );
}

export function PreviewBanner({ slug }: { slug: string; generatedAt?: string | null }) {
  return (
    <div style={{
      background: '#111', color: '#888', fontSize: '0.72rem',
      padding: '0.45rem 1.25rem', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
    }}>
      <span>
        <strong style={{ color: '#ccc' }}>PREVIEW</strong>{' — '}{slug}{' · '}
        <Link href="/marketing/website" style={{ color: '#666', textDecoration: 'underline' }}>← Website editor</Link>
      </span>
      <span>Photos: blank placeholders — media library wiring pending</span>
    </div>
  );
}
