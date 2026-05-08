'use client';

import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

// Note: metadata export cannot coexist with 'use client' — moved to a server wrapper pattern.
// PBS: if tsc flags this, extract Sidebar to components/nav/Sidebar.tsx and keep layout.tsx server.

const NAV_ITEMS = [
  { label: 'Home',       href: '/' },
  { label: 'Revenue',    href: '/revenue' },
  { label: 'Sales',      href: '/sales' },
  { label: 'Marketing',  href: '/marketing' },
  { label: 'Operations', href: '/operations' },
  { label: 'Guest',      href: '/guest' },
  { label: 'Finance',    href: '/finance' },
  { label: 'IT',         href: '/it' },
];

function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      style={{
        width: collapsed ? 56 : 200,
        minHeight: '100vh',
        background: '#0a0a0a',
        borderRight: '1px solid #1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        flexShrink: 0,
      }}
    >
      {/* Logo mark — yellow N, no green stripe */}
      <div
        style={{
          padding: collapsed ? '20px 0' : '20px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid #1a1a1a',
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? 'Expand menu' : 'Collapse menu'}
      >
        <span
          style={{
            fontFamily: "'TT Drugs', 'Fraunces', serif",
            fontSize: 28,
            fontWeight: 700,
            color: '#e8c84a',   /* Yellow N — replaces old Forest Green */
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          N
        </span>
        {!collapsed && (
          <span
            style={{
              fontFamily: "'TT Drugs', 'Fraunces', serif",
              fontSize: 13,
              color: '#888',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Namkhan BI
          </span>
        )}
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '12px 0' }}>
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: collapsed ? '10px 0' : '10px 16px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                color: active ? '#e8c84a' : '#aaa',
                background: active ? 'rgba(232,200,74,0.08)' : 'transparent',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                borderLeft: active ? '2px solid #e8c84a' : '2px solid transparent',
                transition: 'all 0.15s ease',
              }}
            >
              {!collapsed && item.label}
              {collapsed && item.label[0]}
            </Link>
          );
        })}
      </nav>

      {/* Footer hint */}
      {!collapsed && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #1a1a1a',
            fontSize: 11,
            color: '#444',
          }}
        >
          Namkhan River Lodge
        </div>
      )}
    </aside>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head />
      <body
        style={{
          margin: 0,
          background: '#000',
          color: '#fff',
          fontFamily: "'TT Drugs', 'Fraunces', Inter, sans-serif",
          display: 'flex',
          minHeight: '100vh',
          /* NO green stripe — green border/header fully removed */
        }}
      >
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          {children}
        </div>
      </body>
    </html>
  );
}
