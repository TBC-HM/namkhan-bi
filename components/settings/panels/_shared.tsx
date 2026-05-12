// components/settings/panels/_shared.tsx
import { ReactNode } from 'react';

export function PanelHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="px-6 py-5 border-b border-[var(--sand,#B8A878)]/20 flex items-start justify-between">
      <div>
        <h2 className="text-xl font-serif text-[var(--primary,#1F3A2E)]">{title}</h2>
        {subtitle && <p className="text-sm text-[var(--primary,#1F3A2E)]/60 mt-1">{subtitle}</p>}
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
      <dt className="text-xs uppercase tracking-wider text-[var(--primary,#1F3A2E)]/50 font-medium mb-1.5">
        {label}
      </dt>
      <dd className={`text-sm ${empty ? 'text-[var(--primary,#1F3A2E)]/30 italic' : 'text-[var(--primary,#1F3A2E)]'}`}>
        {empty ? '—' : value}
      </dd>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-6 py-5 border-b border-[var(--sand,#B8A878)]/10 last:border-b-0">
      <h3 className="text-xs uppercase tracking-[0.15em] text-[var(--sand,#B8A878)] font-semibold mb-4">
        {title}
      </h3>
      <dl className="grid grid-cols-3 gap-x-6 gap-y-5">{children}</dl>
    </section>
  );
}

export function Chip({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'green' | 'warn' | 'muted' }) {
  const tones = {
    default: 'bg-[var(--primary,#1F3A2E)]/10 text-[var(--primary,#1F3A2E)]',
    green: 'bg-emerald-100 text-emerald-800',
    warn: 'bg-[var(--terracotta,#B8542A)]/15 text-[var(--terracotta,#B8542A)]',
    muted: 'bg-stone-200 text-stone-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function ChipList({ items }: { items: string[] | null | undefined }) {
  if (!items || items.length === 0) return <span className="text-[var(--primary,#1F3A2E)]/30 italic text-sm">—</span>;
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
      <p className="text-[var(--primary,#1F3A2E)]/50">{message}</p>
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
