'use client';

// components/cockpit/BugWidget.tsx
// PBS 2026-07-08 rewrite: bottom-LEFT · new design tokens (paper + hairline +
// primary green). Bigger, higher contrast so it's actually noticed. Submit path
// unchanged — still POSTs /api/cockpit/bugs with page URL / viewport / user
// agent captured invisibly.

import { useEffect, useRef, useState, type CSSProperties } from 'react';

const PRIMARY = '#084838';
const HAIRLINE = '#E6DFCC';
const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const PAPER = '#FFFFFF';
const PAPER_SOFT = '#FAFAF7';
const TERRACOTTA = '#B8542A';

export default function BugWidget() {
  const [open, setOpen]   = useState(false);
  const [text, setText]   = useState('');
  const [busy, setBusy]   = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  function pullPropertyId(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    const m = window.location.pathname.match(/^\/h\/([^/]+)/);
    return m ? m[1] : undefined;
  }

  async function submit() {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    try {
      const payload = {
        message,
        page_url: typeof window !== 'undefined' ? window.location.href : null,
        viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        property_id: pullPropertyId(),
      };
      const r = await fetch('/api/cockpit/bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`bug submit failed (${r.status})`);
      setText('');
      setOpen(false);
      setToast('✓ Bug reported — thanks');
    } catch (e) {
      setToast(`✗ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Bottom-LEFT floating button. Bigger + higher contrast so it's noticed. */}
      <button
        aria-label="Report a bug"
        title="Report a bug on this page"
        onClick={() => setOpen(true)}
        style={fabStyle}
        onMouseEnter={(e) => { e.currentTarget.style.background = PRIMARY; e.currentTarget.style.color = PAPER; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = PAPER; e.currentTarget.style.color = PRIMARY; }}
      >
        <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>🐞</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>Bug</span>
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={overlay}>
          <div onClick={(e) => e.stopPropagation()} style={dialog}>
            <div style={dialogTitle}>Report a bug on this page</div>
            <div style={{ fontSize: 11, color: INK_SOFT, marginBottom: 10 }}>
              We capture the URL, viewport size and user-agent automatically.
            </div>
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(); }
                if (e.key === 'Escape') { setOpen(false); }
              }}
              placeholder="what's broken? (press ⌘/Ctrl+Enter to send)"
              maxLength={2000}
              rows={4}
              style={inputStyle}
            />
            <div style={btnRow}>
              <button onClick={() => setOpen(false)} style={cancelBtn}>Cancel</button>
              <button onClick={submit} disabled={!text.trim() || busy} style={submitBtn(!!text.trim() && !busy)}>
                {busy ? 'Sending…' : 'Send report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" style={toastStyle}>
          {toast}
        </div>
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const fabStyle: CSSProperties = {
  position: 'fixed',
  left: 14,
  bottom: 14,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 999,
  background: PAPER,
  color: PRIMARY,
  border: `1px solid ${HAIRLINE}`,
  boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  zIndex: 9999,
  transition: 'background 120ms ease, color 120ms ease',
};

const overlay: CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.35)',
  zIndex: 10000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};

const dialog: CSSProperties = {
  background: PAPER,
  border: `1px solid ${HAIRLINE}`,
  borderRadius: 8,
  padding: 18,
  width: 420,
  maxWidth: '92vw',
  boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
  fontFamily: 'inherit',
};

const dialogTitle: CSSProperties = {
  fontSize: 14, fontWeight: 700, color: INK,
  marginBottom: 4,
};

const inputStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: PAPER_SOFT,
  border: `1px solid ${HAIRLINE}`,
  borderRadius: 4,
  color: INK,
  padding: '8px 10px',
  fontSize: 12,
  fontFamily: 'inherit',
  resize: 'vertical',
  outline: 'none',
};

const btnRow: CSSProperties = { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 };

const cancelBtn: CSSProperties = {
  background: 'transparent',
  border: `1px solid ${HAIRLINE}`,
  color: INK_SOFT,
  padding: '6px 12px',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const submitBtn = (active: boolean): CSSProperties => ({
  background: active ? PRIMARY : '#CFCFCF',
  color: PAPER,
  border: `1px solid ${active ? PRIMARY : '#CFCFCF'}`,
  padding: '6px 14px',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  cursor: active ? 'pointer' : 'not-allowed',
  fontFamily: 'inherit',
});

const toastStyle: CSSProperties = {
  position: 'fixed', left: 14, bottom: 60,
  zIndex: 10001,
  background: PAPER,
  border: `1px solid ${HAIRLINE}`,
  borderLeft: `3px solid ${PRIMARY}`,
  borderRadius: 4,
  padding: '8px 14px',
  fontSize: 12,
  color: INK,
  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
  fontFamily: 'inherit',
};
