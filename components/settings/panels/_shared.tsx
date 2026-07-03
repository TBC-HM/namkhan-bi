// components/settings/panels/_shared.tsx
// PBS 2026-07-03: hardcoded paper-white + ink + hairline tokens.
// Old file used var(--ink) / var(--brass) / var(--paper-deep) / var(--border)
// which resolve to DARK on Namkhan (:root --paper-warm = #15110c). Every
// panel that imports these primitives now renders on the same paper-white
// surface as the rest of the cockpit.

import { ReactNode } from 'react';

export function PanelHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div
      style={{
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        borderBottom: '1px solid #E6DFCC',
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: 'var(--serif, ui-serif, Georgia, serif)',
            fontSize: 20,
            fontWeight: 500,
            color: '#1B1B1B',
            margin: 0,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: 12, color: '#5A5A5A', margin: '4px 0 0' }}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, value, span = 1 }: { label: string; value: ReactNode; span?: 1 | 2 | 3 }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <dt
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#5A5A5A',
          marginBottom: 4,
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          fontSize: 13,
          color: empty ? '#8A8A8A' : '#1B1B1B',
          fontStyle: empty ? 'italic' : 'normal',
          margin: 0,
        }}
      >
        {empty ? '—' : value}
      </dd>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      style={{
        padding: '16px 20px',
        borderBottom: '1px solid #E6DFCC',
      }}
    >
      <h3
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#1F3A2E',
          margin: '0 0 12px',
        }}
      >
        {title}
      </h3>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '20px 24px', margin: 0 }}>
        {children}
      </dl>
    </section>
  );
}

export function Chip({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'green' | 'warn' | 'muted' }) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: '#F5F0E1', color: '#1B1B1B', border: '1px solid #E6DFCC' },
    green:   { background: '#E4F0E1', color: '#1F5C2C', border: '1px solid #C8DFC8' },
    warn:    { background: '#FBEDD8', color: '#8B5A1C', border: '1px solid #E6D2A5' },
    muted:   { background: '#FFFFFF', color: '#8A8A8A', border: '1px solid #E6DFCC' },
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        ...styles[tone],
      }}
    >
      {children}
    </span>
  );
}

export function ChipList({ items }: { items: string[] | null | undefined }) {
  if (!items || items.length === 0)
    return (
      <span style={{ fontSize: 13, color: '#8A8A8A', fontStyle: 'italic' }}>—</span>
    );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((item, i) => (
        <Chip key={i}>{item}</Chip>
      ))}
    </div>
  );
}

export function StatusBadge({ active }: { active: boolean | null | undefined }) {
  if (active === false) return <Chip tone="muted">Inactive</Chip>;
  return <Chip tone="green">Active</Chip>;
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div style={{ padding: '48px 20px', textAlign: 'center' }}>
      <p style={{ color: '#5A5A5A', fontSize: 13, margin: 0 }}>{message}</p>
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export function formatTime(t: string | null | undefined): string | null {
  if (!t) return null;
  return t.substring(0, 5);
}

export function formatDate(d: string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
