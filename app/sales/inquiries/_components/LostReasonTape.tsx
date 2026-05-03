// app/sales/inquiries/_components/LostReasonTape.tsx
// Block 8 bottom (collapsed by default) — last 30 closed-lost.
// Mockup-mode: a sparkline of taxonomy counts.

interface Bucket {
  reason: string;
  n: number;
  pct: number;
}

const BUCKETS: Bucket[] = [
  { reason: 'Price',       n: 9, pct: 30 },
  { reason: 'Dates',       n: 6, pct: 20 },
  { reason: 'No availability', n: 5, pct: 17 },
  { reason: 'Ghosted',     n: 5, pct: 17 },
  { reason: 'Competitor',  n: 3, pct: 10 },
  { reason: 'Location',    n: 1, pct: 3 },
  { reason: 'Other',       n: 1, pct: 3 },
];

export default function LostReasonTape() {
  return (
    <details
      style={{
        background: 'var(--paper-warm)',
        border: '1px solid #e6dfc9',
        borderRadius: 8,
        padding: '10px 14px',
        marginTop: 14,
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          listStyle: 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 13,
        }}
      >
        <span>
          <strong style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>
            Lost-reason tape
          </strong>
          <span style={{ color: '#8a8170', marginLeft: 8, fontSize: 11.5 }}>
            last 30 closed-lost · taxonomy-coded · feeds Conversion Coach
          </span>
        </span>
        <span style={{ color: '#a17a4f', fontSize: 11 }}>expand ▾</span>
      </summary>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${BUCKETS.length}, 1fr)`,
          gap: 8,
          marginTop: 12,
        }}
      >
        {BUCKETS.map((b) => (
          <div
            key={b.reason}
            style={{
              padding: '8px 10px',
              border: '1px solid #f0e8d0',
              borderRadius: 6,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontFamily: 'var(--serif)',
                color: '#1c1815',
              }}
            >
              {b.n}
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: '#4a4538',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginTop: 2,
              }}
            >
              {b.reason}
            </div>
            <div style={{ fontSize: 10, color: '#8a8170', marginTop: 1 }}>
              {b.pct}%
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: '#8a8170' }}>
        Live taxonomy populates once <code>sales.lost_reasons</code> ships and
        Conversion Coach has ≥50 closed quotes.
      </div>
    </details>
  );
}
