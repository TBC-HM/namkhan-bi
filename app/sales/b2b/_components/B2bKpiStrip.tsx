// app/sales/b2b/_components/B2bKpiStrip.tsx
// Persistent KPI strip across all B2B/DMC sub-tabs (per spec v3 §4).
// Mock numbers — wire to dmc_contracts + dmc_reservation_mapping after migration applied.

const KPIS = [
  { scope: 'Active LPAs',         value: '23',     sub: 'of 25 partners',           tone: 'flat' },
  { scope: 'Expiring 90d',        value: '4',      sub: 'auto-alerts armed',        tone: 'warn' },
  { scope: 'Unmapped today',      value: '12',     sub: '3 >24h backlog',           tone: 'bad'  },
  { scope: 'Mapped MTD',          value: '187',    sub: 'auto 71% · human 29%',     tone: 'flat' },
  { scope: 'DMC revenue MTD',     value: 'USD 142.3k', sub: '+18% vs LM',           tone: 'up'   },
  { scope: 'Parity violations',   value: '2',      sub: '1 open · 1 acknowledged',  tone: 'warn' },
] as const;

const TONE_COLOR: Record<string, string> = {
  flat: '#4a4538',
  up:   '#1f6f43',
  warn: '#a17a4f',
  bad:  '#a83232',
};

export default function B2bKpiStrip() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
        gap: 10,
        marginBottom: 14,
      }}
    >
      {KPIS.map((k) => (
        <div
          key={k.scope}
          style={{
            background: '#fff',
            border: '1px solid #e6dfc9',
            borderRadius: 8,
            padding: '12px 14px',
            minHeight: 86,
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              color: '#8a8170',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {k.scope}
          </div>
          <div
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: 22,
              fontWeight: 500,
              color: TONE_COLOR[k.tone] ?? '#4a4538',
              margin: '2px 0',
            }}
          >
            {k.value}
          </div>
          <div style={{ fontSize: 11, color: '#8a8170' }}>{k.sub}</div>
        </div>
      ))}
    </div>
  );
}
