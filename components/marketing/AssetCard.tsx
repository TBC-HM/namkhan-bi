// components/marketing/AssetCard.tsx
// Single asset thumb tile. Click → dispatch 'asset:open' with asset_id.

'use client';

import type { MediaAssetReady } from '@/lib/marketing';
import { TIER_LABEL } from '@/lib/marketing';

interface Props {
  asset: MediaAssetReady;
  thumbUrl: string | null;
  selected?: boolean;
  onSelectChange?: (id: string, picked: boolean) => void;
  reasonText?: string;     // optional 1-line reason for AI proposal step
  scoreLabel?: string;     // optional score badge for AI proposal step
}

const TIER_BG: Record<string, string> = {
  tier_ota_profile:  'var(--moss)',
  tier_website_hero: 'var(--brass)',
  tier_social_pool:  '#6b6f72',
  tier_internal:     'transparent',
};

export default function AssetCard({ asset, thumbUrl, selected, onSelectChange, reasonText, scoreLabel }: Props) {
  function open() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('asset:open', { detail: { asset_id: asset.asset_id } }));
  }

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (onSelectChange) onSelectChange(asset.asset_id, !selected);
  }

  const tier = asset.primary_tier ?? null;
  const tierBg = tier && tier in TIER_BG ? TIER_BG[tier] : 'transparent';

  return (
    <div
      onClick={open}
      style={{
        background: 'var(--paper)',
        border: selected ? '2px solid var(--moss)' : '1px solid var(--line)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'transform 80ms ease',
        position: 'relative',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.01)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
    >
      <div style={{ aspectRatio: '4 / 3', background: '#1a1a1a', position: 'relative', overflow: 'hidden' }}>
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt={asset.alt_text ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#888', fontFamily: 'var(--mono)', fontSize: 10 }}>
            no render yet
          </div>
        )}

        {tier && tier !== 'tier_internal' && (
          <div style={{
            position: 'absolute', top: 6, left: 6,
            background: tierBg, color: 'var(--paper-warm)',
            fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 600,
            padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {TIER_LABEL[tier as keyof typeof TIER_LABEL] ?? tier}
          </div>
        )}

        {asset.license_type && (
          <div style={{
            position: 'absolute', top: 6, right: 6,
            background: 'rgba(0,0,0,0.6)', color: 'var(--paper-warm)',
            fontFamily: 'var(--mono)', fontSize: 9,
            padding: '2px 6px',
          }}>
            {asset.license_type}
          </div>
        )}

        {scoreLabel && (
          <div style={{
            position: 'absolute', bottom: 6, left: 6,
            background: 'var(--brass)', color: 'var(--paper-warm)',
            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
            padding: '3px 8px',
          }}>
            {scoreLabel}
          </div>
        )}

        {onSelectChange && (
          <button
            onClick={toggle}
            aria-label={selected ? 'unselect' : 'select'}
            style={{
              position: 'absolute', bottom: 6, right: 6,
              width: 24, height: 24, borderRadius: '50%',
              border: 'none',
              background: selected ? 'var(--moss)' : 'rgba(255,255,255,0.85)',
              color: selected ? 'var(--paper-warm)' : 'var(--ink)',
              cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
            }}
          >{selected ? '✓' : '+'}</button>
        )}
      </div>

      <div style={{ padding: '8px 10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink)', lineHeight: 1.3 }}>
          {asset.caption ?? asset.original_filename}
        </div>
        {reasonText && (
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--ink-soft)', fontStyle: 'italic' }}>
            {reasonText}
          </div>
        )}
        {asset.tags && asset.tags.length > 0 && (
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {asset.tags.slice(0, 4).map(t => (
              <span key={t} style={{
                fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-mute)',
                background: 'var(--line-soft, #efeae0)', padding: '1px 5px',
              }}>{t}</span>
            ))}
            {asset.tags.length > 4 && (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-mute)' }}>
                +{asset.tags.length - 4}
              </span>
            )}
          </div>
        )}
        <div style={{ marginTop: 'auto', paddingTop: 6, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-mute)' }}>
          {asset.captured_at ? new Date(asset.captured_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
          {' · '}
          {asset.width_px ?? '?'}×{asset.height_px ?? '?'}
        </div>
      </div>
    </div>
  );
}
