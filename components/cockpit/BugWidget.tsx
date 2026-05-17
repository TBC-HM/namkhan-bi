'use client';

// components/cockpit/BugWidget.tsx
// Global × bug-report widget (PBS ask 22, 2026-05-13).
// Tiny 20px square pinned bottom-right of every page. Click → 1-line popover,
// submit POSTs /api/cockpit/bugs with URL / viewport / user-agent / property_id
// captured invisibly. Mounted from app/layout.tsx so it appears everywhere.

import { useEffect, useRef, useState } from 'react';

export default function BugWidget() {
  const [open, setOpen]   = useState(false);
  const [text, setText]   = useState('');
  const [busy, setBusy]   = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Autofocus the single text input whenever the popover opens.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Auto-dismiss toast after 2.4s.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  function pullPropertyId(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    // /h/[property_id]/... tenant-scoped route.
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
        page_url:   typeof window !== 'undefined' ? window.location.href : null,
        viewport:   typeof window !== 'undefined'
          ? `${window.innerWidth}x${window.innerHeight}`
          : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        property_id: pullPropertyId() ?? null,
      };
      const res = await fetch('/api/cockpit/bugs', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (res.ok) {
        setText('');
        setOpen(false);
        setToast('Reported — thanks');
      } else {
        setToast('Failed to send');
      }
    } catch {
      setToast('Failed to send');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Floating × affordance — 20px, bottom-right, every page. */}
      <button
        aria-label="Report a bug"
        title="Report a bug on this page"
        onClick={() => setOpen(true)}
        style={{
          position:      'fixed',
          right:         12,
          bottom:        12,
          width:         20,
          height:        20,
          borderRadius:  4,
          background:    'var(--surf-2, #15110b)',
          color:         'var(--text-mute, #9b907a)',
          border:        '1px solid var(--border-2, #2a261d)',
          cursor:        'pointer',
          padding:       0,
          fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
          fontSize:      12,
          lineHeight:    1,
          display:       'flex',
          alignItems:    'center',
          justifyContent:'center',
          zIndex:        9999,
          opacity:       0.55,
          transition:    'opacity 120ms ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.55')}
      >
        ×
      </button>

      {/* Popover — keyboard-friendly, esc to close, enter to submit. */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position:       'fixed',
            inset:          0,
            background:     'rgba(0,0,0,0.45)',
            zIndex:         10000,
            display:        'flex',
            alignItems:     'flex-end',
            justifyContent: 'flex-end',
            padding:        16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:   'var(--surf-1, #0f0d0a)',
              border:       '1px solid var(--border-3, #3a3327)',
              borderRadius: 10,
              padding:      14,
              width:        360,
              maxWidth:     '90vw',
              boxShadow:    '0 12px 32px rgba(0,0,0,0.55)',
              fontFamily:   "'Inter Tight', system-ui, sans-serif",
            }}
          >
            <div style={{
              fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
              fontSize:      10,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color:         'var(--accent, #a8854a)',
              marginBottom:  10,
            }}>
              Report a bug
            </div>
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter')  { e.preventDefault(); void submit(); }
                if (e.key === 'Escape') { setOpen(false); }
              }}
              placeholder="what's broken?"
              maxLength={460}
              style={{
                width:        '100%',
                boxSizing:    'border-box',
                background:   'var(--surf-2, #15110b)',
                border:       '1px solid var(--border-2, #2a261d)',
                borderRadius: 8,
                color:        'var(--text-4, #efe6d3)',
                padding:      '9px 12px',
                fontSize:     13,
                fontFamily:   'inherit',
                outline:      'none',
                colorScheme:  'dark',
              }}
            />
            <div style={{
              display:        'flex',
              justifyContent: 'flex-end',
              gap:            8,
              marginTop:      10,
            }}>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background:    'transparent',
                  border:        '1px solid var(--border-2, #2a261d)',
                  borderRadius:  8,
                  color:         'var(--text-mute, #9b907a)',
                  padding:       '7px 12px',
                  fontSize:      11,
                  cursor:        'pointer',
                  fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >Cancel</button>
              <button
                onClick={submit}
                disabled={!text.trim() || busy}
                style={{
                  background:    text.trim() && !busy ? 'var(--accent, #a8854a)' : 'var(--surf-3, #1c160d)',
                  color:         text.trim() && !busy ? 'var(--surf-0, #0a0a0a)' : 'var(--text-place, #5a5448)',
                  border:        '1px solid var(--border-2, #2a261d)',
                  borderRadius:  8,
                  padding:       '7px 14px',
                  fontSize:      11,
                  cursor:        text.trim() && !busy ? 'pointer' : 'not-allowed',
                  fontFamily:    "'JetBrains Mono', ui-monospace, monospace",
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >{busy ? 'Sending…' : 'Send'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast confirmation */}
      {toast && (
        <div
          role="status"
          style={{
            position:       'fixed',
            right:          14,
            bottom:         42,
            zIndex:         10001,
            background:     'var(--surf-1, #0f0d0a)',
            border:         '1px solid var(--border-3, #3a3327)',
            borderRadius:   8,
            padding:        '8px 12px',
            fontSize:       12,
            color:          'var(--text-2, #d8cca8)',
            fontFamily:     "'Inter Tight', system-ui, sans-serif",
            boxShadow:      '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
