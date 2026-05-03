// components/layout/PageHeader.tsx
//
// Canonical page header used across every pillar/tab.
// Three stacked elements: pillar > tab eyebrow, big serif h1 with italic
// brass accent, and a lede subtitle.
//
// Replaces inline duplication of:
//   <div style={{ fontSize:11, color:'var(--ink-mute)', textTransform:'uppercase', ...}}>
//     <strong style={{color:'var(--ink-soft)'}}>Pillar</strong> › Tab
//   </div>
//   <h1 style={{margin:'4px 0 2px', fontFamily:'Georgia, serif', fontWeight:500, fontSize:30}}>
//     Some title with <em style={{color:'var(--brass)'}}>accent</em> here.
//   </h1>
//   <div style={{fontSize:13, color:'var(--ink-soft)'}}>Lede goes here.</div>
//
// Same markup, same tokens, same spacing — every time.

import { ReactNode } from 'react';

interface PageHeaderProps {
  /** Eyebrow pillar text (e.g. "Sales"). Optional — omit for landing pages. */
  pillar?: string;
  /** Eyebrow tab text after › (e.g. "Inquiries"). Required if pillar is set. */
  tab?: string;
  /** The page title. Pass a string, or JSX with an <em> for the brass accent. */
  title: ReactNode;
  /** One-line subtitle (lede) under the title. Optional. */
  lede?: ReactNode;
  /** Right-rail content (live indicator, period chips, etc). Optional. */
  rightSlot?: ReactNode;
}

export default function PageHeader({ pillar, tab, title, lede, rightSlot }: PageHeaderProps) {
  return (
    <header style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {pillar && (
          <div className="t-eyebrow" style={{ marginBottom: 2 }}>
            <strong style={{ color: 'var(--ink-soft)' }}>{pillar}</strong>
            {tab && <span style={{ margin: '0 6px', color: 'var(--ink-faint)' }}>›</span>}
            {tab}
          </div>
        )}
        <h1
          style={{
            margin: '4px 0 2px',
            fontFamily: 'var(--serif)',
            fontWeight: 500,
            fontSize: 'var(--t-2xl)',
            letterSpacing: 'var(--ls-tight)',
            lineHeight: 1.1,
            fontVariationSettings: '"opsz" 144',
          }}
        >
          {title}
        </h1>
        {lede && (
          <div style={{ fontSize: 'var(--t-base)', color: 'var(--ink-soft)', marginTop: 2 }}>
            {lede}
          </div>
        )}
      </div>
      {rightSlot && <div style={{ flexShrink: 0 }}>{rightSlot}</div>}
    </header>
  );
}
