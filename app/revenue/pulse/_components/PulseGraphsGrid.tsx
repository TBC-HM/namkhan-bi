// app/revenue/pulse/_components/PulseGraphsGrid.tsx
//
// 2-row × 3-col grid of the 6 Pulse charts. Each card matches the visual
// shell of CompsetGraphs/RatePlansGraphs (paper-warm card, t-md title,
// mono uppercase sub). The actual SVG markup is produced by lib/svgCharts
// and injected via dangerouslySetInnerHTML.

interface Props {
  charts: {
    title: string;
    sub: string;
    svg: string;
  }[];
}

const CARD: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  padding: '14px 16px',
  minHeight: 280,
};
const TITLE: React.CSSProperties = {
  fontSize: 'var(--t-md)', fontWeight: 600, color: 'var(--ink)', marginBottom: 2,
};
const SUB: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)', color: 'var(--ink-mute)',
  textTransform: 'uppercase', marginBottom: 10,
};
const EMPTY: React.CSSProperties = {
  height: 200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ink-faint)',
  fontStyle: 'italic',
  fontSize: 'var(--t-sm)',
};

export default function PulseGraphsGrid({ charts }: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: 12,
        marginTop: 14,
      }}
    >
      {charts.map((c) => (
        <div key={c.title} style={CARD}>
          <div style={TITLE}>{c.title}</div>
          <div style={SUB}>{c.sub}</div>
          {c.svg ? (
            <div
              dangerouslySetInnerHTML={{ __html: c.svg }}
              style={{ width: '100%' }}
            />
          ) : (
            <div style={EMPTY}>No data yet</div>
          )}
        </div>
      ))}
    </div>
  );
}
