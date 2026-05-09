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
          onMouseEnter={(e) => { e.currentTarget.style.color = '#a8854a'; e.currentTarget.style.borderBottomColor = '#a8854a'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#d8cca8'; e.currentTarget.style.borderBottomColor = 'transparent'; }}
        >
          {d.label}
        </a>
      ))}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  strip: { display: 'flex', flexWrap: 'wrap', gap: 16 },
  link: {
    // PBS 2026-05-09 #22: stronger contrast on the top menu (not bigger).
    // Was #9b907a (low-contrast brown) → #d8cca8 (paper) for the resting
    // state, brass on hover/active.
    color:          '#d8cca8',
    textDecoration: 'none',
    fontFamily:     "'JetBrains Mono', ui-monospace, monospace",
    fontSize:       10,
    letterSpacing:  '0.18em',
    textTransform:  'uppercase',
    fontWeight:     600,
    padding:        '4px 0',
    borderBottom:   '1px solid transparent',
    transition:     'color 100ms ease, border-color 100ms ease',
  },
};
