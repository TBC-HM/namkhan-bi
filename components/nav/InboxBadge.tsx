// components/nav/InboxBadge.tsx
// Mail icon link in the top banner. Renders unread count badge if > 0.

import Link from 'next/link';

export default function InboxBadge({ unread }: { unread: number }) {
  return (
    <Link
      href="/inbox"
      title={unread > 0 ? `Inbox · ${unread} unread` : 'Inbox'}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: 8,
        textDecoration: 'none',
        color: 'var(--ink)',
        marginRight: 10,
        transition: 'background 120ms',
      }}
    >
      <svg
        width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 6h16v12H4z" />
        <polyline points="4,7 12,13 20,7" />
      </svg>
      {unread > 0 && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            borderRadius: 8,
            background: 'var(--st-bad)',
            color: 'var(--paper-warm)',
            fontSize: 10,
            fontFamily: 'var(--mono)',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
