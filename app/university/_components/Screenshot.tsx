'use client';
// app/university/_components/Screenshot.tsx
// TBC University · annotated screenshot. Renders an image from the public
// storage bucket 'university-shots' with CSS-overlaid arrows + labels at
// percentage coordinates (no image editing — annotations live in markdown:
//   ![shot:file.png|arrow:x,y|label:Click here] ).
// While the PNG has not been uploaded yet, a friendly "screenshot coming"
// placeholder renders instead — articles never show a broken image.

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { HAIR, GREEN, INK_SOFT, WARM, shotUrl } from '../_lib/theme';

export type ShotArrow = { x: number; y: number; label: string };

export default function Screenshot({ file, arrows }: { file: string; arrows: ShotArrow[] }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (failed) {
    return (
      <div style={{
        margin: '14px 0', border: `1.5px dashed ${HAIR}`, borderRadius: 8, background: WARM,
        padding: '26px 20px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 26, lineHeight: 1 }} aria-hidden>📷</div>
        <div style={{ marginTop: 8, fontSize: 13.5, fontWeight: 600, color: INK_SOFT }}>
          Screenshot coming — this picture is being prepared.
        </div>
        {arrows.filter((a) => a.label).length > 0 && (
          <div style={{ marginTop: 6, fontSize: 12.5, color: INK_SOFT }}>
            It will show: {arrows.filter((a) => a.label).map((a) => `“${a.label}”`).join(' · ')}
          </div>
        )}
        <div style={{ marginTop: 6, fontSize: 10.5, color: '#A39E8E' }}>{file}</div>
      </div>
    );
  }

  const labelPos = (a: ShotArrow): CSSProperties => {
    // Auto-flip so the label stays inside the image.
    const horiz: CSSProperties = a.x > 62
      ? { right: `${100 - a.x + 2.5}%` } : { left: `${a.x + 2.5}%` };
    const vert: CSSProperties = a.y > 78
      ? { bottom: `${100 - a.y + 3}%` } : { top: `${a.y + 3}%` };
    return { ...horiz, ...vert };
  };

  return (
    <div style={{ margin: '14px 0' }}>
      <div style={{
        position: 'relative', display: loaded ? 'block' : 'none',
        border: `1px solid ${HAIR}`, borderRadius: 8, overflow: 'hidden', lineHeight: 0,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shotUrl(file)} alt={arrows.map((a) => a.label).filter(Boolean).join('; ') || 'screenshot'}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          onError={() => setFailed(true)} onLoad={() => setLoaded(true)}
        />
        {arrows.map((a, i) => (
          <span key={i}>
            {/* target ring */}
            <span style={{
              position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, transform: 'translate(-50%, -50%)',
              width: 30, height: 30, borderRadius: '50%', border: `3px solid ${GREEN}`,
              boxShadow: '0 0 0 3px rgba(255,255,255,0.85), 0 1px 6px rgba(0,0,0,0.35)',
              pointerEvents: 'none',
            }} />
            <span style={{
              position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, transform: 'translate(-50%, -50%)',
              width: 7, height: 7, borderRadius: '50%', background: GREEN, pointerEvents: 'none',
            }} />
            {a.label && (
              <span style={{
                position: 'absolute', ...labelPos(a), zIndex: 2, pointerEvents: 'none',
                background: GREEN, color: '#FFFFFF', fontSize: 12.5, fontWeight: 600,
                lineHeight: 1.35, padding: '5px 10px', borderRadius: 5, maxWidth: '60%',
                boxShadow: '0 1px 6px rgba(0,0,0,0.3)', whiteSpace: 'normal',
                fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
              }}>
                {a.label}
              </span>
            )}
          </span>
        ))}
      </div>
      {!loaded && !failed && (
        <div style={{ border: `1px solid ${HAIR}`, borderRadius: 8, background: WARM, height: 120 }} />
      )}
    </div>
  );
}
