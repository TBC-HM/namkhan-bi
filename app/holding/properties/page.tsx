// app/holding/properties/page.tsx
// Property portfolio overview for the Beyond Circle Holding company.

import Link from 'next/link';

export default function HoldingPropertiesPage() {
  const PROPERTIES = [
    {
      id: 260955,
      name: 'The Namkhan Luang Prabang',
      slug: 'namkhan',
      location: 'Luang Prabang, Laos',
      currency: 'USD / LAK',
      rooms: 30,
      status: 'operating',
      color: '#1F3A2E',
      dashHref: '/h/260955',
    },
    {
      id: 1000001,
      name: 'Donna Mallorca',
      slug: 'donna',
      location: 'Mallorca, Spain',
      currency: 'EUR',
      rooms: null,
      status: 'operating',
      color: '#1565C0',
      dashHref: '/h/1000001',
    },
  ];

  return (
    <div style={{ maxWidth: 860, padding: '32px 24px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1B1B1B', margin: '0 0 4px' }}>
          Property Portfolio
        </h1>
        <p style={{ fontSize: 12, color: '#5A5A5A', margin: 0 }}>
          Beyond Circle · Holding — all operating and pipeline properties
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {PROPERTIES.map(p => (
          <div key={p.id} style={{
            background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 8,
            padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
                textTransform: 'uppercase', padding: '2px 9px', borderRadius: 99,
                background: '#E8F5E9', color: '#2E7D32' }}>
                {p.status}
              </span>
              <span style={{ fontSize: 10, color: '#8A8A8A' }}>ID {p.id}</span>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1B1B1B', marginBottom: 3 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: '#5A5A5A' }}>{p.location}</div>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#5A5A5A' }}>
              <span>{p.currency}</span>
              {p.rooms && <span>{p.rooms} rooms</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Link href={p.dashHref} style={{
                fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 4,
                background: p.color, color: '#FFFFFF', textDecoration: 'none',
              }}>Dashboard →</Link>
              <Link href={`${p.dashHref}/settings/property`} style={{
                fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 4,
                background: 'transparent', color: '#5A5A5A', border: '1px solid #E6DFCC',
                textDecoration: 'none',
              }}>Settings</Link>
            </div>
          </div>
        ))}

        {/* Add property placeholder */}
        <div style={{
          border: '1px dashed #E6DFCC', borderRadius: 8, padding: '20px 22px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 6, minHeight: 160, color: '#8A8A8A',
        }}>
          <span style={{ fontSize: 22 }}>＋</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Add property</span>
          <span style={{ fontSize: 11, textAlign: 'center' }}>Coming soon — contact IT to onboard a new property</span>
        </div>
      </div>
    </div>
  );
}
