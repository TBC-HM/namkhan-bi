// Single tile for the inventory grid.
// Colored left stripe + WIRED / NOT WIRED / PARTIAL badge.
// Per brief: explicit RGB tints; borders fall back to hex if brand tokens
// --terracotta / --sand are not yet declared in globals.css.

import type { InventoryRow, StatusColor } from '../lib/types';

interface Palette {
  bg: string;
  border: string;
  badge: string;
  badgeText: string;
}

const PALETTE: Record<StatusColor, Palette> = {
  green: {
    bg:        'rgba(56, 142, 60, 0.10)',
    border:    '#2E7D32',
    badge:     '#2E7D32',
    badgeText: '#FFFFFF',
  },
  red: {
    bg:        'rgba(184, 84, 42, 0.10)',
    border:    'var(--terracotta, #B8542A)',
    badge:     'var(--terracotta, #B8542A)',
    badgeText: '#FFFFFF',
  },
  amber: {
    bg:        'rgba(184, 168, 120, 0.20)',
    border:    'var(--sand, #B8A878)',
    badge:     'var(--sand, #B8A878)',
    badgeText: '#1a160f',
  },
};

const BADGE_LABEL: Record<StatusColor, string> = {
  green: 'WIRED',
  red:   'NOT WIRED',
  amber: 'PARTIAL',
};

export default function InventoryTile({ row }: { row: InventoryRow }) {
  const p = PALETTE[row.status_color] ?? PALETTE.red;
  const codeLabel = row.kind === 'kpi' ? `#${row.code}` : row.code;
  const subline =
    row.kind === 'container'
      ? `${(row.bound_views ?? []).length} view${(row.bound_views ?? []).length === 1 ? '' : 's'}`
      : row.primary_view ?? '—';

  return (
    <article
      style={{
        position: 'relative',
        background: p.bg,
        border: `1px solid ${p.border}`,
        borderLeft: `4px solid ${p.border}`,
        borderRadius: 8,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minHeight: 132,
      }}
    >
      <div style={S.codeRow}>
        <span style={S.code}>{codeLabel}</span>
        <span style={S.name}>· {row.name}</span>
      </div>

      <div style={S.subline}>↳ {subline}</div>

      <div style={S.metaRow}>
        {row.section && <span style={S.metaPill}>{row.section}</span>}
        {row.data_status && <span style={S.metaPill}>{row.data_status}</span>}
        {row.chart_type && <span style={{ ...S.metaPill, ...S.chartPill }}>{row.chart_type}</span>}
        {row.kind === 'kpi' && (
          <span style={S.flagPair}>
            <span title="Namkhan">🇱🇦 {row.served_by_namkhan ? '✓' : '–'}</span>
            <span title="Donna" style={{ marginLeft: 6 }}>🇪🇸 {row.served_by_donna ? '✓' : '–'}</span>
          </span>
        )}
      </div>

      {row.notes && <div style={S.notes}>{row.notes}</div>}

      <div style={S.badgeWrap}>
        <span
          style={{
            ...S.badge,
            background: p.badge,
            color: p.badgeText,
          }}
        >
          {BADGE_LABEL[row.status_color]}
        </span>
      </div>
    </article>
  );
}

const S: Record<string, React.CSSProperties> = {
  codeRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
    flexWrap: 'wrap',
  },
  code: {
    fontFamily: 'var(--mono, "JetBrains Mono", ui-monospace, monospace)',
    fontSize: 12,
    letterSpacing: '0.04em',
    color: 'var(--ink, #fbf6e9)',
    fontWeight: 600,
  },
  name: {
    fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
    fontSize: 13,
    color: 'var(--ink, #fbf6e9)',
    fontWeight: 500,
  },
  subline: {
    fontFamily: 'var(--mono, "JetBrains Mono", ui-monospace, monospace)',
    fontSize: 11,
    color: 'var(--ink-mute, #cfc3a3)',
    wordBreak: 'break-all',
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
    fontSize: 11,
    color: 'var(--ink-soft, #ead9b4)',
  },
  metaPill: {
    fontFamily: 'var(--mono, "JetBrains Mono", ui-monospace, monospace)',
    fontSize: 10,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '2px 6px',
    border: '1px solid var(--line-soft, rgba(251, 246, 233, 0.15))',
    borderRadius: 4,
    color: 'var(--ink-soft, #ead9b4)',
  },
  chartPill: {
    background: 'rgba(251, 246, 233, 0.06)',
    borderColor: 'var(--line, rgba(251, 246, 233, 0.26))',
  },
  flagPair: {
    fontSize: 11,
    color: 'var(--ink-soft, #ead9b4)',
    marginLeft: 'auto',
  },
  notes: {
    fontSize: 11,
    color: 'var(--ink-faint, #a59a7d)',
    lineHeight: 1.4,
    fontStyle: 'italic',
  },
  badgeWrap: {
    marginTop: 'auto',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  badge: {
    fontFamily: 'var(--mono, "JetBrains Mono", ui-monospace, monospace)',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.08em',
    padding: '3px 8px',
    borderRadius: 4,
    textTransform: 'uppercase',
  },
};
