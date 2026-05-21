// Container — grouping card with title / subtitle / action / body.
// Spec: design_system v5 §3.3. Density controls padding.
// Provides ContainerActionProvider so a nested <Chart dimensions={...}>
// can portal its dimension dropdown into the header action slot.
//
// 2026-05-21: every Container now ships with an expand-to-fullscreen toggle
// in the top-right corner. PBS wanted it everywhere with one change —
// shipped by editing the primitive once; every consumer page picks it up
// automatically. Pass `expandable={false}` on tiny tiles where the toggle
// would be visual noise (KpiTile already opts out by not using Container).

'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { ContainerProps } from '../types';
import { ContainerActionProvider, type ContainerActionCtx } from '../internal/container-action';
import { statusColor } from '../internal/status';
import Skeleton from '../internal/Skeleton';
import '../internal/tokens.css';

const PADDING: Record<'comfortable' | 'compact', number> = { comfortable: 24, compact: 12 };

export default function Container(props: ContainerProps) {
  const { title, subtitle, action, children, density = 'comfortable', loading, status, className, expandable = true } = props;
  const actionRef = useRef<HTMLDivElement | null>(null);
  const ctx = useMemo<ContainerActionCtx>(
    () => ({ ref: actionRef, hasUserAction: action !== undefined }),
    [action],
  );
  const pad = PADDING[density];
  const [expanded, setExpanded] = useState(false);

  // ESC key collapses the overlay.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    // Lock body scroll while overlay open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [expanded]);

  const wrapStyle: CSSProperties = expanded
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--paper, #FFFFFF)',
        border: 'none',
        borderRadius: 0,
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        color: 'var(--ink, #1B1B1B)',
        fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
        overflow: 'auto',
        boxShadow: '0 0 0 9999px rgba(15, 13, 10, 0.45)',
      }
    : {
        background: 'var(--paper, #FFFFFF)',
        border: '1px solid var(--hairline, #E6DFCC)',
        borderRadius: 8,
        padding: pad,
        display: 'flex',
        flexDirection: 'column',
        gap: density === 'compact' ? 8 : 16,
        color: 'var(--ink, #1B1B1B)',
        fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
      };

  const expandBtn = expandable ? (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      aria-label={expanded ? 'Collapse' : 'Expand'}
      title={expanded ? 'Collapse (Esc)' : 'Expand'}
      style={expandBtnStyle}
    >
      {expanded ? CollapseIcon : ExpandIcon}
    </button>
  ) : null;

  return (
    <ContainerActionProvider value={ctx}>
      <section style={wrapStyle} className={className} aria-busy={loading || undefined} aria-expanded={expanded || undefined}>
        <header style={S.header}>
          <div style={S.titleStack}>
            <div style={S.titleRow}>
              <h3 style={S.title}>{title}</h3>
              {status && (
                <span
                  aria-label={`status ${status}`}
                  style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor(status), flexShrink: 0 }}
                />
              )}
            </div>
            {subtitle && <p style={S.subtitle}>{subtitle}</p>}
          </div>
          <div style={S.actionWrap} ref={actionRef}>
            {action}
            {expandBtn}
          </div>
        </header>
        <div style={{ ...S.body, ...(expanded ? S.bodyExpanded : null) }}>
          {loading
            ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton height={14} width="80%" />
                <Skeleton height={14} width="60%" />
                <Skeleton height={14} width="70%" />
              </div>
            )
            : children}
        </div>
      </section>
    </ContainerActionProvider>
  );
}

const ExpandIcon = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="3 9 3 13 7 13" />
    <polyline points="13 7 13 3 9 3" />
    <line x1="3" y1="13" x2="7" y2="9" />
    <line x1="13" y1="3" x2="9" y2="7" />
  </svg>
);

const CollapseIcon = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="3 7 7 7 7 3" />
    <polyline points="13 9 9 9 9 13" />
    <line x1="3" y1="7" x2="7" y2="3" />
    <line x1="13" y1="9" x2="9" y2="13" />
  </svg>
);

const expandBtnStyle: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--hairline, #E6DFCC)',
  borderRadius: 4,
  width: 26,
  height: 26,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ink-soft, #5A5A5A)',
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
};

const S: Record<string, CSSProperties> = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  titleStack: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  titleRow: { display: 'flex', alignItems: 'center', gap: 8 },
  title: { margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink, #1B1B1B)', lineHeight: 1.2 },
  subtitle: { margin: 0, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)' },
  actionWrap: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  body: { display: 'flex', flexDirection: 'column', gap: 12 },
  bodyExpanded: { flex: 1, minHeight: 0 },
};
