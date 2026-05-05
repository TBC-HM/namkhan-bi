// app/revenue/compset/_components/property-detail/RankingsGrid.tsx
//
// Section 3 of the deep-view: 6-card 2×3 grid of platform ranking contexts.
// Empty cards render with em-dash + "Not yet shopped" so the grid stays
// shaped even when no data exists.

'use client';

import { EMPTY, fmtIsoDate } from '@/lib/format';
import {
  DEEP_VIEW_RANKING_CONTEXTS,
  type RankingLatestRow,
} from '../types';

interface Props {
  rows: RankingLatestRow[];
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 12,
};

const cardStyle: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 4,
  padding: '14px 16px',
  minHeight: 110,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const eyebrowStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  color: 'var(--brass)',
  fontWeight: 600,
};

const subEyebrowStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)',
  textTransform: 'uppercase',
  color: 'var(--ink-mute)',
};

const positionStyle: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontStyle: 'italic',
  fontSize: 'var(--t-2xl)',
  fontWeight: 500,
  color: 'var(--ink)',
  lineHeight: 1,
};

const positionEmptyStyle: React.CSSProperties = {
  ...positionStyle,
  color: 'var(--ink-faint)',
};

const totalStyle: React.CSSProperties = {
  color: 'var(--ink-mute)',
  fontSize: 'var(--t-xs)',
  fontFamily: 'var(--mono)',
};

const movementStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)',
  textTransform: 'uppercase',
  padding: '2px 6px',
  borderRadius: 3,
  alignSelf: 'flex-start',
};

const lastShopStyle: React.CSSProperties = {
  marginTop: 'auto',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)',
  textTransform: 'uppercase',
  color: 'var(--ink-mute)',
};

function MovementChip({ row }: { row: RankingLatestRow }) {
  if (row.movement === 'up' && row.positions_gained != null) {
    return (
      <span style={{ ...movementStyle, color: 'var(--moss-glow)', background: 'var(--paper-deep)' }}>
        ▲ {row.positions_gained}
      </span>
    );
  }
  if (row.movement === 'down' && row.positions_gained != null) {
    return (
      <span style={{ ...movementStyle, color: 'var(--st-bad)', background: 'var(--paper-deep)' }}>
        ▼ {Math.abs(row.positions_gained)}
      </span>
    );
  }
  if (row.movement === 'flat' || row.positions_gained === 0) {
    return (
      <span style={{ ...movementStyle, color: 'var(--ink-mute)', background: 'var(--paper-deep)' }}>
        → flat
      </span>
    );
  }
  return null;
}

export default function RankingsGrid({ rows }: Props) {
  // Index rows by channel + sort_order for O(1) lookup.
  const map = new Map<string, RankingLatestRow>();
  for (const r of rows) {
    map.set(`${r.channel}::${r.sort_order}`, r);
  }

  return (
    <div style={gridStyle}>
      {DEEP_VIEW_RANKING_CONTEXTS.map((ctx) => {
        const row = map.get(`${ctx.channel}::${ctx.sort_order}`);
        return (
          <div key={`${ctx.channel}-${ctx.sort_order}`} style={cardStyle}>
            <div style={eyebrowStyle}>{ctx.channel_label}</div>
            <div style={subEyebrowStyle}>{ctx.sort_label}</div>
            {row?.position != null ? (
              <>
                <div style={positionStyle}>#{row.position}</div>
                <div style={totalStyle}>
                  of {row.total_results != null ? row.total_results.toLocaleString('en-US') : EMPTY}
                </div>
                <MovementChip row={row} />
                <div style={lastShopStyle}>
                  Last shop {fmtIsoDate(row.shop_date)}
                </div>
              </>
            ) : (
              <>
                <div style={positionEmptyStyle}>{EMPTY}</div>
                <div style={totalStyle}>Not yet shopped</div>
                <div style={lastShopStyle}>—</div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
