'use client';
// app/marketing/youtube/_client/ExpandableSection.tsx
// PBS 2026-07-13 — YouTube-pro-style expandable dashboard card.
// Server pre-renders every row as a React node; this client wrapper only
// toggles show/hide state — no function props cross the RSC boundary.

import { useState } from 'react';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';

const CARD: React.CSSProperties = {
  background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 20,
  gridColumn: '1 / -1',
};
const SECTION_H: React.CSSProperties = {
  fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M,
  marginBottom: 12, fontWeight: 500,
};

interface Props {
  title: string;
  subtitle?: string;
  count?: number;
  initialRows?: number;
  children?: React.ReactNode;
  collapsedChildren?: React.ReactNode;
  expandedChildren?: React.ReactNode;
  rows?: React.ReactNode[];
  expandLabel?: string;
  collapseLabel?: string;
  emptyState?: React.ReactNode;
}

export default function ExpandableSection({
  title,
  subtitle,
  count,
  initialRows = 5,
  children,
  collapsedChildren,
  expandedChildren,
  rows,
  expandLabel,
  collapseLabel,
  emptyState,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const hasRows = Array.isArray(rows) && rows.length > 0;
  const totalRows = hasRows ? rows!.length : 0;
  const canExpand =
    (hasRows && totalRows > initialRows) ||
    (Boolean(collapsedChildren) && Boolean(expandedChildren));

  const visibleRows = hasRows
    ? (expanded ? rows! : rows!.slice(0, initialRows))
    : null;

  const defaultExpandLabel = hasRows
    ? `Show all ${totalRows}`
    : 'Show details';
  const defaultCollapseLabel = 'Show less';

  return (
    <div style={CARD}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 12, gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ ...SECTION_H, marginBottom: 0 }}>
            {title}
            {typeof count === 'number' && (
              <span style={{ color: INK, fontWeight: 500, marginLeft: 8 }}>({count})</span>
            )}
          </div>
          {subtitle && (
            <div style={{ fontSize: 11, color: INK_M, marginTop: 4 }}>{subtitle}</div>
          )}
        </div>
        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              padding: '6px 12px', border: `1px solid ${HAIR}`, borderRadius: 3,
              background: WHITE, color: FOREST, fontSize: 11, cursor: 'pointer',
              letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 500,
            }}>
            {expanded ? (collapseLabel ?? defaultCollapseLabel) : (expandLabel ?? defaultExpandLabel)}
          </button>
        )}
      </div>

      {hasRows && totalRows === 0 && emptyState}
      {hasRows && totalRows > 0 && (
        <div style={{ display: 'grid', gap: 0 }}>
          {visibleRows}
        </div>
      )}

      {!hasRows && collapsedChildren && expandedChildren && (
        expanded ? expandedChildren : collapsedChildren
      )}

      {!hasRows && !collapsedChildren && !expandedChildren && children}
    </div>
  );
}
