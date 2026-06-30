// components/nav/BackButton.tsx
//
// Lightweight back-nav for pages launched as drill-ins. router.back() keeps
// the user's prior URL state (drawer drill, filters, scroll) when available,
// and falls back to a hard-coded href on cold loads / direct URL entry.

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Props {
  fallback: string;          // where to go when there is no history
  label?: string;            // default '← Back'
  style?: React.CSSProperties;
}

export default function BackButton({ fallback, label = '← Back', style }: Props) {
  const router = useRouter();
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 12px', fontSize: 11, letterSpacing: '0.08em',
    textTransform: 'uppercase', fontWeight: 600,
    background: 'transparent', color: 'var(--ink, #1B1B1B)',
    border: '1px solid var(--hairline, #E6DFCC)',
    borderRadius: 4, textDecoration: 'none', cursor: 'pointer',
    ...style,
  };

  const handleClick = () => {
    // Prefer history when there is a non-empty history stack (history.length > 1).
    // Otherwise fall back to the explicit href.
    try {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back();
        return;
      }
    } catch { /* noop */ }
    router.push(fallback);
  };

  return (
    <button type="button" onClick={handleClick} style={baseStyle} aria-label={label}>
      {label}
    </button>
  );
}
