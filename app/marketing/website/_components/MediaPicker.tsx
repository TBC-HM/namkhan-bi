// app/marketing/website/_components/MediaPicker.tsx
// website-module-v1 CMS-2 — media picker placeholder v1.
// Full mkt_media_assets integration + focal-point sliders deferred to CMS-3.
// This v1: simple collapsible tip panel, copy URLs to clipboard.
'use client';
import { useState } from 'react';

const HAIR = '#E6DFCC';
const INK = '#1B1B1B';
const INK_M = '#5A5A5A';
const INK_F = '#8A8A8A';

interface MediaPickerProps {
  onInsert: (url: string) => void;
}

export default function MediaPicker({ onInsert }: MediaPickerProps) {
  const [expanded, setExpanded] = useState(false);
  const [url, setUrl] = useState('');

  function insertUrl() {
    if (!url.trim()) return;
    onInsert(url.trim());
    setUrl('');
  }

  return (
    <div style={{ marginTop: 15, padding: 12, border: `1px solid ${HAIR}`, borderRadius: 4, background: '#F9F9F9' }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ fontSize: 12.5, fontWeight: 600, color: INK_M, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <span style={{ fontSize: 10 }}>{expanded ? '▼' : '▶'}</span>
        Media Picker (placeholder v1)
      </div>
      {expanded && (
        <div style={{ marginTop: 10, fontSize: 12, color: INK_F }}>
          <p style={{ margin: 0, marginBottom: 8 }}>
            Full media library integration (mkt_media_assets grid + focal-point sliders) coming in CMS-3.
          </p>
          <p style={{ margin: 0, marginBottom: 8 }}>
            For now, paste an image URL below and click Insert to copy it to clipboard:
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: 12.5,
                border: `1px solid ${HAIR}`,
                borderRadius: 4,
                color: INK,
              }}
            />
            <button
              onClick={insertUrl}
              style={{
                padding: '6px 12px',
                fontSize: 12.5,
                fontWeight: 600,
                border: `1px solid ${HAIR}`,
                borderRadius: 4,
                background: '#FFFFFF',
                color: INK,
                cursor: 'pointer',
              }}
            >
              Insert
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
