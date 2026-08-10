'use client';
// FloatingHOSPanel v2 — bigger, University integrated, ? removed.
// Single HOS access point: 🏨 fixed bottom-right, URL-aware property+scope.
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import CentralChat from './CentralChat';

const FOREST = '#084838';
const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK_F  = '#8A8A8A';

function getPropertyId(path: string): number | undefined {
  const m = path.match(/^\/h\/(\d+)/);
  return m ? Number(m[1]) : undefined;
}

function getModuleScope(path: string): string | undefined {
  const seg = path.split('/').filter(Boolean);
  if (seg[0] === 'h' && seg.length >= 3) return seg[2];
  if (seg[0] === 'holding' && seg[1] === 'it2') return 'it';
  if (seg[0] === 'holding') return seg[1] ?? undefined;
  if (seg[0] && seg[0] !== 'h') return seg[0];
  return undefined;
}

function getPropertyLabel(pid?: number) {
  if (pid === 260955) return 'Namkhan';
  if (pid === 1000001) return 'Donna';
  return 'Holding';
}

export default function FloatingHOSPanel() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? '';
  const propertyId  = getPropertyId(pathname);
  const moduleScope = getModuleScope(pathname);
  const label       = getPropertyLabel(propertyId);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]);

  return (
    <>
      {/* 🏨 trigger — primary action, bottom-right */}
      <button
        onClick={() => setOpen(v => !v)}
        title={`HOS · ${label}${moduleScope ? ` · ${moduleScope}` : ''} (ESC to close)`}
        aria-label="Open HOS"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          width: 52, height: 52, borderRadius: '50%',
          background: open ? '#0a3d28' : FOREST,
          color: WHITE, border: 'none', cursor: 'pointer', fontSize: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(8,72,56,0.40)',
          transition: 'background .15s, transform .15s, box-shadow .15s',
          transform: open ? 'scale(0.92)' : 'scale(1)',
        }}
      >
        🏨
      </button>

      {/* Label below button when closed */}
      {!open && (
        <div style={{
          position: 'fixed', bottom: 10, right: 18, zIndex: 999,
          fontSize: 9, fontFamily: 'ui-monospace,monospace', letterSpacing: '0.12em',
          color: FOREST, pointerEvents: 'none', textTransform: 'uppercase',
        }}>
          HOS
        </div>
      )}

      {/* Panel */}
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.2)' }} />

          <div style={{
            position: 'fixed',
            bottom: 88,
            right: 16,
            zIndex: 1001,
            width: 'min(680px, calc(100vw - 32px))',
            height: 'calc(100vh - 110px)',
            maxHeight: 820,
            background: WHITE,
            border: `1px solid ${HAIR}`,
            borderRadius: 14,
            boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 16px', background: FOREST, color: WHITE, flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🏨</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>HOS · {label}</div>
                  <div style={{ fontSize: 10, opacity: 0.70, fontFamily: 'ui-monospace,monospace', letterSpacing: '0.08em' }}>
                    {moduleScope ? `scope: ${moduleScope} · ` : ''}Hospitality Operating System
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* University link — integrated, no separate ? button needed */}
                <a
                  href="/university"
                  target="_blank"
                  rel="noopener"
                  title="Platform University — how-to guides, help"
                  onClick={() => setOpen(false)}
                  style={{
                    color: 'rgba(255,255,255,0.75)', fontSize: 11,
                    fontFamily: 'ui-monospace,monospace', letterSpacing: '0.08em',
                    textDecoration: 'none', border: '1px solid rgba(255,255,255,0.3)',
                    padding: '3px 9px', borderRadius: 4,
                    transition: 'opacity .15s',
                  }}
                >
                  📚 University
                </a>
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 4px', borderRadius: 4 }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* CentralChat fills the rest */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <CentralChat
                mode="second-brain"
                moduleScope={moduleScope}
                propertyId={propertyId}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
