'use client';
// app/_components/ComposeModal.tsx
// Minimal Gmail compose + reply modal. Reply pre-fills to / subject / thread_id
// / in_reply_to via prefill. Formatting via document.execCommand (no library).
//
// Tier 3 — v2 (2026-07-13). Adds shared-mailbox filter-mode support:
//   - Pass sharedMailboxId to POST to /api/sales/mails/send (Send-As)
//     instead of /api/user/gmail/send (personal Gmail).

import { useEffect, useRef, useState } from 'react';

const WHITE = '#FFFFFF', HAIR = '#E6DFCC', INK = '#1B1B1B', INK_M = '#5A5A5A',
      FOREST = '#084838', CREAM = '#F5F0E1', RED = '#B03826', OK = '#0E7A4B';

export interface ComposePrefill {
  to?: string;
  subject?: string;
  thread_id?: string;
  in_reply_to?: string;
  quoted_from?: string;
  quoted_date?: string;
  quoted_snippet?: string;
}

interface Props {
  prefill?: ComposePrefill;
  onClose: () => void;
  onSent?: () => void;
  /**
   * If set, this compose targets a shared alias (Send-As mode).
   * Sends POST to /api/sales/mails/send with mailbox_id in the body.
   * If unset, sends POST to /api/user/gmail/send (personal).
   */
  sharedMailboxId?: string;
  /** Optional badge label shown in the modal header, e.g. "Booking". */
  sharedMailboxLabel?: string;
}

