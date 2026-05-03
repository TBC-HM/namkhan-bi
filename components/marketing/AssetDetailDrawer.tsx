'use client';

// components/marketing/AssetDetailDrawer.tsx
// Slides in from the right when an AssetCard fires 'asset:open'.
// Mounted globally via the marketing layout — listens for window 'asset:open' events.
//
// Detail data is fetched on demand via /api/marketing/asset/[id] (TODO Phase 2.1) — for
// now we display whatever was passed in the event detail. Empty states are graceful.

import { useEffect, useState } from 'react';

interface AssetDetail {
  asset_id: string;
  caption?: string | null;
  alt_text?: string | null;
  primary_tier?: string | null;
  secondary_tiers?: string[] | null;
  tags?: string[] | null;
  photographer?: string | null;
  captured_at?: string | null;
  license_type?: string | null;
  width_px?: number | null;
  height_px?: number | null;
  master_path?: string | null;
  renders?: Record<string, string> | null;
}

const TIER_LABEL: Record<string, string> = {
  tier_ota_profile:  'OTA Profile',
  tier_website_hero: 'Website Hero',
  tier_social_pool:  'Social Pool',
  tier_internal:     'Internal',
};

export default function AssetDetailDrawer() {
  const [open, setOpen] = useState(false);
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function onOpen(e: Event) {
      const ce = e as CustomEvent<{ asset_id: string; asset?: AssetDetail }>;
      setOpen(true);
      if (ce.detail?.asset) {
        setAsset(ce.detail.asset);
        return;
      }
      // Fetch detail
      setLoading(true);
      try {
        const res = await fetch(`/api/marketing/asset/${encodeURIComponent(ce.detail.asset_id)}`);
        if (res.ok) {
          const data = await res.json();
          setAsset(data);
        } else {
          setAsset({ asset_id: ce.detail.asset_id });
        }
      } catch {
        setAsset({ asset_id: ce.detail.asset_id });
      } finally {
        setLoading(false);
      }
    }
    window.addEventListener('asset:open', onOpen);
    return () => { window.removeEventListener('asset:open', onOpen); };
  }, []);

  function publicRenderUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    return `${base}/storage/v1/object/public/media-renders/${path}`;
  }

  if (!open) return null;

  const previewUrl = asset && (publicRenderUrl(asset.renders?.web_2k) ?? publicRenderUrl(asset.renders?.thumbnail));

  return (
    <div
      role="dialog"
      aria-modal
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,24,22,0.45)',
        zIndex: 9998,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <aside
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(420px, 92vw)',
          height: '100vh',
          background: 'var(--paper-warm, #faf6ec)',
          borderLeft: '1px solid var(--line-soft)',
          overflowY: 'auto',
          fontFamily: 'var(--sans)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--line-soft)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: "var(--t-xs)", textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--ink-mute)' }}>asset detail</span>
          <button onClick={() => setOpen(false)} aria-label="close" style={{ background: 'none', border: 'none', fontSize: "var(--t-2xl)", color: 'var(--ink-mute)', cursor: 'pointer' }}>×</button>
        </div>

        {loading && <div style={{ padding: 22, fontSize: "var(--t-base)", color: 'var(--ink-mute)' }}>loading…</div>}

        {!loading && asset && (
          <>
            <div style={{ aspectRatio: '4 / 3', background: '#1a1a1a', position: 'relative' }}>
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt={asset.alt_text ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#888', fontFamily: 'var(--mono)', fontSize: "var(--t-xs)" }}>no preview</div>
              )}
            </div>

            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Section label="caption">
                <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: "var(--t-lg)", color: 'var(--ink)', lineHeight: 1.5 }}>
                  {asset.caption ?? '—'}
                </div>
              </Section>

              <Section label="alt-text">
                <div style={{ fontSize: "var(--t-base)", color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                  {asset.alt_text ?? '—'}
                </div>
              </Section>

              <Section label={`tags (${asset.tags?.length ?? 0})`}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(asset.tags ?? []).map(t => (
                    <span key={t} style={{ fontFamily: 'var(--mono)', fontSize: "var(--t-xs)", background: 'var(--line-soft, #efeae0)', padding: '2px 6px', color: 'var(--ink)' }}>{t}</span>
                  ))}
                  {(!asset.tags || asset.tags.length === 0) && <span style={{ fontSize: "var(--t-sm)", color: 'var(--ink-mute)' }}>—</span>}
                </div>
              </Section>

              <Section label="usage tiers">
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {asset.primary_tier && (
                    <span className="pill" style={{ background: 'var(--moss)', color: 'var(--paper-warm)' }}>
                      primary · {TIER_LABEL[asset.primary_tier] ?? asset.primary_tier}
                    </span>
                  )}
                  {(asset.secondary_tiers ?? []).map(t => (
                    <span key={t} className="pill" style={{ background: 'var(--brass)', color: 'var(--paper-warm)' }}>
                      {TIER_LABEL[t] ?? t}
                    </span>
                  ))}
                </div>
              </Section>

              <Section label="metadata">
                <div style={{ fontSize: "var(--t-base)", color: 'var(--ink-soft)', lineHeight: 1.7 }}>
                  Photographer: <strong>{asset.photographer ?? '—'}</strong><br />
                  Captured: {asset.captured_at ? new Date(asset.captured_at).toLocaleString('en-GB') : '—'}<br />
                  License: {asset.license_type ?? '—'}<br />
                  Resolution: {asset.width_px ?? '?'} × {asset.height_px ?? '?'}
                </div>
              </Section>

              <Section label={`renders available (${Object.keys(asset.renders ?? {}).length})`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: "var(--t-sm)", fontFamily: 'var(--mono)', color: 'var(--ink-soft)' }}>
                  {Object.keys(asset.renders ?? {}).map(k => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>✓ {k}</span>
                      <a href={publicRenderUrl(asset.renders?.[k]) ?? '#'} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--moss)' }}>open ↗</a>
                    </div>
                  ))}
                  {(!asset.renders || Object.keys(asset.renders).length === 0) && <span>—</span>}
                </div>
              </Section>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                <a
                  href={`/marketing/campaigns/new?asset=${encodeURIComponent(asset.asset_id)}`}
                  className="btn"
                  style={{ textAlign: 'center', background: 'var(--moss)', color: 'var(--paper-warm)', borderColor: 'var(--moss)', textDecoration: 'none', padding: '8px 14px' }}
                >
                  use in new campaign →
                </a>
                <button className="btn" style={{ fontSize: "var(--t-sm)" }}>add to collection</button>
                <button className="btn" style={{ fontSize: "var(--t-sm)" }}>mark as do-not-modify</button>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: "var(--t-xs)", textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--ink-mute)', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}
