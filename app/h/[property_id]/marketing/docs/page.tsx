// app/h/[property_id]/marketing/docs/page.tsx
// PBS 2026-09-15 — the marketing asset library, property-scoped.
// Replaces the Donna stub. Organised the way a marketing director looks for things: by WHAT IT IS
// (logo, brand guide, photo, menu, deck, press kit), not by filename or doc_type — because nobody
// remembers that the fact sheet is called "Whats Our Story-reviewed.docx".
// Shelves come from fn_marketing_shelves / fn_marketing_assets; no counting SQL in the page.
// SEO crawl exports (page_titles_*, security_*, validation_*) are 57 files that are NOT collateral
// — they get their own shelf, sorted last, so they never sit next to the logos.
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Shelf {
  shelf: string; label: string; sort_order: number; total: number;
  current_n: number; archived: number; newest_year: number | null; bytes: number;
}
interface Asset {
  doc_id: string; shelf: string; title: string | null; file_name: string | null;
  ext: string | null; doc_year: number | null; size_kb: number; status: string; folder: string | null;
}

const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };
const mute: React.CSSProperties = { opacity: 0.6 };
const row: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0',
  borderBottom: '1px solid var(--hair, #E6DFCC)', fontSize: 12.5,
};
const pill: React.CSSProperties = {
  fontSize: 10.5, padding: '1px 6px', borderRadius: 4, border: '1px solid var(--hair, #E6DFCC)',
  color: 'var(--ink-mute, #5A5A5A)', textTransform: 'uppercase', letterSpacing: '0.04em',
};

function mb(bytes: number): string {
  if (!bytes) return '—';
  return bytes >= 1048576 ? `${Math.round(bytes / 1048576)} MB` : `${Math.round(bytes / 1024)} kB`;
}

export default async function MarketingDocsLibrary({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  const sb = getSupabaseAdmin();

  const [shelfRes, assetRes] = await Promise.all([
    sb.rpc('fn_marketing_shelves', { p_property_id: propertyId }),
    sb.rpc('fn_marketing_assets', { p_property_id: propertyId, p_shelf: null, p_limit: 600 }),
  ]);

  const shelves = ((shelfRes.data ?? []) as Shelf[]).sort((a, b) => a.sort_order - b.sort_order);
  const assets = (assetRes.data ?? []) as Asset[];
  const byShelf = new Map<string, Asset[]>();
  for (const a of assets) {
    const list = byShelf.get(a.shelf) ?? [];
    list.push(a);
    byShelf.set(a.shelf, list);
  }

  const total = shelves.reduce((n, s) => n + s.total, 0);
  const essentials = shelves.filter((s) => ['logos', 'brand', 'collateral', 'menus', 'press'].includes(s.shelf));

  return (
    <DashboardPage
      title="Marketing · Docs"
      subtitle="The asset library — what you reach for, not what the file is called. Preview opens the file; archived items stay searchable but out of the way."
    >
      {/* What you grab most weeks */}
      <div style={fullRow}>
        <Container title="Brand essentials" subtitle="The five shelves you open most weeks" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
            {essentials.map((s) => (
              <a
                key={s.shelf}
                href={`#shelf-${s.shelf}`}
                style={{
                  border: '1px solid var(--hair, #E6DFCC)', borderRadius: 8, padding: '10px 12px',
                  textDecoration: 'none', color: 'var(--ink, #1B1B1B)', display: 'block',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
                <div style={{ ...mute, fontSize: 11.5, marginTop: 2 }}>
                  {s.current_n} current{s.archived ? ` · ${s.archived} archived` : ''} · {mb(s.bytes)}
                  {s.newest_year ? ` · newest ${s.newest_year}` : ''}
                </div>
              </a>
            ))}
          </div>
          <div style={{ ...mute, fontSize: 11.5, marginTop: 10 }}>
            {total} files in the library · upload at <a href="/marketing/docs/upload" style={{ textDecoration: 'underline' }}>Docs · upload</a>
          </div>
        </Container>
      </div>

      {/* Every shelf */}
      {shelves.map((s) => {
        const items = byShelf.get(s.shelf) ?? [];
        const isNoise = s.shelf === 'seo_exports' || s.shelf === 'unsorted';
        return (
          <div style={fullRow} key={s.shelf} id={`shelf-${s.shelf}`}>
            <Container
              title={s.label}
              subtitle={
                s.shelf === 'seo_exports'
                  ? 'Screaming-Frog style crawl exports. Kept for the web work, deliberately not mixed into the collateral.'
                  : s.shelf === 'unsorted'
                    ? 'No shelf rule matched yet — name them better on upload, or let the brain propose a family.'
                    : `${s.current_n} current${s.archived ? ` · ${s.archived} archived` : ''} · ${mb(s.bytes)}`
              }
              density="compact"
            >
              {items.length === 0 ? (
                <div style={{ ...mute, fontSize: 12.5 }}>Nothing on this shelf yet.</div>
              ) : (
                <details open={!isNoise}>
                  <summary style={{ cursor: 'pointer', fontSize: 12, ...mute, marginBottom: 6 }}>
                    {items.length} file{items.length === 1 ? '' : 's'}
                  </summary>
                  {items.map((a) => (
                    <div key={a.doc_id} style={row}>
                      <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                        <a
                          href={`/api/legal/docs/file/${a.doc_id}?mode=preview`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ textDecoration: 'underline', opacity: a.status === 'archived' ? 0.55 : 1 }}
                        >
                          {a.title || a.file_name || a.doc_id.slice(0, 8)}
                        </a>
                        {a.folder ? <div style={{ ...mute, fontSize: 11 }}>{a.folder}</div> : null}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', whiteSpace: 'nowrap' }}>
                        {a.status === 'archived' ? <span style={pill}>archived</span> : null}
                        {a.ext ? <span style={pill}>{a.ext}</span> : null}
                        <span style={{ ...mute, fontSize: 11.5, minWidth: 46, textAlign: 'right' }}>
                          {a.doc_year ?? '—'}
                        </span>
                        <span style={{ ...mute, fontSize: 11.5, minWidth: 60, textAlign: 'right' }}>
                          {a.size_kb >= 1024 ? `${Math.round(a.size_kb / 1024)} MB` : `${a.size_kb} kB`}
                        </span>
                        <a
                          href={`/api/legal/docs/file/${a.doc_id}?mode=download`}
                          style={{ ...pill, textDecoration: 'none' }}
                        >
                          download
                        </a>
                      </div>
                    </div>
                  ))}
                </details>
              )}
            </Container>
          </div>
        );
      })}
    </DashboardPage>
  );
}
