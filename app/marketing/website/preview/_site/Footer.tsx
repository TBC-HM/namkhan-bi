// app/marketing/website/preview/_site/Footer.tsx
// CMS-4: footer link columns are DB-driven (website.footer_links via the
// v_website_footer_links bridge, editable in WebsiteManager → Footer Menu).
// Falls back to the original hardcoded columns while no rows exist.
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';

const BASE = '/marketing/website/preview';

type FooterLink = { label: string; path: string };
type FooterCol = { title: string; links: FooterLink[] };

function labelForPath(p: string): string {
  return p.slice(1).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Home';
}

function defaults(paths: string[]): FooterLink[] {
  return paths.map(p => ({ label: labelForPath(p), path: p }));
}

const DEFAULT_COLS: FooterCol[] = [
  { title: 'Stay', links: defaults(['/accommodation', '/glamping', '/offers']) },
  { title: 'Wellness', links: defaults(['/wellness-center', '/retreats', '/spa', '/eco-farm']) },
  { title: 'Discover', links: defaults(['/dining', '/experiences', '/blog']) },
  { title: 'Info', links: defaults(['/about', '/sustainability', '/contact', '/faq', '/terms']) },
];

async function loadFooterCols(): Promise<FooterCol[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('v_website_footer_links')
      .select('label,path,column_group,sort_order')
      .eq('property_id', PROPERTY_ID)
      .order('column_group', { ascending: true })
      .order('sort_order', { ascending: true });
    if (error || !data || data.length === 0) return DEFAULT_COLS;
    const byGroup = new Map<string, FooterLink[]>();
    for (const row of data as { label: string; path: string; column_group: string | null }[]) {
      const g = row.column_group ?? 'Links';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push({ label: row.label, path: row.path });
    }
    return Array.from(byGroup.entries()).map(([title, links]) => ({ title, links }));
  } catch {
    return DEFAULT_COLS;
  }
}

function FooterLinks({ links }: { links: FooterLink[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {links.map(l =>
        l.path.startsWith('/') ? (
          <Link key={l.path + l.label} href={BASE + l.path} style={{ fontSize: 13, color: '#9A8E7A', textDecoration: 'none' }}>
            {l.label}
          </Link>
        ) : (
          <a key={l.path + l.label} href={l.path} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#9A8E7A', textDecoration: 'none' }}>
            {l.label}
          </a>
        )
      )}
    </div>
  );
}

export async function SiteFooter() {
  const cols = await loadFooterCols();
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
        {cols.map(col => (
          <div key={col.title}>
            <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4A4035', marginBottom: 14 }}>{col.title}</div>
            <FooterLinks links={col.links} />
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid #221E18', padding: '18px 24px', textAlign: 'center', fontSize: 12, color: '#4A4035' }}>
        © {new Date().getFullYear()} The Namkhan · thenamkhan.com
      </div>
    </footer>
  );
}
