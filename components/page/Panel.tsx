'use client';

// components/page/Panel.tsx
// Canonical container around any chart/table/list. PBS design manifesto.
// 2026-05-09: every "card" on every page renders inside <Panel/>. No
// ad-hoc <div style={{ background, border, borderRadius }}> anywhere.
//
// 2026-05-09 (PBS): expand affordance promoted to a real modal overlay.
// Top-right button opens a fullscreen modal that re-renders the panel's
// children at max-width 1600 with Esc + backdrop-click to close. Opt-in
// via `expandable` (default true). `hideExpander` is kept as a deprecated
// alias so legacy call sites continue to suppress the icon.

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface PanelProps {
  title: string;
  /** Right-aligned subtitle, e.g. "evidence" or "ai-fed". */
  eyebrow?: string;
  /** Right-aligned action overlay (✦ AI · ⊕ Save · ↻ Schedule · 📁 Project) */
  actions?: ReactNode;
  /** Show an expand-to-modal button. Default true. */
  expandable?: boolean;
  /** Deprecated alias for `expandable={false}`. */
  hideExpander?: boolean;
  children: ReactNode;
}

export default function Panel({
  title,
  eyebrow,
  actions,
  expandable = true,
  hideExpander,
  children,
}: PanelProps) {
  const showExpander = expandable && !hideExpander;
  const [open, setOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Esc to close, body scroll lock while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // focus close for a11y
    closeBtnRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <div data-panel data-expandable={showExpander ? 'true' : 'false'} style={S.box}>
        <div style={S.head}>
          <div style={S.title}>{title}</div>
          <div style={S.headRight}>
            {eyebrow && <span style={S.eyebrow}>{eyebrow}</span>}
            {actions}
            {showExpander && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Expand panel"
                title="Expand"
                style={S.expandBtn}
              >
                ⛶
              </button>
            )}
          </div>
        </div>
        <div>{children}</div>
      </div>

      {open && (
        <div
          data-panel-modal="true"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — expanded`}
          style={S.backdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <div style={S.title}>{title}</div>
              <div style={S.headRight}>
                {eyebrow && <span style={S.eyebrow}>{eyebrow}</span>}
                {actions}
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close expanded panel"
                  title="Close"
                  style={S.expandBtn}
                >
                  ✕
                </button>
              </div>
            </div>
            <div style={S.modalBody}>{children}</div>
          </div>
        </div>
      )}
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  box:  { background: 'var(--surf-1, #0f0d0a)', border: '1px solid var(--border-1, #1f1c15)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 14 },
  title: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--brass, #a8854a)',
  },
  headRight: { display: 'flex', alignItems: 'center', gap: 8 },
  eyebrow: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 'var(--t-xs)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-place, #5a5448)',
  },
  expandBtn: {
    background: 'transparent',
    border: '1px solid var(--border-2b, #2a2520)',
    color: 'var(--brass, #a8854a)',
    cursor: 'pointer',
    width: 22,
    height: 22,
    borderRadius: 4,
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'var(--t-sm, 11px)',
    lineHeight: 1,
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(5, 4, 3, 0.78)',
    backdropFilter: 'blur(2px)',
    zIndex: 9998,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '32px 24px',
    overflow: 'auto',
  },
  modal: {
    background: 'var(--surf-0, #0a0a0a)',
    border: '1px solid var(--border-1, #1f1c15)',
    borderRadius: 10,
    width: '100%',
    maxWidth: 1600,
    minHeight: 'calc(100vh - 64px)',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
  },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 14, paddingBottom: 8, borderBottom: '1px solid var(--border-1, #1f1c15)' },
  modalBody: { flex: 1 },
};
