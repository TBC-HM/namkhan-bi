// app/revenue/compset/_components/property-detail/ChannelUrlsCard.tsx
//
// Section 1 (right half): per-channel URL grid with status pill + Open ↗ link.
// Edit button no-op (lands with settings sub-pages).

'use client';

import StatusPill from '@/components/ui/StatusPill';
import { DEEP_VIEW_CHANNELS, type CompetitorPropertyDetailRow } from '../types';

interface Props {
  detail: CompetitorPropertyDetailRow | null;
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
  display: 'grid',
  gridTemplateColumns: '110px 90px 1fr auto',
  alignItems: 'center',
  gap: 10,
  padding: '8px 0',
  borderBottom: '1px dashed var(--paper-deep)',
  fontSize: 'var(--t-sm)',
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)',
  textTransform: 'uppercase',
  color: 'var(--ink-mute)',
};

const urlStyle: React.CSSProperties = {
  color: 'var(--ink-soft)',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const openLinkStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  color: 'var(--brass)',
  textDecoration: 'none',
  fontWeight: 600,
};

function urlPreview(u: string): string {
  try {
    const parsed = new URL(u);
    const path = parsed.pathname.length > 18 ? parsed.pathname.slice(0, 18) + '…' : parsed.pathname;
    return parsed.hostname.replace(/^www\./, '') + path;
  } catch {
    return u.length > 36 ? u.slice(0, 36) + '…' : u;
  }
}

export default function ChannelUrlsCard({ detail }: Props) {
  return (
    <div style={cardStyle}>
      <div style={headRowStyle}>
        <span style={eyebrowStyle}>CHANNEL URLS</span>
        <button type="button" style={editBtnStyle} disabled title="Edit lands with settings sub-pages">
          EDIT
        </button>
      </div>
      {DEEP_VIEW_CHANNELS.map((c, i) => {
        const url = (detail?.[`${c.key}_url` as keyof CompetitorPropertyDetailRow] as string | null) ?? null;
        const isLast = i === DEEP_VIEW_CHANNELS.length - 1;
        return (
          <div
            key={c.key}
            style={{ ...rowStyle, borderBottom: isLast ? 'none' : rowStyle.borderBottom }}
          >
            <span style={labelStyle}>{c.label}</span>
            {url ? (
              <StatusPill tone="active">LIVE</StatusPill>
            ) : (
              <StatusPill tone="inactive">MISSING</StatusPill>
            )}
            <span style={urlStyle} title={url ?? ''}>
              {url ? urlPreview(url) : '—'}
            </span>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={openLinkStyle}
                title={url}
              >
                OPEN ↗
              </a>
            ) : (
              <span style={{ ...openLinkStyle, color: 'var(--ink-faint)' }}>—</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
