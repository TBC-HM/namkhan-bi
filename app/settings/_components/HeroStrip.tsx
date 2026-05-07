import type { PropertyCardData } from '../data';

interface HeroStripProps {
  property: PropertyCardData;
}

export function HeroStrip({ property }: HeroStripProps) {
  const kpis = [
    { label: 'Total Rooms', value: property.total_rooms ?? '30', unit: '' },
    { label: 'Star Rating', value: property.star_rating ? `${property.star_rating}★` : '5★', unit: '' },
    { label: 'Active Certs', value: property.active_certifications ?? 3, unit: '' },
    { label: 'Affiliations', value: property.affiliations_count ?? 2, unit: '' },
  ];

  return (
    <div
      style={{
        background: 'var(--color-primary)',
        borderRadius: '0.75rem',
        padding: '2rem 2.5rem',
        color: '#fff',
        marginBottom: '2rem',
      }}
    >
      {/* Top row: name + category */}
      <div style={{ marginBottom: '0.25rem' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            opacity: 0.7,
          }}
        >
          {property.category ?? 'Eco-luxury wellness retreat'}
        </span>
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '2rem',
          fontWeight: 700,
          margin: '0 0 0.25rem',
          color: '#fff',
        }}
      >
        {property.trading_name ?? 'The Namkhan'}
      </h1>
      <p
        style={{
          fontSize: '0.875rem',
          opacity: 0.8,
          margin: '0 0 1.5rem',
          maxWidth: '42rem',
        }}
      >
        {property.legal_name ?? 'Green Tea Sole Company Limited'} &middot;{' '}
        {property.city ?? 'Luang Prabang'}, {property.country ?? 'Laos'}
      </p>

      {/* KPI pills */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))',
          gap: '1rem',
        }}
      >
        {kpis.map(({ label, value, unit }) => (
          <div
            key={label}
            style={{
              background: 'rgba(255,255,255,0.12)',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                opacity: 0.7,
                marginBottom: '0.25rem',
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.5rem',
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {value}
              {unit && (
                <span style={{ fontSize: '0.8rem', marginLeft: '0.2rem', opacity: 0.8 }}>
                  {unit}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Active certifications strip */}
      {property.certifications && property.certifications.length > 0 && (
        <div
          style={{
            marginTop: '1.25rem',
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.7rem', opacity: 0.65, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Active certs:
          </span>
          {property.certifications.map((cert: string) => (
            <span
              key={cert}
              style={{
                background: 'rgba(255,255,255,0.18)',
                borderRadius: '1rem',
                padding: '0.15rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 500,
              }}
            >
              {cert}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
