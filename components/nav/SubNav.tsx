'use client';

// components/nav/SubNav.tsx
// Beyond Circle sub-nav strip — mono uppercase, active = moss bottom border.
// Items can be marked `coming` to dim them and append "· soon".

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SubNavTab } from './subnavConfig';

export default function SubNav({ items }: { items: SubNavTab[] }) {
  const pathname = usePathname();

  if (!items || items.length === 0) return null;

  return (
    <div className="subnav">
      {items.map((it, i) => {
        // Active when pathname === href, OR when href is the parent and pathname starts with it (and there's no exact match)
        const exact = pathname === it.href;
        const isPrefix = !exact && pathname.startsWith(it.href + '/');
        const active = exact || isPrefix;

        if (it.coming) {
          return (
            <span
              key={it.href}
              className="subnav-btn coming"
              title="Coming soon"
            >
              <span className="text-mono" style={{ fontSize: 9, color: 'var(--brass)' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              {it.label}
              <span className="coming-suffix">· soon</span>
            </span>
          );
        }

        return (
          <Link
            key={it.href}
            href={it.href}
            className={`subnav-btn ${active ? 'active' : ''}`}
          >
            <span className="text-mono" style={{ fontSize: 9, color: 'var(--brass)' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            {it.label}
            {it.isNew ? (
              <span
                style={{
                  fontSize: 9,
                  background: 'var(--tan, #a17a4f)',
                  color: '#fff8eb',
                  padding: '1px 5px',
                  borderRadius: 3,
                  marginLeft: 6,
                  letterSpacing: '0.04em',
                  fontWeight: 600,
                }}
              >
                NEW
              </span>
            ) : null}
            {it.badge && it.badge > 0 ? <span className="badge">{it.badge}</span> : null}
          </Link>
        );
      })}
    </div>
  );
}
