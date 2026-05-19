// Container — grouping card with title / subtitle / action / body.
// Spec: design_system v5 §3.3. Density controls padding.
// Provides ContainerActionProvider so a nested <Chart dimensions={...}>
// can portal its dimension dropdown into the header action slot.

'use client';

import { useMemo, useRef, type CSSProperties } from 'react';
import type { ContainerProps } from '../types';
import { ContainerActionProvider, type ContainerActionCtx } from '../internal/container-action';
import { statusColor } from '../internal/status';
import Skeleton from '../internal/Skeleton';
import '../internal/tokens.css';

const PADDING: Record<'comfortable' | 'compact', number> = { comfortable: 24, compact: 12 };

export default function Container(props: ContainerProps) {
  const { title, subtitle, action, children, density = 'comfortable', loading, status, className } = props;
  const actionRef = useRef<HTMLDivElement | null>(null);
  const ctx = useMemo<ContainerActionCtx>(
    () => ({ ref: actionRef, hasUserAction: action !== undefined }),
    [action],
  );
  const pad = PADDING[density];

  const wrapStyle: CSSProperties = {
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

  return (
    <ContainerActionProvider value={ctx}>
      <section style={wrapStyle} className={className} aria-busy={loading || undefined}>
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
          </div>
        </header>
        <div style={S.body}>
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

const S: Record<string, CSSProperties> = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  titleStack: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  titleRow: { display: 'flex', alignItems: 'center', gap: 8 },
  title: { margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink, #1B1B1B)', lineHeight: 1.2 },
  subtitle: { margin: 0, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)' },
  actionWrap: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  body: { display: 'flex', flexDirection: 'column', gap: 12 },
};
