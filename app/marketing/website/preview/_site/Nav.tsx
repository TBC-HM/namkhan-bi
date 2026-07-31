// app/marketing/website/preview/_site/Nav.tsx
import Link from 'next/link';

// TODO: replace BOOK_URL with the actual Cloudbeds booking URL from thenamkhan.com
export const BOOK_URL = 'https://hotels.cloudbeds.com/reservation/thenamkhan';

const BASE = '/marketing/website/preview';

const LINKS = [
  { label: 'Stay',        href: '/accommodation' },
  { label: 'Offers',      href: '/offers' },
  { label: 'Wellness',    href: '/wellness-center' },
  { label: 'Retreats',    href: '/retreats' },
  { label: 'Dining',      href: '/dining' },
  { label: 'Experiences', href: '/experiences' },
  { label: 'About',       href: '/about' },
  { label: 'Contact',     href: '/contact' },
];

export function SiteNav({ slug }: { slug: string }) {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: '#FFFFFF', borderBottom: '1px solid #D4C9B0',
      padding: '0 24px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68, gap: 16 }}>
        <Link href={BASE + '/'} style={{ fontFamily: 'Georgia, serif', fontSize: 19, fontWeight: 700, color: '#1C1812', textDecoration: 'none', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
          The Namkhan
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {LINKS.map(l => (
            <Link key={l.href} href={BASE + l.href} style={{
              padding: '6px 11px', fontSize: 13, color: '#3a342a', textDecoration: 'none', fontWeight: 500,
              borderBottom: slug === l.href || slug.startsWith(l.href + '/') ? '2px solid #2C4A3E' : '2px solid transparent',
            }}>{l.label}</Link>
          ))}
          <a href={BOOK_URL} target="_blank" rel="noopener noreferrer" style={{
            marginLeft: 10, padding: '9px 20px', fontSize: 13, fontWeight: 700,
            background: '#1C1812', color: '#FFFFFF', borderRadius: 3, textDecoration: 'none', whiteSpace: 'nowrap',
          }}>Book now</a>
        </div>
      </div>
    </nav>
  );
}

export function PreviewBanner({ slug, generatedAt }: { slug: string; generatedAt?: string | null }) {
  return (
    <div style={{
      background: '#1a1a1a', color: '#c8c0b0', fontSize: '0.78rem',
      padding: '0.55rem 1.25rem', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
    }}>
      <span>
        <strong style={{ color: '#e8e4dc' }}>PREVIEW</strong>
        {' — '}{slug}
        {generatedAt ? ' · crawl ' + new Date(generatedAt).toLocaleDateString() : ''}
        {' · images from hotelierkit CDN · '}
        <Link href="/marketing/website" style={{ color: '#9ca89b', textDecoration: 'underline' }}>← Website editor</Link>
      </span>
      <span style={{ color: '#6a6050', fontSize: '0.72rem' }}>Not the live design — structural preview only</span>
    </div>
  );
}
