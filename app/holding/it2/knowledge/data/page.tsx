// app/holding/it2/knowledge/data/page.tsx
// PBS 2026-07-30 — IT2 Knowledge → Data: one room for "what data exists and
// how fresh is it". Links the four data surfaces (still living at their old
// cockpit URLs until the consolidation pass merges Schemas + Freshness into
// a single tabbed page here).

const CARDS = [
  { href: '/holding/it/cockpit/schemas',   title: 'Schemas',         sub: 'Every schema, table and view in the platform DB' },
  { href: '/holding/it/cockpit/freshness', title: 'Freshness',       sub: 'Per-tenant data coverage — what is stale, what is live' },
  { href: '/holding/it/cockpit/sitemap',   title: 'Sitemap',         sub: 'Every route in the app, audited' },
  { href: '/holding/it/cockpit/memory',    title: 'Platform Memory', sub: 'Doc diffs · ADR threads · rule consolidation · why-search' },
];

export default function DataPage() {
  return (
    <div style={{ maxWidth: 780, margin: '0 auto', color: '#1B1B1B' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, margin: '4px 0 2px' }}>Data</h1>
      <p style={{ fontSize: 12, color: '#5A5A5A', margin: '0 0 16px' }}>
        What data exists, how fresh it is, and why decisions were made.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        {CARDS.map((c) => (
          <a key={c.href} href={c.href} style={{
            display: 'block', textDecoration: 'none', color: '#1B1B1B',
            background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 8,
            padding: '16px 18px',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{c.title} →</div>
            <div style={{ fontSize: 11.5, color: '#5A5A5A', marginTop: 3 }}>{c.sub}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
