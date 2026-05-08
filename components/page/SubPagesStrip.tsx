'use client';

// components/page/SubPagesStrip.tsx
// Horizontal sub-pages strip used at top of every <Page>. Extracted as a
// client component because it carries onMouseEnter/Leave handlers — those
// can't be serialized through RSC boundaries to intrinsic <a> elements.

interface SubPageLink { label: string; href: string }

export default function SubPagesStrip({ items }: { items: SubPageLink[] }) {
  return (
    <div style={S.strip}>
      {items.map((d) => (
        <a
          key={d.href}
          href={d.href}
          style={S.link}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#d8cca8'; e.currentTarget.style.borderBottomColor = '#3a3327'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#9b907a'; e.currentTarget.style.borderBottomColor = 'transparent'; }}
        >
          {d.label}
        </a>
      ))}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  strip: { display: 'flex', flexWrap: 'wrap', gap: 14 },
  link: {
    color:          '#9b907a',
    textDecoration: 'none',
    fontFamily:     "'JetBrains Mono', ui-monospace, monospace",
    fontSize:       10,
    letterSpacing:  '0.18em',
    textTransform:  'uppercase',
    padding:        '4px 0',
    borderBottom:   '1px solid transparent',
    transition:     'color 100ms ease, border-color 100ms ease',
  },
};
