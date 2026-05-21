// app/revenue/reports/render/_renderers/_shared/ReportBrief.tsx
// Shared brief block for every report renderer. Replaces the legacy <Brief>
// dark card with a primitives-styled signal + good/bad split that matches
// the rest of the cockpit (paper background · brass+ink palette).

import { Container } from '@/app/(cockpit)/_design';

interface Props {
  signal: string;
  body: string;
  good: string[];
  bad: string[];
}

export default function ReportBrief({ signal, body, good, bad }: Props) {
  return (
    <Container title="Signal" subtitle={body} density="compact">
      <div style={{
        fontSize: 16,
        fontWeight: 600,
        color: 'var(--ink, #1B1B1B)',
        marginBottom: 14,
        lineHeight: 1.4,
      }}>
        {signal}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 10,
      }}>
        <div style={blockStyle('green')}>
          <div style={labelStyle('green')}>Good</div>
          <ul style={listStyle}>
            {good.map((line, i) => <li key={i} style={liStyle}>{line}</li>)}
          </ul>
        </div>
        <div style={blockStyle('red')}>
          <div style={labelStyle('red')}>Watch</div>
          <ul style={listStyle}>
            {bad.map((line, i) => <li key={i} style={liStyle}>{line}</li>)}
          </ul>
        </div>
      </div>
    </Container>
  );
}

function blockStyle(tone: 'green' | 'red'): React.CSSProperties {
  return {
    padding: '10px 14px',
    borderRadius: 6,
    border: `1px solid ${tone === 'green' ? '#C9DDC9' : '#E8C9C2'}`,
    background: tone === 'green' ? '#F2F7F0' : '#FBF1EE',
  };
}
function labelStyle(tone: 'green' | 'red'): React.CSSProperties {
  return {
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontWeight: 700,
    color: tone === 'green' ? '#1F3A2E' : '#8A2A1D',
    marginBottom: 6,
  };
}
const listStyle: React.CSSProperties = { margin: 0, padding: 0, listStyle: 'none' };
const liStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--ink, #1B1B1B)',
  padding: '3px 0',
};
