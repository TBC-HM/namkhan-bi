'use client';
// FloatingHOSPanel — the single HOS access point, always visible bottom-right.
// Reads the current URL to determine property + scope automatically.
// Replaces all scattered "Ask brain" buttons across the app.
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import CentralChat from './CentralChat';

const FOREST = '#084838';
const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';

// Derive property_id from pathname
function getPropertyId(pathname: string): number | undefined {
  const m = pathname.match(/^\/h\/(\d+)/);
  if (m) return Number(m[1]);
  return undefined; // holding context
}

// Derive module scope from pathname
function getModuleScope(pathname: string): string | undefined {
  const segments = pathname.split('/').filter(Boolean);
  // /h/260955/finance/... → 'finance'
  // /h/260955/marketing/... → 'marketing'
  // /holding/it2/... → 'it'
  // /marketing/... → 'marketing'
  if (segments[0] === 'h' && segments.length >= 3) return segments[2];
  if (segments[0] === 'holding' && segments[1] === 'it2') return 'it';
  if (segments[0] === 'holding') return segments[1] ?? undefined;
  if (segments[0]) return segments[0];
  return undefined;
}

function getPropertyLabel(pid?: number): string {
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

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]);

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        title={`HOS · ${label}${moduleScope ? ` · ${moduleScope}` : ''}`}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: open ? '#0a3d28' : FOREST,
          color: WHITE,
          border: 'none',
          cursor: 'pointer',
          fontSize: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(8,72,56,0.35)',
          transition: 'background .15s, transform .15s',
          transform: open ? 'scale(0.92)' : 'scale(1)',
        }}
        aria-label="Open HOS"
      >
        🏨
      </button>

      {/* Panel */}
      {open && (
        <>
          {/* Backdrop (mobile) */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 999,
              background: 'rgba(0,0,0,0.15)',
            }}
          />
          {/* Chat panel */}
          <div
            style={{
              position: 'fixed',
              bottom: 84,
              right: 24,
              zIndex: 1001,
              width: 'min(520px, calc(100vw - 48px))',
              maxHeight: 'calc(100vh - 120px)',
              background: WHITE,
              border: `1px solid ${HAIR}`,
              borderRadius: 12,
              boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Panel header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px', borderBottom: `1px solid ${HAIR}`,
              background: FOREST, color: WHITE,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>🏨</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>HOS · {label}</div>
                  {moduleScope && (
                    <div style={{ fontSize: 10, opacity: 0.75, fontFamily: 'ui-monospace,monospace', letterSpacing: '0.1em' }}>
                      scope: {moduleScope}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'transparent', border: 'none', color: WHITE, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4, borderRadius: 4, opacity: 0.8 }}
              >
                ✕
              </button>
            </div>

            {/* CentralChat — full HOS/General toggle inside */}
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
