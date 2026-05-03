// app/sales/inquiries/_components/SourceMix.tsx
// Block 8 middle-right — pipeline $ by source. Not vanity counts.

interface Slice {
  label: string;
  pipeline: number;     // $ pipeline weighted by conversion prob
}

const SLICES: Slice[] = [
  { label: 'Direct email',  pipeline: 18400 },
  { label: 'Website form',  pipeline: 12200 },
  { label: 'WhatsApp',      pipeline: 7800 },
  { label: 'OTA pre-stay',  pipeline: 4100 },
  { label: 'DMC / B2B',     pipeline: 3700 },
  { label: 'Repeat guest',  pipeline: 2000 },
];

const fmt = (n: number) => `$${(n / 1000).toFixed(1)}k`;

export default function SourceMix() {
  const total = SLICES.reduce((s, x) => s + x.pipeline, 0);
  return (
    <div
      style={{
        background: 'var(--paper-warm)',
        border: '1px solid #e6dfc9',
        borderRadius: 8,
        padding: '12px 14px',
        marginTop: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 8,
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 18,
            fontWeight: 500,
            margin: 0,
          }}
        >
          Source mix <em style={{ color: '#a17a4f' }}>$</em>
        </h3>
        <span style={{ fontSize: 11, color: '#8a8170' }}>open pipeline · weighted</span>
      </div>

      {SLICES.map((s) => {
        const pct = (s.pipeline / total) * 100;
        return (
          <div key={s.label} style={{ marginBottom: 8 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11.5,
                marginBottom: 2,
              }}
            >
              <span>{s.label}</span>
              <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>
                {fmt(s.pipeline)}
                <span style={{ color: '#8a8170', marginLeft: 8 }}>
                  {pct.toFixed(0)}%
                </span>
              </span>
            </div>
            <div
              style={{
                height: 8,
                background: '#f4ecd8',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: '#1f3d2e',
                }}
              />
            </div>
          </div>
        );
      })}

      <div
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid #f0e8d0',
          fontSize: 11.5,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <strong>Total</strong>
        <strong
          style={{
            fontFamily: 'ui-monospace, Menlo, monospace',
          }}
        >
          {fmt(total)}
        </strong>
      </div>
    </div>
  );
}
