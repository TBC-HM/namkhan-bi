// app/sample/_components/SampleSwitcher.tsx — small navigation strip used
// only by the 3 candidate templates so PBS can flip between them.

export default function SampleSwitcher({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div style={S.row}>
      <a href="/sample" style={S.link}>← all samples</a>
      <span style={S.sep}>·</span>
      {[1, 2, 3].map((n) => (
        <a key={n} href={`/sample/${n}`} style={{ ...S.link, color: n === current ? '#c4a06b' : '#9b907a' }}>Sample {n}</a>
      ))}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
  },
  link: { color: '#9b907a', textDecoration: 'none' },
  sep:  { color: '#3d3a32' },
};
