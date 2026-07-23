// app/university/_components/Breadcrumbs.tsx
// TBC University · breadcrumb trail. Server component; plain links.

import { INK_SOFT, GREEN } from '../_lib/theme';

export default function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" style={{ fontSize: 12.5, color: INK_SOFT }}>
      {items.map((it, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden style={{ margin: '0 6px', color: '#B9B2A0' }}>›</span>}
          {it.href ? (
            <a href={it.href} style={{ color: GREEN, textDecoration: 'none', fontWeight: 600 }}>{it.label}</a>
          ) : (
            <span>{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
