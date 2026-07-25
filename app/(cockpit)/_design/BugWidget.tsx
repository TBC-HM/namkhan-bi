'use client';
// app/(cockpit)/_design/BugWidget.tsx
// PBS 2026-07-25 — Walkthrough feedback engine (ADR-walkthrough-feedback-engine).
// Floating widget that provides 2-click finding capture across any area page.
// - Idle: single 🪲 button bottom-right (does nothing if not in walkthrough mode)
// - Active: red outline border + session bar + click-to-capture on [data-ck] elements
// - Each captured finding → fn_bug_insert_walkthrough via /api/cockpit/walkthrough

import { useCallback, useEffect, useRef, useState } from 'react';

interface WalkthroughState {
  id: number;
  finding_count: number;
}

interface Capture {
  page_url: string;
  component: string;
  clicked_selector: string;
  element_text: string;
}

export function BugWidget({
  deptSlug,
  propertyId,
}: {
  deptSlug: string;
  propertyId?: string;
}) {
  const [session, setSession] = useState<WalkthroughState | null>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  const handlePageClick = useCallback(
    (e: MouseEvent) => {
      if (!session) return;
      const target = e.target as HTMLElement;
      const el = target.closest('[data-ck]') as HTMLElement | null;
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      setCapture({
        page_url: window.location.href,
        component: el.getAttribute('data-ck') ?? el.tagName.toLowerCase(),
        clicked_selector: buildSelector(el),
        element_text: (el.textContent ?? '').trim().slice(0, 120),
      });
      setText('');
      setTimeout(() => textRef.current?.focus(), 50);
    },
    [session],
  );

  useEffect(() => {
    if (!session) return;
    document.addEventListener('click', handlePageClick, true);
    return () => document.removeEventListener('click', handlePageClick, true);
  }, [session, handlePageClick]);

  async function startWalkthrough() {
    const r = await fetch('/api/cockpit/walkthrough', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'start', dept_slug: deptSlug, property_id: propertyId }),
    });
    if (!r.ok) return;
    const { walkthrough_id } = (await r.json()) as { walkthrough_id: number };
    setSession({ id: walkthrough_id, finding_count: 0 });
  }

  async function closeWalkthrough() {
    if (!session) return;
    const r = await fetch('/api/cockpit/walkthrough', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'close', walkthrough_id: session.id }),
    });
    const { finding_count } = (await r.json()) as { finding_count: number };
    flash(`Session closed · ${finding_count} finding${finding_count === 1 ? '' : 's'} queued for triage`);
    setSession(null);
    setCapture(null);
  }

  async function submitFinding() {
    if (!session || !capture || !text.trim() || submitting) return;
    setSubmitting(true);
    const body =
      text.trim() + (capture.element_text ? `\n\nElement seen: "${capture.element_text}"` : '');
    await fetch('/api/cockpit/walkthrough', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'finding',
        dept_slug: deptSlug,
        body,
        page_url: capture.page_url,
        component: capture.component,
        clicked_selector: capture.clicked_selector,
        property_id: propertyId,
        walkthrough_id: session.id,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      }),
    });
    setSubmitting(false);
    setSession((s) => (s ? { ...s, finding_count: s.finding_count + 1 } : s));
    flash(`Finding #${session.finding_count + 1} saved`);
    setCapture(null);
    setText('');
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  return (
    <>
      {session && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            outline: '3px solid #B8542A',
            outlineOffset: '-3px',
            zIndex: 9990,
          }}
        />
      )}

      {session && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9995,
            background: '#B8542A',
            color: '#fff',
            fontSize: 11,
            fontFamily: 'monospace',
            padding: '4px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span>
            🪲 WALKTHROUGH ACTIVE · {session.finding_count} findings · click any highlighted element
          </span>
          <span style={{ flex: 1 }} />
          <button
            onClick={closeWalkthrough}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#fff',
              borderRadius: 3,
              padding: '2px 10px',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            End session
          </button>
        </div>
      )}

      {!session && (
        <button
          onClick={startWalkthrough}
          title="Start area walkthrough"
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 9995,
            background: '#084838',
            color: '#fff',
            border: 'none',
            borderRadius: 24,
            padding: '8px 14px',
            cursor: 'pointer',
            fontSize: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          🪲
        </button>
      )}

      {capture && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setCapture(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: 20,
              width: 420,
              maxWidth: '90vw',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 10, fontFamily: 'monospace' }}>
              {capture.component} · {capture.page_url.split('/').slice(-3).join('/')}
            </div>
            <textarea
              ref={textRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitFinding();
              }}
              placeholder="What's wrong? One sentence is enough…"
              rows={3}
              style={{
                width: '100%',
                resize: 'vertical',
                border: '1px solid #E6DFCC',
                borderRadius: 4,
                padding: 8,
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => setCapture(null)}
                style={{
                  background: 'none',
                  border: '1px solid #E6DFCC',
                  borderRadius: 4,
                  padding: '4px 12px',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Skip
              </button>
              <button
                onClick={submitFinding}
                disabled={submitting || !text.trim()}
                style={{
                  background: submitting || !text.trim() ? '#ccc' : '#084838',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 16px',
                  cursor: submitting || !text.trim() ? 'default' : 'pointer',
                  fontSize: 12,
                }}
              >
                {submitting ? 'Saving…' : 'Save ⌘↵'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1B1B1B',
            color: '#fff',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 12,
            zIndex: 10001,
            whiteSpace: 'nowrap',
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}

function buildSelector(el: HTMLElement): string {
  const parts: string[] = [];
  let cur: HTMLElement | null = el;
  while (cur && parts.length < 4) {
    let s = cur.tagName.toLowerCase();
    const ck = cur.getAttribute('data-ck');
    if (ck) s += `[data-ck="${ck}"]`;
    else if (cur.id) s += '#' + cur.id;
    else if (cur.className && typeof cur.className === 'string') {
      const c = cur.className.trim().split(/\s+/)[0];
      if (c) s += '.' + c;
    }
    parts.unshift(s);
    cur = cur.parentElement;
  }
  return parts.join(' > ');
}
