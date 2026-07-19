// app/p/m/[slug]/page.tsx
// ADR-156 Menu Studio — public guest QR menu. Route /p/m/<qr_slug> (public via middleware '/p/').
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Item = { name: string; description?: string; price_usd?: number; price_lak?: number; tags?: string[]; allergens?: string[] };
type Section = { title: string; items: Item[] };
type MenuRow = { qr_slug: string; title: string; kind: string; snapshot: { sections: Section[] }; published_at: string };

async function getMenu(slug: string): Promise<MenuRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const res = await fetch(url + '/rest/v1/v_menu_public?qr_slug=eq.' + encodeURIComponent(slug) + '&select=qr_slug,title,kind,snapshot,published_at', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }, cache: 'no-store',
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? (rows[0] as MenuRow) : null;
}

function priceLabel(i: Item): string {
  if (i.price_usd != null) return '$' + Number(i.price_usd).toFixed(2);
  if (i.price_lak != null) return Number(i.price_lak).toLocaleString() + ' LAK';
  return '';
}

export default async function GuestMenu({ params }: { params: { slug: string } }) {
  const menu = await getMenu(params.slug);
  if (!menu) {
    return <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', color: '#3a4a3a', background: '#f7f5ef' }}>Menu not available.</main>;
  }
  const sections = menu.snapshot?.sections ?? [];
  return (
    <main style={{ minHeight: '100vh', background: '#f7f5ef', color: '#26331f', fontFamily: 'Georgia, serif', padding: '32px 20px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: 28, borderBottom: '1px solid #cbd3bf', paddingBottom: 18 }}>
          <div style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#7a8a5f' }}>The Namkhan · Luang Prabang</div>
          <h1 style={{ fontSize: 28, margin: '8px 0 0' }}>{menu.title}</h1>
        </header>
        {sections.map((sec, si) => (
          <section key={si} style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: 16, letterSpacing: 2, textTransform: 'uppercase', color: '#5b6e3a', borderBottom: '1px solid #e0e3d5', paddingBottom: 6, marginBottom: 12 }}>{sec.title}</h2>
            {(sec.items ?? []).map((it, ii) => (
              <div key={ii} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: 16 }}>{it.name}{it.tags?.includes('farm') ? <span style={{ color: '#6b8f3d', fontSize: 12 }}> · farm</span> : null}</div>
                  {it.description ? <div style={{ fontSize: 14, color: '#5a6350', marginTop: 2 }}>{it.description}</div> : null}
                  {it.allergens && it.allergens.length ? <div style={{ fontSize: 11, color: '#9aa088', marginTop: 2 }}>{it.allergens.join(' · ')}</div> : null}
                </div>
                <div style={{ whiteSpace: 'nowrap', fontSize: 15 }}>{priceLabel(it)}</div>
              </div>
            ))}
          </section>
        ))}
        <footer style={{ textAlign: 'center', fontSize: 11, color: '#9aa088', marginTop: 30, borderTop: '1px solid #e0e3d5', paddingTop: 14 }}>The Namkhan · fresh from our eco-farm</footer>
      </div>
    </main>
  );
}
