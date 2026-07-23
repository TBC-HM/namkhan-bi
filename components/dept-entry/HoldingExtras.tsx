// components/dept-entry/HoldingExtras.tsx
// Holding-only block rendered by DeptEntry when cfg.customExtra === 'holding'.
// Two pieces:
//   1) A peach "Cockpit · operations command" CTA button.
//   2) A two-tile grid linking into each property's /h/[id]/ scope.
// Both use Beyond Circle peach as the accent.

'use client';

import TenantLink from '@/components/nav/TenantLink';
const BC_PEACH = '#F7AC67';
const BC_DEEP  = '#002428';

interface PropertyTile {
  property_id: number;
  display_name: string;
  code: string;
  country: string;
  status: 'live' | 'prospect';
}

const PROPERTIES: PropertyTile[] = [
  { property_id: 260955,  display_name: 'The Namkhan',   code: 'namkhan', country: 'Laos',  status: 'live'     },
  { property_id: 1000001, display_name: 'Donna Portals', code: 'donna',   country: 'Spain', status: 'prospect' },
];

export default function HoldingExtras() {
  return (
    <div style={S.wrap}>
      <section style={S.cockpitRow}>
        <TenantLink href="/holding/it/cockpit" style={S.cockpitButton}>
          → Cockpit · operations command
        </TenantLink>
      </section>

      <section style={S.propGrid}>
        {PROPERTIES.map((p) => (
          <TenantLink key={p.property_id} href={`/h/${p.property_id}`} style={S.propTile}>
            <div style={S.propEyebrow}>
              {p.country.toUpperCase()} · {p.status}
            </div>
            <div style={S.propName}>{p.display_name}</div>
            <div style={S.propMeta}>
              <span>property_id {p.property_id}</span>
              <span style={S.propDot}>·</span>
              <span>{p.code}</span>
            </div>
            <div style={S.propCta}>Open property →</div>
          </TenantLink>
        ))}
      </section>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    marginTop: 16,
    marginBottom: 32,
  },
  cockpitRow: {
    display: 'flex',
    justifyContent: 'flex-start',
  },
  cockpitButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 18px',
    background: BC_PEACH,
    color: BC_DEEP,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 11,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    fontWeight: 700,
    borderRadius: 8,
    textDecoration: 'none',
    boxShadow: '0 2px 8px rgba(247,172,103,0.35)',
    transition: 'transform 100ms ease, box-shadow 100ms ease',
  },
  propGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 14,
  },
  propTile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '16px 18px',
    background: 'var(--surf-1, #ffffff)',
    border: `1px solid ${BC_PEACH}33`,
    borderRadius: 10,
    textDecoration: 'none',
    color: BC_DEEP,
    borderLeft: `3px solid ${BC_PEACH}`,
    transition: 'border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease',
  },
  propEyebrow: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 9,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: BC_PEACH,
    fontWeight: 700,
  },
  propName: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontSize: 22,
    fontStyle: 'italic',
    color: BC_DEEP,
    margin: '4px 0 2px',
  },
  propMeta: {
    display: 'flex',
    gap: 6,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10,
    color: 'var(--ink-mute, #7d7565)',
    letterSpacing: '0.06em',
  },
  propDot: { color: 'var(--ink-faint, #b3a888)' },
  propCta: {
    marginTop: 8,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 11,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: BC_PEACH,
    fontWeight: 600,
  },
};
