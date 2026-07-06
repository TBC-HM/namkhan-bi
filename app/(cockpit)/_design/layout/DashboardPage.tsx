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
//
// 2026-05-24 (PBS #157): HeaderPills (temp · AQ · date · user) restored on the
// new shell. The legacy <Page> shell auto-renders HeaderPills, so marketing /
// operations / sales had the strip. The new <DashboardPage> shell never did,
// so the Revenue area lost the strip when it migrated to primitives. We now
// render HeaderPills inside the stickyTop block, one row above the page title,
// matching "one line below the main menu" placement.

'use client';

import type { CSSProperties, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { DashboardPageProps, DashboardTab } from '../types';
import HeaderPills from '@/components/page/HeaderPills';
import { findSubGroup } from '@/lib/nav-subgroups';
import '../internal/tokens.css';

export default function DashboardPage(props: DashboardPageProps) {
  // PBS 2026-07-07: page subtitle intentionally NOT rendered — the noise sentences under
  // every page title were unread. Prop still accepted so callers don't break.
  const { title, tabs, action, children, kpiTiles, hideWeather } = props;
  const pathname = usePathname() ?? '';
  const subGroup = findSubGroup(pathname);

  // PBS 2026-07-07: smart active. A tab is active if pathname matches its href, OR the
  // pathname sits in a subgroup whose parentHref matches this tab. Keeps the parent tab
  // highlighted while an operator drills into any child.
  const smartTabs = tabs?.map(t => {
    if (t.active) return t;
    const isExact = t.href && (pathname === t.href || pathname === t.href.split('?')[0]);
    const isSubgroupParent = subGroup && t.href === subGroup.parentHref;
    return isExact || isSubgroupParent ? { ...t, active: true } : t;
  });

  return (
    <div className="cockpit-design" style={S.shell}>
      <div style={S.stickyTop}>
        {/* PBS #157 — temp / AQ / date / user line, just below TopDeptStrip. */}
        <div style={S.pillsRow}>
          <HeaderPills kpiTiles={kpiTiles} hideWeather={hideWeather} />
        </div>
        <header style={S.topBar}>
          <div style={S.titleStack}>
            <h1 style={S.title}>{title}</h1>
          </div>
          {action && <div style={S.action}>{action}</div>}
        </header>
        {smartTabs && smartTabs.length > 0 && <TabStrip tabs={smartTabs} />}
        {subGroup && <SubTabStrip pathname={pathname} tabs={subGroup.tabs} />}
      </div>
      <main style={S.body}>{children}</main>
    </div>
  );
}

// PBS 2026-07-07: renders a second sticky sub-tab row when a subgroup matches
// the current pathname. See lib/nav-subgroups.ts for the config.
function SubTabStrip({ pathname, tabs }: { pathname: string; tabs: { label: string; href: string }[] }) {
  return (
    <nav style={S.subTabStrip} role="tablist" aria-label="Sub-section">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname === t.href.split('?')[0];
        const style: CSSProperties = { ...S.subTab, ...(active ? S.subTabActive : null) };
        return <a key={t.href} href={t.href} role="tab" aria-selected={active} style={style}>{t.label}</a>;
      })}
    </nav>
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
  // PBS 2026-07-07: tightened top spacing — was 24/32/64 padding + gap 24.
  shell: {
    minHeight: '100vh',
    padding: '12px 24px 48px',
    maxWidth: 1440,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
  },
  stickyTop: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: 'var(--paper, #FFFFFF)',
    paddingTop: 6,
    paddingBottom: 2,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    borderBottom: '1px solid var(--hairline, #E6DFCC)',
  },
  pillsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    minHeight: 24,
  },
  topBar: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  titleStack: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--ink, #1B1B1B)' },
  subtitle: { margin: 0, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)' },
  action: { display: 'flex', alignItems: 'center', gap: 8 },
  tabStrip: { display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--hairline, #E6DFCC)', flexWrap: 'wrap' },
  parentGroup: { display: 'flex', gap: 4, paddingRight: 12, borderRight: '1px solid var(--hairline, #E6DFCC)' },
  tabGroup: { display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 },
  parentLink: {
    background: 'transparent',
    border: 'none',
    padding: '6px 0',
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
    padding: '6px 12px',
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
  // PBS 2026-07-07 evening: industry-standard tab row — no box, no border-radius.
  // Same underline treatment as the main strip so the two rows feel consistent.
  subTabStrip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  subTab: {
    background: 'transparent',
    border: 'none',
    padding: '4px 8px',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--ink-soft, #5A5A5A)',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    textDecoration: 'none',
    fontFamily: 'inherit',
  },
  subTabActive: { color: 'var(--ink, #1B1B1B)', borderBottomColor: 'var(--primary, #1F3A2E)', fontWeight: 600 },
  body: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: 10,
    alignItems: 'start',
    marginTop: 4,
  },
};