export default function ComposeModal({ prefill, onClose, onSent, sharedMailboxId, sharedMailboxLabel }: Props) {
  const [to, setTo] = useState(prefill?.to ?? '');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState(prefill?.subject ?? '');
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState<'idle' | 'ok' | 'err'>('idle');
  const [flashMsg, setFlashMsg] = useState('');
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [chars, setChars] = useState(0);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') maybeDiscard();
    }
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function maybeDiscard() {
    const dirty = (to.trim() + cc + bcc + subject.trim() + (editorRef.current?.innerText.trim() ?? '')).length > 0;
    if (!dirty || confirm('Discard this message?')) onClose();
  }

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    setChars(editorRef.current?.innerText.length ?? 0);
  }

  function insertLink() {
    const url = prompt('Link URL (https://…)');
    if (url) exec('createLink', url);
  }

  async function onSend() {
    const html = editorRef.current?.innerHTML ?? '';
    const plain = editorRef.current?.innerText ?? '';
    if (!to.trim() || !subject.trim()) return;
    setSending(true);
    setFlash('idle');
    try {
      const endpoint = sharedMailboxId ? '/api/sales/mails/send' : '/api/user/gmail/send';
      const payload: Record<string, unknown> = {
        to: to.trim(),
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        subject: subject.trim(),
        body_html: html,
        body_plain: plain,
        in_reply_to: prefill?.in_reply_to,
        thread_id: prefill?.thread_id,
      };
      if (sharedMailboxId) payload.mailbox_id = sharedMailboxId;
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (r.ok && j.ok !== false) {
        setFlash('ok');
        setFlashMsg('Sent');
        setTimeout(() => { onSent?.(); onClose(); }, 1200);
      } else {
        setFlash('err');
        setFlashMsg(j.detail ?? j.error ?? 'send failed');
      }
    } catch (e) {
      setFlash('err');
      setFlashMsg(e instanceof Error ? e.message : 'error');
    } finally { setSending(false); }
  }

  const disabled = sending || !to.trim() || !subject.trim();
  const modeLabel = sharedMailboxId
    ? (sharedMailboxLabel ? sharedMailboxLabel + ' · Reply' : 'Shared reply')
    : (prefill?.thread_id ? 'Reply' : 'New message');

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) maybeDiscard(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 5000,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: 640, maxWidth: '100%', maxHeight: '80vh', overflowY: 'auto',
          background: WHITE, borderRadius: 8, border: '1px solid ' + HAIR,
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          color: INK, fontFamily: "'Inter Tight', system-ui, sans-serif",
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '14px 16px', borderBottom: '1px solid ' + HAIR, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{modeLabel}</div>
          <button onClick={maybeDiscard} style={{ background: 'transparent', border: 'none', color: INK_M, cursor: 'pointer', fontSize: 16 }} aria-label="Close">×</button>
        </div>

        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Field label="To">
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com" style={inputStyle} />
          </Field>
          {!showCcBcc && (
            <button onClick={() => setShowCcBcc(true)} style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: FOREST, fontSize: 12, cursor: 'pointer', padding: 0 }}>
              Add CC/BCC
            </button>
          )}
          {showCcBcc && (
            <>
              <Field label="Cc"><input value={cc} onChange={(e) => setCc(e.target.value)} style={inputStyle} /></Field>
              <Field label="Bcc"><input value={bcc} onChange={(e) => setBcc(e.target.value)} style={inputStyle} /></Field>
            </>
          )}
          <Field label="Subject">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" style={inputStyle} />
          </Field>
        </div>

        <div style={{ padding: '0 12px 8px', display: 'flex', gap: 4, borderBottom: '1px solid ' + HAIR }}>
          {[
            { label: 'B', cmd: 'bold', bold: true },
            { label: 'I', cmd: 'italic', italic: true },
            { label: 'U', cmd: 'underline', underline: true },
          ].map((b) => (
            <button
              key={b.cmd}
              onClick={() => exec(b.cmd)}
              style={{ ...toolbarBtn, fontWeight: b.bold ? 700 : 400, fontStyle: b.italic ? 'italic' : 'normal', textDecoration: b.underline ? 'underline' : 'none' }}
            >{b.label}</button>
          ))}
          <button onClick={insertLink} style={toolbarBtn} title="Link">link</button>
          <button onClick={() => exec('insertOrderedList')} style={toolbarBtn} title="Numbered list">1.</button>
          <button onClick={() => exec('insertUnorderedList')} style={toolbarBtn} title="Bulleted list">•</button>
        </div>

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => setChars(editorRef.current?.innerText.length ?? 0)}
          style={{
            minHeight: 180, padding: 14, outline: 'none',
            fontSize: 14, lineHeight: 1.5, color: INK,
          }}
        />

        {prefill?.quoted_snippet && (
          <div style={{ padding: '10px 14px', margin: '0 14px 14px', borderLeft: '3px solid ' + HAIR, background: CREAM, color: INK_M, fontSize: 12, borderRadius: '0 4px 4px 0' }}>
            <div style={{ marginBottom: 6, fontStyle: 'italic' }}>On {prefill.quoted_date ?? 'earlier'}, {prefill.quoted_from ?? 'someone'} wrote:</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>&gt; {prefill.quoted_snippet}</div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderTop: '1px solid ' + HAIR, background: WHITE }}>
          <button
            onClick={onSend}
            disabled={disabled}
            style={{
              padding: '8px 16px', background: disabled ? '#8FA69A' : FOREST, color: WHITE, border: 'none', borderRadius: 4,
              fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
          <button
            onClick={maybeDiscard}
            style={{ padding: '8px 14px', background: WHITE, color: INK, border: '1px solid ' + HAIR, borderRadius: 4, fontSize: 13, cursor: 'pointer' }}
          >
            Discard
          </button>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: INK_M }}>{chars} chars</div>
          {flash === 'ok' && <span style={{ marginLeft: 12, padding: '4px 8px', background: OK, color: WHITE, borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{flashMsg}</span>}
          {flash === 'err' && <span style={{ marginLeft: 12, padding: '4px 8px', background: RED, color: WHITE, borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{flashMsg}</span>}
        </div>
      </div>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid ' + HAIR, padding: '4px 0' }}>
      <div style={{ width: 60, fontSize: 12, color: INK_M }}>{props.label}</div>
      <div style={{ flex: 1 }}>{props.children}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: 'none', outline: 'none', fontSize: 13, color: INK, background: 'transparent', fontFamily: 'inherit', padding: '4px 0',
};

const toolbarBtn: React.CSSProperties = {
  width: 28, height: 28, background: WHITE, border: '1px solid transparent', borderRadius: 4, color: INK, cursor: 'pointer', fontSize: 12,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};
