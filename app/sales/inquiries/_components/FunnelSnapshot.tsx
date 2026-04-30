// app/sales/inquiries/_components/FunnelSnapshot.tsx
// Block 8 middle-left — funnel: Inquiries → Drafted → Sent → Reply → Won/Lost.

interface Stage {
  label: string;
  n: number;
  conv?: string;       // conversion to next stage, e.g. "78%"
}

const STAGES: Stage[] = [
  { label: 'Inquiries',    n: 142, conv: '94%' },
  { label: 'Auto-drafted', n: 134, conv: '88%' },
  { label: 'Sent',         n: 118, conv: '71%' },
  { label: 'Reply',        n: 84,  conv: '46%' },
  { label: 'Won',          n: 39 },
];

const LOST = 26;

export default function FunnelSnapshot() {
  const max = Math.max(...STAGES.map((s) => s.n));

  return (
    <div
      style={{
        background: '#fff',
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
            fontFamily: 'Georgia, serif',
            fontSize: 18,
            fontWeight: 500,
            margin: 0,
          }}
        >
          Funnel <em style={{ color: '#a17a4f' }}>snapshot</em>
        </h3>
        <span style={{ fontSize: 11, color: '#8a8170' }}>last 30d · mockup</span>
      </div>

      {STAGES.map((s, i) => (
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
              {s.n}
              {s.conv ? (
                <span style={{ color: '#8a8170', marginLeft: 8 }}>→ {s.conv}</span>
              ) : null}
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
                width: `${Math.round((s.n / max) * 100)}%`,
                height: '100%',
                background: i === STAGES.length - 1 ? '#2f6f4a' : '#a17a4f',
              }}
            />
          </div>
        </div>
      ))}

      <div
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid #f0e8d0',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11.5,
        }}
      >
        <span>Lost</span>
        <span
          style={{
            fontFamily: 'ui-monospace, Menlo, monospace',
            color: '#a02d2d',
          }}
        >
          {LOST}
        </span>
      </div>
    </div>
  );
}
