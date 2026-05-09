// components/page/CompareSelector.tsx
// PBS 2026-05-09: universal compare selector. Anchor-button group identical
// in style to TimeframeSelector (brass-active state, mono caps, 1px brand
// border) but flips ?cmp= instead of ?win=. Active comparison number is
// rendered in KpiBox/graphs downstream — green = better, red = worse.
//
// Options (per PBS brief):
//   None · LW (last week) · LM (last month) · SDLY · STLY · Budget
// All keys map through lib/period.ts → CompareKey.

import Link from 'next/link';

interface Option {
  cmp: string;
  label: string;
}

const DEFAULT_OPTIONS: Option[] = [
  { cmp: 'none',   label: 'None' },
  { cmp: 'lw',     label: 'LW' },
  { cmp: 'lm',     label: 'LM' },
  { cmp: 'sdly',   label: 'SDLY' },
  { cmp: 'stly',   label: 'STLY' },
  { cmp: 'budget', label: 'Bgt' },
];

interface Props {
  /** Current pathname (e.g. "/revenue/pulse") so links preserve route. */
  basePath: string;
  /** Currently selected compare key from resolvePeriod (period.cmp). */
  active: string;
  /** Custom option set if a page wants to limit the choices. */
  options?: Option[];
  /** Other URL params to preserve when switching compare. */
  preserve?: Record<string, string | undefined>;
}

export default function CompareSelector({
  basePath,
  active,
  options = DEFAULT_OPTIONS,
  preserve,
}: Props) {
  return (
    <div style={{
      display: 'inline-flex',
      gap: 0,
      border: '1px solid #2a2520',
      borderRadius: 4,
      overflow: 'hidden',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 11,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}>
      {options.map((o) => {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(preserve ?? {})) {
          if (v != null && v !== '' && k !== 'cmp') params.set(k, String(v));
        }
        params.set('cmp', o.cmp);
        const isActive = active === o.cmp;
        return (
          <Link
            key={o.cmp}
            href={`${basePath}?${params.toString()}`}
            prefetch={false}
            style={{
              padding: '6px 10px',
              background: isActive ? '#a8854a' : 'transparent',
              color: isActive ? '#0a0a0a' : '#d8cca8',
              borderRight: '1px solid #2a2520',
              textDecoration: 'none',
              fontWeight: isActive ? 700 : 600,
            }}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
