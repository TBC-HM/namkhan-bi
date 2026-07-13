// app/marketing/media/_client/VideoPlayerModal.tsx
// PBS 2026-07-13 · Coordinator scope-add — inline embedded video player.
// Full-viewport dark overlay + centered <video controls autoPlay>. Signed
// URL fetched from /api/marketing/media/asset-play-url (short-lived, 1h TTL).
// Closes on × / backdrop click / Escape.
'use client';

import { useEffect, useState } from 'react';

export interface VideoPlayerAsset {
  asset_id: string;
  visual_description?: string | null;
  original_filename?: string | null;
  duration_sec?: number | null;
  captured_at?: string | null;
  camera_make?: string | null;
  aspect_ratio?: string | null;
  file_size_bytes?: number | string | null;
  file_size_human?: string | null;
  public_url?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  asset: VideoPlayerAsset | null;
}

const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const WHITE  = '#FFFFFF';

function fmtDur(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(Number(sec))) return '';
  const s = Math.round(Number(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function humanSize(v: any): string {
  const n = Number(v ?? 0);
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function VideoPlayerModal({ open, onClose, asset }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !asset) return;
    let cancelled = false;
    setLoading(true); setErr(null); setSignedUrl(null);
    (async () => {
      try {
        const res = await fetch('/api/marketing/media/asset-play-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asset_id: asset.asset_id }),
        });
        const j = await res.json();
        if (cancelled) return;
        if (!res.ok || !j.url) {
          // Fallback to public_url if signed-url mint fails
          if (asset.public_url) setSignedUrl(asset.public_url);
          else setErr(j.error ?? 'Failed to load video');
        } else {
          setSignedUrl(j.url);
        }
      } catch (e: any) {
        if (cancelled) return;
        if (asset.public_url) setSignedUrl(asset.public_url);
        else setErr(e.message ?? 'network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, asset]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !asset) return null;

  const title = ((asset.visual_description ?? asset.original_filename ?? '').replace(/_/g, ' ')).slice(0, 80);
  const dur = fmtDur(asset.duration_sec);
  const date = asset.captured_at ? asset.captured_at.slice(0, 10) : '';
  const size = asset.file_size_human || humanSize(asset.file_size_bytes);
  const caption = [asset.camera_make, asset.aspect_ratio, size].filter(Boolean).join(' · ');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6,
          maxWidth: 1100, maxHeight: '90vh', width: '100%',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid ' + HAIR, gap: 12,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: INK,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{title || 'Untitled video'}</div>
            <div style={{
              display: 'flex', gap: 10, marginTop: 4,
              fontSize: 10, color: INK_M, alignItems: 'center',
            }}>
              {dur && (
                <span style={{
                  background: FOREST, color: WHITE, fontWeight: 700,
                  padding: '1px 8px', borderRadius: 10, letterSpacing: '0.02em',
                }}>{dur}</span>
              )}
              {date && <span>{date}</span>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            background: 'transparent', border: 'none', color: INK,
            fontSize: 24, lineHeight: 1, cursor: 'pointer', padding: '4px 8px',
          }}>×</button>
        </div>

        {/* Player */}
        <div style={{
          flex: 1, background: '#000', display: 'flex', alignItems: 'center',
          justifyContent: 'center', minHeight: 240, maxHeight: '80vh',
        }}>
          {loading && <div style={{ color: WHITE, fontSize: 12 }}>Loading video…</div>}
          {err && !signedUrl && <div style={{ color: '#F5C6C4', fontSize: 12, padding: 16 }}>Could not load: {err}</div>}
          {signedUrl && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={signedUrl}
              controls
              autoPlay
              preload="metadata"
              style={{
                maxWidth: '100%', maxHeight: '80vh',
                width: 'auto', height: 'auto', objectFit: 'contain',
                background: '#000',
              }}
            />
          )}
        </div>

        {/* Caption */}
        {caption && (
          <div style={{
            padding: '8px 16px', borderTop: '1px solid ' + HAIR,
            fontSize: 10, color: INK_M, letterSpacing: '0.04em',
          }}>{caption}</div>
        )}
      </div>
    </div>
  );
}
