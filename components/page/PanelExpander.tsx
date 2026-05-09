'use client';

// components/page/PanelExpander.tsx
// PBS 2026-05-09 (new task): "ON ALL TABLES AND GRAPHS MAKE THE EXPAND SIGN
// IN THE RIGHT CORNER THAT USER CAN EXPAND TO SEE BETTER".
// Tiny client button injected into <Panel> head — toggles fullscreen on the
// closest [data-panel] ancestor. Falls back to a CSS class for browsers that
// don't grant fullscreen (Safari sometimes refuses on non-iframe nodes).

import { useEffect, useRef, useState } from 'react';

export default function PanelExpander() {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const fs = document.fullscreenElement;
      const cssActive = document.body.classList.contains('panel-fs-active');
      setActive(!!fs || cssActive);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  function toggle() {
    const panel = btnRef.current?.closest('[data-panel]') as HTMLElement | null;
    if (!panel) return;
    const isCssFs = panel.classList.contains('panel-fs');
    if (document.fullscreenElement === panel || isCssFs) {
      if (document.fullscreenElement === panel) {
        document.exitFullscreen().catch(() => {});
      }
      panel.classList.remove('panel-fs');
      document.body.classList.remove('panel-fs-active');
      setActive(false);
      return;
    }
    panel.requestFullscreen?.().catch(() => {
      // Fallback: CSS-only fullscreen overlay
      panel.classList.add('panel-fs');
      document.body.classList.add('panel-fs-active');
      setActive(true);
    });
  }

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={toggle}
      title={active ? 'Collapse' : 'Expand'}
      aria-label={active ? 'Collapse panel' : 'Expand panel'}
      style={{
        background: 'transparent',
        border: '1px solid #2a2520',
        color: '#a8854a',
        cursor: 'pointer',
        width: 22,
        height: 22,
        borderRadius: 4,
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        lineHeight: 1,
      }}
    >
      {active ? '⤡' : '⤢'}
    </button>
  );
}
