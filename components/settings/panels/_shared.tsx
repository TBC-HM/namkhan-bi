// components/settings/panels/_shared.tsx
// PBS 2026-05-13 rev3: tenant-theme refactor. All hardcoded Donna-only
// fallbacks (#1F3A2E green, #B8A878 sand, #B8542A terracotta) replaced
// with brand-aware tokens that swap per tenant: --ink / --ink-mute /
// --ink-soft / --brass / --paper-deep / --border / --card. These tokens
// have Namkhan-dark defaults in styles/globals.css :root and are remapped
// for Donna in ThemeInjector.lightLegacyVars.
import { ReactNode } from 'react';

export function PanelHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div
      className="px-6 py-5 flex items-start justify-between"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div>
        <h2
          className="font-serif"
          style={{ fontSize: 'var(--t-xl)', color: 'var(--ink)' }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="mt-1"
            style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, value, span = 1 }: { label: string; value: ReactNode; span?: 1 | 2 | 3 }) {
  const empty = value === null || value === undefined || value === '';
  const spanCls = { 1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3' }[span];
  return (
    <div className={spanCls}>
      <dt
        className="uppercase tracking-wider font-medium mb-1.5"
        style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}
      >
        {label}
      </dt>
      <dd
        style={{
          fontSize: 'var(--t-sm)',
          color: empty ? 'var(--ink-faint)' : 'var(--ink)',
          fontStyle: empty ? 'italic' : 'normal',
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
      className="px-6 py-5 last:border-b-0"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <h3
        className="uppercase font-semibold mb-4"
        style={{ fontSize: 'var(--t-xs)', letterSpacing: '0.15em', color: 'var(--brass)' }}
      >
        {title}
      </h3>
      <dl className="grid grid-cols-3 gap-x-6 gap-y-5">{children}</dl>
    </section>
  );
}

export function Chip({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'green' | 'warn' | 'muted' }) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: 'var(--paper-deep)', color: 'var(--ink-soft)' },
    green:   { background: 'rgba(107, 147, 121, 0.15)', color: 'var(--st-good)' },
    warn:    { background: 'rgba(212, 168, 102, 0.15)', color: 'var(--brass)' },
    muted:   { background: 'var(--paper-deep)', color: 'var(--ink-mute)' },
  };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded font-medium"
      style={{ fontSize: 'var(--t-xs)', ...styles[tone] }}
    >
      {children}
    </span>
  );
}

export function ChipList({ items }: { items: string[] | null | undefined }) {
  if (!items || items.length === 0)
    return (
      <span
        className="italic"
        style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-faint)' }}
      >
        —
      </span>
    );
  return (
    <div className="flex flex-wrap gap-1.5">
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
    <div className="px-6 py-16 text-center">
      <p style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>{message}</p>
      {action && <div className="mt-4">{action}</div>}
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
