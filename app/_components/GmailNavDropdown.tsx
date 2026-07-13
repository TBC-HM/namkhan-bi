'use client';
// app/_components/GmailNavDropdown.tsx
// Top-nav Gmail icon + dropdown. Silent (renders nothing) if the user has no
// connection. Polls /api/user/gmail/inbox every 60s. Row actions: Open ↗,
// Mark read, Reply (opens ComposeModal with prefill).
//
// PBS 2026-07-14: footer link "Open full mailbox →" now deep-links to /mail
// (the full-screen professional mailbox). Popup is preserved as the glance
// surface.

import { useCallback, useEffect, useRef, useState } from 'react';
import ComposeModal, { type ComposePrefill } from './ComposeModal';

const WHITE = '#FFFFFF', HAIR = '#E6DFCC', INK = '#1B1B1B', INK_M = '#5A5A5A', FOREST = '#084838', CREAM = '#F5F0E1';

interface Message {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
}

interface InboxResp {
  gmail_address: string;
  scope: string;
  messages: Message[];
}

function parseFrom(raw: string): { name: string; email: string } {
  const m = raw.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: raw, email: raw };
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 86400 * 7) return Math.floor(s / 86400) + 'd';
  return new Date(iso).toLocaleDateString();
}

export default function GmailNavDropdown() {
  const [data, setData] = useState<InboxResp | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [compose, setCompose] = useState<ComposePrefill | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/user/gmail/inbox?scope=unread', { cache: 'no-store' });
      if (r.status === 404) { setConnected(false); return; }
      if (r.status === 401) { setConnected(false); return; }
      if (!r.ok) return;
      const j = (await r.json()) as InboxResp;
      setData(j);
      setConnected(true);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  async function onMarkRead(id: string) {
    await fetch('/api/user/gmail/mark-read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message_id: id }) });
    load();
  }

  function onReply(m: Message) {
    const from = parseFrom(m.from);
    const subj = m.subject.match(/^re:/i) ? m.subject : ('Re: ' + m.subject);
    setCompose({
      to: from.email,
      subject: subj,
      thread_id: m.threadId,
      in_reply_to: m.id,
      quoted_from: from.name,
      quoted_date: m.date,
      quoted_snippet: m.snippet,
    });
    setOpen(false);
  }

  if (connected === null || connected === false) return null;

  const unread = (data?.messages ?? []).filter((m) => m.unread).length;

  return (
    <div ref={wrapRef} style={{ position: 'fixed', top: 12, right: 12, zIndex: 1000 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Gmail inbox"
        aria-expanded={open}
        style={{
          position: 'relative', width: 32, height: 28, borderRadius: 6,
          background: WHITE, color: INK, border: '1px solid ' + HAIR,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 14, padding: 0,
        }}
        title={data?.gmail_address ?? 'Gmail'}
      >
        <span aria-hidden="true">✉</span>
        {unread > 0 && (
          <span
            style={{
              position: 'absolute', top: -6, right: -6,
              minWidth: 16, height: 16, padding: '0 4px',
              borderRadius: 8, background: FOREST, color: WHITE,
              fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 6,
            width: 380, maxHeight: 480, overflowY: 'auto',
            background: WHITE, border: '1px solid ' + HAIR, borderRadius: 8,
            boxShadow: '0 12px 32px rgba(0,0,0,0.16)', color: INK,
            fontFamily: "'Inter Tight', system-ui, sans-serif",
          }}
        >
          <div style={{ padding: '10px 12px', borderBottom: '1px solid ' + HAIR, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{data?.gmail_address ?? ''}</div>
              <div style={{ fontSize: 11, color: INK_M }}>{unread} unread</div>
            </div>
            <button
              onClick={() => setCompose({})}
              style={{ padding: '4px 10px', background: FOREST, color: WHITE, border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              ✎ Compose
            </button>
          </div>

          {(data?.messages ?? []).slice(0, 10).map((m) => {
            const from = parseFrom(m.from);
            return (
              <div key={m.id} style={{ padding: '10px 12px', borderBottom: '1px solid ' + HAIR, background: m.unread ? WHITE : CREAM }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: m.unread ? 600 : 500, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{from.name}</div>
                  <div style={{ fontSize: 10, color: INK_M, flexShrink: 0 }}>{relTime(m.date)}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: m.unread ? 500 : 400, color: INK, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.subject}</div>
                <div style={{ fontSize: 11, color: INK_M, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.snippet}</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                  <a href={'https://mail.google.com/mail/u/0/#inbox/' + m.threadId} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 10, color: FOREST, textDecoration: 'none', padding: '2px 6px', border: '1px solid ' + HAIR, borderRadius: 3 }}>
                    Open ↗
                  </a>
                  <button onClick={() => onReply(m)} style={{ fontSize: 10, color: INK, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 3, padding: '2px 6px', cursor: 'pointer' }}>Reply</button>
                  {m.unread && (
                    <button onClick={() => onMarkRead(m.id)} style={{ fontSize: 10, color: INK_M, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 3, padding: '2px 6px', cursor: 'pointer' }}>Mark read</button>
                  )}
                </div>
              </div>
            );
          })}

          {(data?.messages ?? []).length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: INK_M }}>No unread messages.</div>
          )}

          <div style={{ padding: '8px 12px', borderTop: '1px solid ' + HAIR, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <a href="/mail" style={{ fontSize: 11, color: FOREST, textDecoration: 'none', fontWeight: 600 }}>Open full mailbox →</a>
            <a href="/settings/gmail" style={{ fontSize: 11, color: INK_M, textDecoration: 'none' }}>Settings</a>
          </div>
        </div>
      )}

      {compose && <ComposeModal prefill={compose} onClose={() => setCompose(null)} onSent={() => { setCompose(null); load(); }} />}
    </div>
  );
}
