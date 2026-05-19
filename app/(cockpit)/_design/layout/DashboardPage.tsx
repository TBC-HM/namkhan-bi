// DashboardPage — every cockpit page sits inside this template.
// Owns the `.cockpit-design` scoped-token wrapper that activates v5 tokens
// for everything nested below.
//
// 2026-05-19: body switched from flex-column to grid (auto-fit, minmax 360).
// Containers are *containers* — they pack side-by-side when there's room.
// A child that needs to span the row should set
// `style={{ gridColumn: '1 / -1' }}` on its outer wrap (SplitContainer does this).

'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { DashboardPageProps, DashboardTab } from '../types';
import '../internal/tokens.css';

export default function DashboardPage(props: DashboardPageProps) {
  const { title, subtitle, tabs, action, children } = props;
  return (
    <div className="cockpit-design" style={S.shell}>
      <header style={S.topBar}>
        <div style={S.titleStack}>
          <h1 style={S.title}>{title}</h1>
          {subtitle && <p style={S.subtitle}>{subtitle}</p>}
        </div>
        {action && <div style={S.action}>{action}</div>}
      </header>
      {tabs && tabs.length > 0 && <TabStrip tabs={tabs} />}
      <main style={S.body}>{children}</main>
    </div>
  );
}

function TabStrip({ tabs }: { tabs: DashboardTab[] }) {
  return (
    <nav style={S.tabStrip} role="tablist" aria-label="Page sections">
      {tabs.map((t) => <TabButton key={t.key} tab={t} />)}
    </nav>
  );
}

function TabButton({ tab }: { tab: DashboardTab }) {
  const active = !!tab.active;
  const content: ReactNode = (
    <span style={S.tabInner}>
      <span>{tab.label}</span>
      {typeof tab.count === 'number' && <span style={S.tabCount}>{tab.count}</span>}
    </span>
  );
  const baseStyle: CSSProperties = { ...S.tab, ...(active ? S.tabActive : null) };
  if (tab.href) return <a href={tab.href} role="tab" aria-selected={active} style={baseStyle}>{content}</a>;
  return <button type="button" role="tab" aria-selected={active} onClick={tab.onSelect} style={baseStyle}>{content}</button>;
}

const S: Record<string, CSSProperties> = {
  shell: {
    minHeight: '100vh',
    padding: '24px 32px 64px',
    maxWidth: 1440,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
  },
  topBar: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  titleStack: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  title: { margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--ink, #1B1B1B)' },
  subtitle: { margin: 0, fontSize: 13, color: 'var(--ink-soft, #5A5A5A)' },
  action: { display: 'flex', alignItems: 'center', gap: 8 },
  tabStrip: { display: 'flex', gap: 4, borderBottom: '1px solid var(--hairline, #E6DFCC)', flexWrap: 'wrap' },
  tab: {
    background: 'transparent',
    border: 'none',
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--ink-soft, #5A5A5A)',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    textDecoration: 'none',
    fontFamily: 'inherit',
  },
  tabActive: { color: 'var(--ink, #1B1B1B)', borderBottomColor: 'var(--primary, #1F3A2E)', fontWeight: 600 },
  tabInner: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  tabCount: { fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', background: 'var(--bg, #F4EFE2)', borderRadius: 99, padding: '0 6px', fontWeight: 500 },
  body: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: 16,
    alignItems: 'start',
  },
};
