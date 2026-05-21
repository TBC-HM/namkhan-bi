// DashboardPage — every cockpit page sits inside this template.
// Owns the `.cockpit-design` scoped-token wrapper that activates v5 tokens
// for everything nested below.
//
// 2026-05-19: body switched from flex-column to grid (auto-fit, minmax 360).
// Containers are *containers* — they pack side-by-side when there's room.
// A child that needs to span the row should set
// `style={{ gridColumn: '1 / -1' }}` on its outer wrap (SplitContainer does this).
//
// 2026-05-21 (rev-consolidation SEQ 6/6 · cockpit ticket #198): HoD-as-parent.
// A tab whose label is "HoD" is rendered as a left-aligned "← HoD" breadcrumb,
// not as one of the equal sibling tabs. This enforces the hierarchy: HoD is the
// landing page; everything else is a sub-section under it.

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
  // Split "HoD" entries off the regular tab list — they render as a
  // left-aligned breadcrumb so the rest of the strip becomes a secondary
  // sub-nav under the HoD landing.
  const parents = tabs.filter((t) => t.label === 'HoD');
  const others  = tabs.filter((t) => t.label !== 'HoD');
  return (
    <nav style={S.tabStrip} role="tablist" aria-label="Page sections">
      {parents.length > 0 && (
        <div style={S.parentGroup}>
          {parents.map((t) => <ParentLink key={t.key} tab={t} />)}
        </div>
      )}
      {others.length > 0 && (
        <div style={S.tabGroup}>
          {others.map((t) => <TabButton key={t.key} tab={t} />)}
        </div>
      )}
    </nav>
  );
}

function ParentLink({ tab }: { tab: DashboardTab }) {
  const label = `← ${tab.label}`;
  if (tab.href) return <a href={tab.href} style={S.parentLink}>{label}</a>;
  return <button type="button" onClick={tab.onSelect} style={S.parentLink}>{label}</button>;
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
  tabStrip: { display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--hairline, #E6DFCC)', flexWrap: 'wrap' },
  parentGroup: { display: 'flex', gap: 4, paddingRight: 12, borderRight: '1px solid var(--hairline, #E6DFCC)' },
  tabGroup: { display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 },
  parentLink: {
    background: 'transparent',
    border: 'none',
    padding: '8px 0',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--ink-soft, #5A5A5A)',
    cursor: 'pointer',
    textDecoration: 'none',
    fontFamily: 'inherit',
    letterSpacing: '0.04em',
  },
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
