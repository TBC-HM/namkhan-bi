// app/sample/page.tsx — index that links to the 3 candidate templates.

import Link from 'next/link';

export default function SampleIndex() {
  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a', color: '#e9e1ce',
      fontFamily: "'Inter Tight', system-ui, sans-serif", padding: '64px 48px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: '#a8854a', marginBottom: 8,
        }}>3 candidate templates</div>
        <h1 style={{
          fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic',
          fontWeight: 300, fontSize: 36, color: '#e9e1ce',
          marginBottom: 12,
        }}>Sub-page samples</h1>
        <p style={{ color: '#9b907a', fontSize: 14, lineHeight: 1.6, marginBottom: 32 }}>
          Same canonical components (<code style={c}>KpiBox</code>, <code style={c}>DataTable</code>),
          three different compositions. Pick one, refine, then we wire the data per dept.
        </p>

        <div style={{ display: 'grid', gap: 14 }}>
          <Card href="/sample/1" eyebrow="Sample 1" title="Classic — KPIs · 3 charts · table" body="The most familiar BI pattern. 4 KPI tiles, equal-width 3-chart row, full-width data table at the bottom. Works for: pulse, channels, comp set." />
          <Card href="/sample/2" eyebrow="Sample 2" title="Hero + sidebar — one big chart, one insight rail" body="When one thing dominates the story. Wide hero chart (8 cols) with insight rail (4 cols), then 2 panels, then table. Works for: pace, forecast, P&L." />
          <Card href="/sample/3" eyebrow="Sample 3" title="Brief-led — narrative on top, then evidence" body="AI summary up top so the operator sees the takeaway in 3 seconds, then KPI strip, then a tight 2×2 chart+detail grid, then table. Works for: anything that benefits from agent narration." />
        </div>
      </div>
    </div>
  );
}

const c: React.CSSProperties = {
  background: '#15110b', border: '1px solid #2a261d', borderRadius: 4,
  padding: '1px 6px', fontSize: 12, color: '#c4a06b',
};

function Card({ href, eyebrow, title, body }: { href: string; eyebrow: string; title: string; body: string }) {
  return (
    <Link href={href} style={{
      display: 'block', padding: 20,
      background: '#0f0d0a', border: '1px solid #2a261d', borderRadius: 12,
      textDecoration: 'none', transition: 'border-color 100ms ease',
    }}>
      <div style={{
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase',
        color: '#a8854a', marginBottom: 6,
      }}>{eyebrow}</div>
      <div style={{
        fontFamily: "'Fraunces', Georgia, serif",
        fontSize: 22, color: '#d8cca8', marginBottom: 8,
      }}>{title}</div>
      <div style={{ fontSize: 13, color: '#9b907a', lineHeight: 1.55 }}>{body}</div>
    </Link>
  );
}
