// app/marketing/website/preview/_site/Footer.tsx
import Link from 'next/link';

const BASE = '/marketing/website/preview';

const COL1 = ['/accommodation', '/glamping', '/offers'];
const COL2 = ['/wellness-center', '/retreats', '/spa', '/eco-farm'];
const COL3 = ['/dining', '/experiences', '/blog'];
const COL4 = ['/about', '/sustainability', '/contact', '/faq', '/terms'];

function FooterLinks({ paths }: { paths: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {paths.map(p => (
        <Link key={p} href={BASE + p} style={{ fontSize: 13, color: '#9A8E7A', textDecoration: 'none' }}>
          {p.slice(1).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Home'}
        </Link>
      ))}
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer style={{ background: '#151210', color: '#9A8E7A', marginTop: 80 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 24px 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 40 }}>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 21, fontWeight: 700, color: '#F0EAE0', marginBottom: 10 }}>The Namkhan</div>
          <div style={{ fontSize: 13, lineHeight: 1.85, color: '#6B6050' }}>
            Ban Donkeo<br />
            Luang Prabang, 06000<br />
            Laos PDR<br /><br />
            Small Luxury Hotels of the World<br />
            Travelife Gold · Plastic-Free Laos
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4A4035', marginBottom: 14 }}>Stay</div>
          <FooterLinks paths={COL1} />
        </div>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4A4035', marginBottom: 14 }}>Wellness</div>
          <FooterLinks paths={COL2} />
        </div>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4A4035', marginBottom: 14 }}>Discover</div>
          <FooterLinks paths={COL3} />
        </div>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4A4035', marginBottom: 14 }}>Info</div>
          <FooterLinks paths={COL4} />
        </div>
      </div>
      <div style={{ borderTop: '1px solid #221E18', padding: '18px 24px', textAlign: 'center', fontSize: 12, color: '#4A4035' }}>
        © {new Date().getFullYear()} The Namkhan · thenamkhan.com
      </div>
    </footer>
  );
}
