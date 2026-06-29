// Drawer — right-side detail panel. Spec: design_system v5 §3.4.
// Trap focus, ESC closes, scrim click closes. Sizes sm/md/lg.

'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { DrawerProps, DrawerSize } from '../types';
import '../internal/tokens.css';

const WIDTH: Record<DrawerSize, number> = { sm: 380, md: 480, lg: 640 };

export default function Drawer(props: DrawerProps) {
  const { open, onClose, title, subtitle, width = 'md', footer, children } = props;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    // PBS #199 v7: keep underlying page scrollable so it stays visibly "the page" — drawer is a side panel, not a full-screen takeover.
    return () => {
      document.removeEventListener('keydown', onKey);
      lastFocusedRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof window === 'undefined') return null;

  const w = WIDTH[width];

  return createPortal(
    <div className="cockpit-design" style={S.root} role="presentation">
      <div style={S.scrim} onClick={onClose} aria-hidden />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tbc-drawer-title"
        style={{ ...S.panel, width: w, maxWidth: '100vw' }}
      >
        <header style={S.header}>
          <div style={{ minWidth: 0 }}>
            <h2 id="tbc-drawer-title" style={S.title}>{title}</h2>
            {subtitle && <p style={S.subtitle}>{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={S.close}>×</button>
        </header>
        <div style={S.body}>{children}</div>
        {footer && <footer style={S.footer}>{footer}</footer>}
      </aside>
    </div>,
    document.body,
  );
}

const S: Record<string, CSSProperties> = {
  root: {
    position: 'fixed', inset: 0, zIndex: 100,
    display: 'flex', justifyContent: 'flex-end',
    fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
  },
  // PBS #199 v7: drawer scrim lightened (40% black → 12% black) so the underlying page remains clearly visible while drawer is open.
  // PBS 2026-06-29: pointerEvents on root, scrim transparent + click-through-to-close.
  // On dark themes (Namkhan) any opacity reads as "page went blank". Keep the
  // click-to-close behaviour but lose the visible tint.
  scrim: { position: 'absolute', inset: 0, background: 'transparent' },
  panel: {
    position: 'relative', height: '100vh',
    background: 'var(--paper, #FFFFFF)',
    color: 'var(--ink, #1B1B1B)',
    borderLeft: '1px solid var(--hairline, #E6DFCC)',
    boxShadow: '-12px 0 32px rgba(0,0,0,0.18)',
    display: 'flex', flexDirection: 'column',
    outline: 'none',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 12, padding: '16px 24px',
    borderBottom: '1px solid var(--hairline, #E6DFCC)',
  },
  title: { margin: 0, fontSize: 18, fontWeight: 600 },
  subtitle: { margin: '4px 0 0', fontSize: 12, color: 'var(--ink-soft, #5A5A5A)' },
  close: {
    background: 'transparent', border: 'none', fontSize: 24, lineHeight: 1,
    color: 'var(--ink-soft, #5A5A5A)', cursor: 'pointer', padding: 4,
  },
  body: { flex: 1, overflow: 'auto', padding: '16px 24px' },
  footer: { padding: '12px 24px', borderTop: '1px solid var(--hairline, #E6DFCC)' },
};
