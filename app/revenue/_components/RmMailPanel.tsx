'use client';

// app/revenue/_components/RmMailPanel.tsx
// Revenue HoD landing — Reservations Manager mail feed.
// Server-side Gmail filter: from:rm@thenamkhan.com -label:HOD-DISMISSED.
// Fetches last 30 · click-to-expand accordion · Reply/Dismiss/Close.
// 60s auto-poll while tab is visible.
// PBS 2026-07-14.
//
// Design tokens (per feedback_namkhan_token_ladder_paper_warm_dark.md):
//   bg      #FFFFFF
//   inset   #FAFAF7 (reply pane)
//   hover   #F5F0E0
//   border  #E6DFCC
//   ink     #1B1B1B
//   muted   #8B7355
//   unread  #2563EB

import { useCallback, useEffect, useRef, useState } from 'react';

interface MailRow {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  dateMs: number;
  snippet: string;
  unread: boolean;
}

interface FullMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  htmlBody: string;
  textBody: string;
}

const BG = '#FFFFFF';
const BG_INSET = '#FAFAF7';
const HOVER = '#F5F0E0';
const HAIRLINE = '#E6DFCC';
const INK = '#1B1B1B';
const MUTED = '#8B7355';
const UNREAD_DOT = '#2563EB';

// Parse "Name <addr>" → { name, addr }
function parseFromAddr(from: string): { name: string; addr: string } {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), addr: m[2].trim() };
  return { name: from, addr: from };
}

function relTime(ms: number): string {
  if (!ms) return '';
  const now = Date.now();
  const diff = now - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'now';
  if (min < 60) return min + 'm';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + 'h';
  const d = new Date(ms);
  const today = new Date();
  const y = new Date(today.getTime() - 86400000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, y)) return 'Yesterday';
  if (d.getFullYear() === today.getFullYear()) return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' });
}

