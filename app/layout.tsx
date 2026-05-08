import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Namkhan BI',
  description: 'Namkhan River Lodge — Business Intelligence Cockpit',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: 'var(--bg, #0a0a0b)', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <Sidebar />
          <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
        </div>
      </body>
    </html>
  );
}

/* ─── Sidebar nav ────────────────────────────────────────────────────── */
import Link from 'next/link';

function Sidebar() {
  const links = [
    { href: '/',             label: 'Home' },
    { href: '/revenue',      label: 'Revenue' },
    { href: '/sales',        label: 'Sales' },
    { href: '/marketing',    label: 'Marketing' },
    { href: '/operations',   label: 'Operations' },
    { href: '/guest',        label: 'Guest' },
    { href: '/finance',      label: 'Finance' },
    { href: '/it',           label: 'IT' },
    { href: '/cockpit',      label: 'Cockpit' },
    { href: '/settings/cockpit', label: 'Settings' },
  ];

  return (
    <nav
      style={{
        width: 200,
        minHeight: '100vh',
        background: 'var(--panel, #15151a)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 0 24px 0',
        flexShrink: 0,
      }}
    >
      {/* Brand mark — yellow N, NO green stripe */}
      <div
        style={{
          padding: '20px 16px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            fontFamily: "'TT Drugs', 'Fraunces', serif",
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: 28,
            lineHeight: 1,
            color: '#e8c84a',   /* yellow N — replaces old green #084838 */
            letterSpacing: '-0.5px',
          }}
        >
          N
        </span>
        <span
          style={{
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.45)',
            fontFamily: 'monospace',
            lineHeight: 1.2,
          }}
        >
          Namkhan
          <br />
          <span style={{ color: 'var(--brass, #c79a6b)', fontWeight: 600 }}>BI</span>
        </span>
      </div>

      {/* Nav links */}
      <div style={{ padding: '12px 8px', flex: 1 }}>
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            style={{
              display: 'block',
              padding: '8px 12px',
              borderRadius: 6,
              color: 'rgba(255,255,255,0.7)',
              textDecoration: 'none',
              fontSize: 13,
              fontFamily: 'system-ui, sans-serif',
              marginBottom: 2,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.06)';
              (e.currentTarget as HTMLAnchorElement).style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
              (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.7)';
            }}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
