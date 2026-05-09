'use client';

// components/page/SubPagesStrip.tsx
// Horizontal sub-pages strip used at top of every <Page>. Extracted as a
// client component because it carries onMouseEnter/Leave handlers — those
// can't be serialized through RSC boundaries to intrinsic <a> elements.
//
// PBS 2026-05-09 (sub-menu shift bugfix): "When you press the pricing tab
// the menu on top changes please adapt." Two stabilisations:
//   (1) `flexWrap: nowrap` on the strip + `whiteSpace: nowrap` on each
//       link so the active item doesn't reflow neighbours.
//   (2) the active item used to look identical to its siblings (no
//       active marker at all), so on hover/active the borderBottom
//       changed thickness only briefly. Lock the borderBottom width
//       (1px always — transparent on resting, brass on hover/active)
//       and use textShadow for the bold weight to keep glyph-width
//       constant.

import { usePathname } from 'next/navigation';

interface SubPageLink { label: string; href: string }

export default function SubPagesStrip({ items }: { items: SubPageLink[] }) {
  const pathname = usePathname();
  return (
    <div style={S.strip}>
      {items.map((d) => {
        const active = isActive(pathname, d.href);
        return (
          <a
            key={d.href}
            href={d.href}
            aria-current={active ? 'page' : undefined}
            style={{
              ...S.link,
              color: active ? '#a8854a' : '#d8cca8',
              borderBottomColor: active ? '#a8854a' : 'transparent',
              // textShadow to fake bold weight without changing glyph
              // metrics — keeps every label the SAME width whether
              // active or not, so neighbours don't shift.
              textShadow: active ? '0 0 0.4px #a8854a' : 'none',
            }}
            onMouseEnter={(e) => {
              if (active) return;
              e.currentTarget.style.color = '#a8854a';
              e.currentTarget.style.borderBottomColor = '#a8854a';
            }}
            onMouseLeave={(e) => {
              if (active) return;
              e.currentTarget.style.color = '#d8cca8';
              e.currentTarget.style.borderBottomColor = 'transparent';
            }}
          >
            {d.label}
          </a>
        );
      })}
    </div>
  );
}

// /revenue/pricing should mark the "Pricing" link (href=/revenue/pricing)
// as active. Match exact OR prefix-with-slash to handle nested routes
// like /revenue/pricing/calendar.
function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  return pathname.startsWith(href + '/');
}

const S: Record<string, React.CSSProperties> = {
  strip: {
    display: 'flex',
    flexWrap: 'nowrap',
    gap: 16,
    overflowX: 'auto',
    // PBS 2026-05-09: stop neighbour-shift when active item changes.
    // The strip is a fixed row; if it overflows the viewport the user
    // can horizontally scroll rather than have items wrap.
  },
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
    whiteSpace:     'nowrap',
    flexShrink:     0,
  },
};
