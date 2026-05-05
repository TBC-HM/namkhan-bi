// app/marketing/compiler/_components/CompilerActionRow.tsx
// Compset-pattern action button row. Three settings/data destinations
// instead of vanity KPI tiles.

import Link from 'next/link';

interface Action {
  href: string;
  label: string;
  meta?: string; // small mono meta below the label
}

export default function CompilerActionRow({ actions }: { actions: Action[] }) {
  return (
    <div style={{
      marginTop: 14,
      background: 'var(--paper-warm)',
      border: '1px solid var(--paper-deep)',
      borderRadius: 6,
      padding: 8,
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
    }}>
      {actions.map(a => (
        <Link key={a.href} href={a.href} style={{
          flex: '1 1 0',
          minWidth: 160,
          padding: '10px 14px',
          background: 'var(--paper)',
          border: '1px solid var(--paper-deep)',
          borderRadius: 4,
          textDecoration: 'none',
          color: 'var(--ink)',
        }}>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            letterSpacing: 'var(--ls-extra)',
            textTransform: 'uppercase',
            fontWeight: 600,
            color: 'var(--ink)',
          }}>
            {a.label}
          </div>
          {a.meta && (
            <div style={{
              marginTop: 3,
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              color: 'var(--ink-mute)',
              letterSpacing: 'var(--ls-loose)',
            }}>
              {a.meta}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