export default function RmMailPanel() {
  const [rows, setRows] = useState<MailRow[] | null>(null);
  const [error, setError] = useState<'auth' | 'generic' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [fullById, setFullById] = useState<Record<string, FullMessage | 'loading' | 'error'>>({});
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());
  const [hoverId, setHoverId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/hod/revenue/mails?max=30', { cache: 'no-store' });
      if (r.status === 401) {
        const j = await r.json().catch(() => ({}));
        setError(j?.error === 'gmail_not_connected' ? 'auth' : 'generic');
        setRows([]);
        return;
      }
      const j = await r.json();
      if (!j?.ok) { setError('generic'); setRows([]); return; }
      setError(null);
      const data = (j.data ?? []) as MailRow[];
      data.sort((a, b) => b.dateMs - a.dateMs);
      setRows(data);
    } catch {
      setError('generic');
      setRows([]);
    }
  }, []);

  // Initial + 60s poll while visible.
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!t) t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000); };
    const stop = () => { if (t) { clearInterval(t); t = null; } };
    start();
    const onVis = () => { if (document.visibilityState === 'visible') { load(); start(); } else stop(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  const openRow = useCallback(async (row: MailRow) => {
    if (openId === row.id) { setOpenId(null); setReplyOpenId(null); return; }
    setOpenId(row.id);
    setReplyOpenId(null);
    setReplyText('');
    setReplyStatus('idle');
    if (fullById[row.id] && fullById[row.id] !== 'error') return;
    setFullById((m) => ({ ...m, [row.id]: 'loading' }));
    try {
      const r = await fetch('/api/mail/message/' + row.id, { cache: 'no-store' });
      const j = await r.json();
      if (!j?.ok) { setFullById((m) => ({ ...m, [row.id]: 'error' })); return; }
      setFullById((m) => ({ ...m, [row.id]: j.data as FullMessage }));
      // Mark read locally
      setRows((rs) => rs ? rs.map((x) => x.id === row.id ? { ...x, unread: false } : x) : rs);
    } catch {
      setFullById((m) => ({ ...m, [row.id]: 'error' }));
    }
  }, [openId, fullById]);

  const dismiss = useCallback(async (id: string) => {
    setDismissing((s) => new Set(s).add(id));
    try {
      const r = await fetch('/api/hod/revenue/mails/' + id + '/dismiss', { method: 'POST' });
      const j = await r.json();
      if (j?.ok) {
        // Fade out then remove.
        setTimeout(() => {
          setRows((rs) => rs ? rs.filter((x) => x.id !== id) : rs);
          setDismissing((s) => { const n = new Set(s); n.delete(id); return n; });
          if (openId === id) setOpenId(null);
        }, 220);
      } else {
        setDismissing((s) => { const n = new Set(s); n.delete(id); return n; });
      }
    } catch {
      setDismissing((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }, [openId]);

  const sendReply = useCallback(async (row: MailRow) => {
    const full = fullById[row.id];
    if (!full || full === 'loading' || full === 'error') return;
    if (!replyText.trim()) return;
    setReplyStatus('sending');
    const parsed = parseFromAddr(full.from);
    const subject = full.subject.startsWith('Re:') ? full.subject : 'Re: ' + full.subject;
    // Very simple HTML: preserve line breaks.
    const bodyHtml = replyText.split('\n').map((ln) => '<div>' + ln.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>').join('');
    try {
      const r = await fetch('/api/mail/reply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ threadId: full.threadId, inReplyToId: full.id, to: parsed.addr, subject, body: bodyHtml }),
      });
      const j = await r.json();
      if (j?.ok) {
        setReplyStatus('sent');
        setTimeout(() => {
          setRows((rs) => rs ? rs.filter((x) => x.id !== row.id) : rs);
          setOpenId(null);
          setReplyOpenId(null);
          setReplyText('');
          setReplyStatus('idle');
        }, 900);
      } else {
        setReplyStatus('error');
      }
    } catch {
      setReplyStatus('error');
    }
  }, [replyText, fullById]);

  const visibleRows = (rows ?? []).filter((r) => !dismissing.has(r.id) || true); // keep during fade
  const unreadCount = (rows ?? []).filter((r) => r.unread).length;

  return (
    <div style={{ background: BG, border: '1px solid ' + HAIRLINE, borderRadius: 6, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid ' + HAIRLINE, background: BG_INSET }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>Reservations Manager · Mai Vo</div>
          <div style={{ fontSize: 11, color: MUTED }}>rm@thenamkhan.com · last 30 messages · dismissed items hidden</div>
        </div>
        <div style={{ fontSize: 11, color: unreadCount > 0 ? UNREAD_DOT : MUTED, fontWeight: 600 }}>
          {unreadCount} unread
        </div>
      </div>

      {rows === null && <SkeletonRows />}

      {rows !== null && error === 'auth' && (
        <div style={{ padding: 16, fontSize: 12, color: INK }}>
          Your Gmail is not connected.{' '}
          <a href="/settings/gmail" style={{ color: UNREAD_DOT, textDecoration: 'none', fontWeight: 600 }}>
            Connect your Gmail to see Mai&rsquo;s messages &rarr;
          </a>
        </div>
      )}

      {rows !== null && error === 'generic' && (
        <div style={{ padding: 16, fontSize: 12, color: MUTED }}>
          Could not load messages. Retry in a moment.
        </div>
      )}

      {rows !== null && !error && rows.length === 0 && (
        <div style={{ padding: 16, fontSize: 12, color: MUTED, fontStyle: 'italic' }}>
          No new messages from Reservations Manager
        </div>
      )}

      {rows !== null && !error && rows.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {visibleRows.map((row) => {
            const isOpen = openId === row.id;
            const isHover = hoverId === row.id;
            const isDismissing = dismissing.has(row.id);
            const full = fullById[row.id];
            return (
              <li
                key={row.id}
                style={{
                  borderBottom: '1px solid ' + HAIRLINE,
                  borderTop: isOpen ? '1px solid ' + HAIRLINE : undefined,
                  background: isOpen ? BG_INSET : isHover ? HOVER : BG,
                  opacity: isDismissing ? 0.35 : 1,
                  transition: 'opacity 200ms ease, background 120ms ease',
                }}
                onMouseEnter={() => setHoverId(row.id)}
                onMouseLeave={() => setHoverId(null)}
              >
                <div
                  onClick={() => openRow(row)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
                >
                  <span style={{
                    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                    background: row.unread ? UNREAD_DOT : 'transparent',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{
                      fontSize: 12, color: INK, fontWeight: row.unread ? 700 : 500,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      flexShrink: 0, maxWidth: '38%',
                    }}>
                      {row.subject || '(no subject)'}
                    </span>
                    <span style={{
                      fontSize: 12, color: MUTED,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      flex: 1,
                    }}>
                      {row.snippet}
                    </span>
                  </div>
                  {isHover && !isOpen && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openRow(row); }}
                        style={chipStyle}
                      >Read</button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); dismiss(row.id); }}
                        style={chipStyle}
                      >Dismiss</button>
                    </div>
                  )}
                  <span style={{ fontSize: 11, color: MUTED, flexShrink: 0, minWidth: 60, textAlign: 'right' }}>
                    {relTime(row.dateMs)}
                  </span>
                </div>

                {isOpen && (
                  <div style={{ padding: '4px 14px 14px' }}>
                    {full === 'loading' && (
                      <div style={{ fontSize: 12, color: MUTED, padding: 8 }}>Loading&hellip;</div>
                    )}
                    {full === 'error' && (
                      <div style={{ fontSize: 12, color: '#C0584C', padding: 8 }}>Could not load this message.</div>
                    )}
                    {full && full !== 'loading' && full !== 'error' && (
                      <>
                        <div style={{
                          fontSize: 12, color: INK,
                          background: BG, border: '1px solid ' + HAIRLINE, borderRadius: 4,
                          padding: 12, maxHeight: 420, overflow: 'auto',
                        }}>
                          <div dangerouslySetInnerHTML={{ __html: full.htmlBody || ('<pre style="white-space:pre-wrap;font-family:inherit;margin:0">' + escapeHtml(full.textBody || '') + '</pre>') }} />
                        </div>

                        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                          <button
                            type="button"
                            onClick={() => { setReplyOpenId(row.id); setReplyStatus('idle'); }}
                            style={primaryBtn}
                          >Reply</button>
                          <button
                            type="button"
                            onClick={() => dismiss(row.id)}
                            style={secondaryBtn}
                          >Dismiss</button>
                          <button
                            type="button"
                            onClick={() => { setOpenId(null); setReplyOpenId(null); }}
                            style={secondaryBtn}
                          >Close</button>
                        </div>

                        {replyOpenId === row.id && (
                          <div style={{
                            marginTop: 10, padding: 10,
                            background: BG_INSET, border: '1px solid ' + HAIRLINE, borderRadius: 4,
                          }}>
                            {replyStatus === 'sent' ? (
                              <div style={{ fontSize: 12, color: INK, padding: 6 }}>Reply sent · Message archived</div>
                            ) : (
                              <>
                                <textarea
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  placeholder={'Reply to ' + parseFromAddr(full.from).name + '...'}
                                  rows={5}
                                  style={{
                                    width: '100%', boxSizing: 'border-box',
                                    fontSize: 12, color: INK, background: BG,
                                    border: '1px solid ' + HAIRLINE, borderRadius: 3,
                                    padding: 8, resize: 'vertical', fontFamily: 'inherit',
                                  }}
                                />
                                <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => sendReply(row)}
                                    disabled={replyStatus === 'sending' || !replyText.trim()}
                                    style={{ ...primaryBtn, opacity: (replyStatus === 'sending' || !replyText.trim()) ? 0.5 : 1 }}
                                  >{replyStatus === 'sending' ? 'Sending...' : 'Send'}</button>
                                  <button
                                    type="button"
                                    onClick={() => { setReplyOpenId(null); setReplyText(''); }}
                                    style={secondaryBtn}
                                  >Cancel</button>
                                  {replyStatus === 'error' && (
                                    <span style={{ fontSize: 11, color: '#C0584C' }}>Send failed. Try again.</span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
          borderBottom: '1px solid ' + HAIRLINE,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: HAIRLINE }} />
          <div style={{ flex: 1, height: 10, background: HAIRLINE, borderRadius: 2, opacity: 0.5 + i * 0.15 }} />
          <div style={{ width: 40, height: 10, background: HAIRLINE, borderRadius: 2, opacity: 0.5 }} />
        </div>
      ))}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const chipStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600,
  padding: '4px 10px', borderRadius: 3, background: BG, color: INK,
  border: '1px solid ' + HAIRLINE, cursor: 'pointer',
};

const primaryBtn: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600,
  padding: '6px 12px', borderRadius: 3,
  background: 'var(--primary, #1F3A2E)', color: '#FFFFFF',
  border: '1px solid transparent', cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600,
  padding: '6px 12px', borderRadius: 3,
  background: BG, color: INK,
  border: '1px solid ' + HAIRLINE, cursor: 'pointer',
};
