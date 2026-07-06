// components/marketing/SourceBadge.tsx
// PBS 2026-07-03: small pill/icon that marks the data source (Google, TA, Booking, etc.)
// Uses text/emoji + brand-appropriate colour. Emoji-free option available if PBS prefers.

import React from 'react';

export type SourceKey =
  | 'google'
  | 'tripadvisor'
  | 'booking'
  | 'expedia'
  | 'ctrip'
  | 'agoda'
  | 'cloudbeds'
  | 'direct'
  | 'website'
  | 'youtube'
  | 'instagram'
  | 'facebook';

interface SourceMeta { label: string; bg: string; fg: string; brd: string; glyph: string; }

const META: Record<SourceKey, SourceMeta> = {
  google:      { label: 'Google',       bg:'#FFFFFF', fg:'#3A3A3A', brd:'#DADCE0', glyph:'G' },
  tripadvisor: { label: 'TripAdvisor',  bg:'#00A680', fg:'#FFFFFF', brd:'#00875C', glyph:'TA' },
  booking:     { label: 'Booking.com',  bg:'#003580', fg:'#FFFFFF', brd:'#002466', glyph:'B' },
  expedia:     { label: 'Expedia',      bg:'#FFC72C', fg:'#1B1B1B', brd:'#E5B325', glyph:'E' },
  ctrip:       { label: 'Trip.com',     bg:'#2681FF', fg:'#FFFFFF', brd:'#1B6ADF', glyph:'T' },
  agoda:       { label: 'Agoda',        bg:'#5392F9', fg:'#FFFFFF', brd:'#3B7BE0', glyph:'A' },
  cloudbeds:   { label: 'Cloudbeds',    bg:'#1F3A2E', fg:'#FFFFFF', brd:'#173025', glyph:'CB' },
  direct:      { label: 'Direct',       bg:'#F5F0E1', fg:'#1F3A2E', brd:'#E6DFCC', glyph:'NK' },
  website:     { label: 'Website',      bg:'#F5F0E1', fg:'#1F3A2E', brd:'#E6DFCC', glyph:'NK' },
  youtube:     { label: 'YouTube',      bg:'#FF0000', fg:'#FFFFFF', brd:'#CC0000', glyph:'YT' },
  instagram:   { label: 'Instagram',    bg:'#E1306C', fg:'#FFFFFF', brd:'#C02659', glyph:'IG' },
  facebook:    { label: 'Facebook',     bg:'#1877F2', fg:'#FFFFFF', brd:'#155DBB', glyph:'FB' },
};

interface Props {
  source: string;
  size?: 'sm' | 'md';
  withLabel?: boolean;
  style?: React.CSSProperties;
}

export default function SourceBadge({ source, size = 'sm', withLabel = false, style }: Props) {
  const key = (source ?? '').toLowerCase() as SourceKey;
  const m = META[key];
  if (!m) return null;
  const dim = size === 'md' ? 22 : 18;
  const fs  = size === 'md' ? 10 : 9;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:6,
      fontFamily:'system-ui, -apple-system, sans-serif',
      ...style,
    }}>
      <span style={{
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        minWidth: dim, height: dim,
        padding:'0 5px',
        background: m.bg, color: m.fg,
        border:'1px solid '+m.brd, borderRadius: 4,
        fontSize: fs, fontWeight: 700, letterSpacing:'0.02em',
        lineHeight: 1,
        boxSizing:'border-box',
      }} title={m.label}>{m.glyph}</span>
      {withLabel && (
        <span style={{ fontSize: fs + 1, color: '#5A5A5A', fontWeight: 500 }}>{m.label}</span>
      )}
    </span>
  );
}