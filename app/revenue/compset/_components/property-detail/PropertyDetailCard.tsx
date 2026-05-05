// app/revenue/compset/_components/property-detail/PropertyDetailCard.tsx
//
// Section 1 (left half) of the deep-view: editable property attributes.
// Edit button is visible but a no-op for now (per spec — schema-edit lands
// with the settings sub-pages).

'use client';

import { EMPTY } from '@/lib/format';
import type { CompetitorPropertyDetailRow } from '../types';

interface Props {
  detail: CompetitorPropertyDetailRow | null;
  fallbackName: string;
}

const cardStyle: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 4,
  padding: '18px 20px',
};

const headRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
};

const eyebrowStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  color: 'var(--brass)',
  fontWeight: 600,
};

const editBtnStyle: React.CSSProperties = {
  marginLeft: 'auto',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  color: 'var(--ink-mute)',
  background: 'transparent',
  border: '1px solid var(--paper-deep)',
  borderRadius: 3,
  padding: '4px 8px',
  cursor: 'not-allowed',
  fontWeight: 600,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  padding: '6px 0',
  borderBottom: '1px dashed var(--paper-deep)',
  fontSize: 'var(--t-sm)',
  gap: 12,
};

const keyStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)',
  textTransform: 'uppercase',
  color: 'var(--ink-mute)',
};

const valStyle: React.CSSProperties = {
  color: 'var(--ink)',
  fontWeight: 500,
  textAlign: 'right',
};

function fmtCity(d: CompetitorPropertyDetailRow | null): string {
  if (!d) return EMPTY;
  if (d.city && d.country) return `${d.city}, ${d.country}`;
  return d.city ?? d.country ?? EMPTY;
}

export default function PropertyDetailCard({ detail, fallbackName }: Props) {
  const name = detail?.property_name ?? fallbackName;
  return (
    <div style={cardStyle}>
      <div style={headRowStyle}>
        <span style={eyebrowStyle}>PROPERTY</span>
        <button type="button" style={editBtnStyle} disabled title="Edit lands with settings sub-pages">
          EDIT
        </button>
      </div>
      <div
        style={{
          fontFamily: 'var(--serif)',
          fontStyle: 'italic',
          fontSize: 'var(--t-xl)',
          color: 'var(--brass)',
          fontWeight: 500,
          marginBottom: 8,
          lineHeight: 1.2,
        }}
      >
        {name}
      </div>
      <div style={rowStyle}>
        <span style={keyStyle}>STAR RATING</span>
        <span style={valStyle}>
          {detail?.star_rating != null ? `★ ${detail.star_rating}` : EMPTY}
        </span>
      </div>
      <div style={rowStyle}>
        <span style={keyStyle}>ROOMS</span>
        <span style={valStyle}>{detail?.rooms ?? EMPTY}</span>
      </div>
      <div style={rowStyle}>
        <span style={keyStyle}>LOCATION</span>
        <span style={valStyle}>{fmtCity(detail)}</span>
      </div>
      <div style={rowStyle}>
        <span style={keyStyle}>TARGET ROOM TYPE</span>
        <span style={valStyle}>{detail?.room_type_target ?? EMPTY}</span>
      </div>
      <div style={{ ...rowStyle, borderBottom: 'none' }}>
        <span style={keyStyle}>SCRAPE PRIORITY</span>
        <span style={valStyle}>{detail?.scrape_priority ?? EMPTY}</span>
      </div>
    </div>
  );
}
