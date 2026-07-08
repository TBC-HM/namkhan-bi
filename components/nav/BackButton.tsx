// components/nav/BackButton.tsx
//
// PBS 2026-07-08: switched from history-based `router.back()` to always-Link
// so the button reliably goes to the declared fallback (e.g. "← Channels"
// always lands on /revenue/channels, regardless of history stack).
// The old history heuristic broke because window.history.length is almost
// always > 1 on Next.js hydration, so the fallback never fired.

import Link from 'next/link';

interface Props {
  fallback: string;          // where the button navigates
  label?: string;            // default '← Back'
  style?: React.CSSProperties;
}

export default function BackButton({ fallback, label = '← Back', style }: Props) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 12px', fontSize: 11, letterSpacing: '0.08em',
    textTransform: 'uppercase', fontWeight: 600,
    background: 'transparent', color: 'var(--ink, #1B1B1B)',
    border: '1px solid var(--hairline, #E6DFCC)',
    borderRadius: 4, textDecoration: 'none', cursor: 'pointer',
    ...style,
  };
  return (
    <Link href={fallback} aria-label={label} style={baseStyle}>
      {label}
    </Link>
  );
}
