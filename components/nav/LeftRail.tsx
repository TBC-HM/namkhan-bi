'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/revenue', label: 'Revenue', icon: '📈' },
  { href: '/sales', label: 'Sales', icon: '🤝' },
  { href: '/marketing', label: 'Marketing', icon: '📣' },
  { href: '/operations', label: 'Operations', icon: '⚙️' },
  { href: '/guest', label: 'Guest', icon: '🛎️' },
  { href: '/finance', label: 'Finance', icon: '💰' },
  { href: '/it', label: 'IT', icon: '🖥️' },
];

export default function LeftRail() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        width: 220,
        backgroundColor: '#0a0a0a',
        borderRight: '1px solid #1f1f1f',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 24,
        zIndex: 100,
      }}
    >
      {/* N logo / wordmark */}
      <div
        style={{
          padding: '0 20px 24px',
          borderBottom: '1px solid #1f1f1f',
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontFamily: 'Fraunces, serif',
            fontSize: 28,
            fontWeight: 700,
            color: '#f5c842',
            letterSpacing: '-0.5px',
          }}
        >
          N
        </span>
      </div>

      {/* Nav links */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 20px',
                textDecoration: 'none',
                color: isActive ? '#f5c842' : '#9ca3af',
                backgroundColor: isActive
                  ? 'rgba(245,200,66,0.08)'
                  : 'transparent',
                borderLeft: isActive
                  ? '3px solid #f5c842'
                  : '3px solid transparent',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: 16 }}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid #1f1f1f',
          fontSize: 11,
          color: '#4b5563',
        }}
      >
        Namkhan BI · SLH
      </div>
    </nav>
  );
}
