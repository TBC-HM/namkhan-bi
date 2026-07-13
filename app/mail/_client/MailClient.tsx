'use client';
// app/mail/_client/MailClient.tsx
// Full-screen 3-pane Gmail client. Left rail (labels) · Middle thread list ·
// Right message pane. Reuses ComposeModal for new messages; inline reply
// composer inside the message pane. Keyboard shortcuts j/k/e/#/s/r/// /Esc.
// Auto-poll every 60s while tab visible.
//
// PBS 2026-07-14 "professional full-screen mailbox, not the popup".

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ComposeModal from '@/app/_components/ComposeModal';

// ---- design tokens ------------------------------------------------------
const T = {
  WHITE:      '#FFFFFF',
  HAIR:       '#E6DFCC',
  INK:        '#1B1B1B',
  INK_M:      '#5A5A5A',
  INK_S:      '#3A3A3A',
  RAIL_BG:    '#FAFAF7',
  HOVER:      '#F5F0E0',
  SELECT:     '#E6DFCC',
  UNREAD_DOT: '#2563EB',
  STAR:       '#F59E0B',
  FOREST:     '#084838',
  CREAM:      '#F5F0E1',
  RED:        '#B03826',
};

// ---- types --------------------------------------------------------------
interface ListRow {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  dateMs: number;
  snippet: string;
  unread: boolean;
  starred: boolean;
  hasAttachment: boolean;
  labelIds: string[];
}

interface FullMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: string;
  dateMs: number;
  snippet: string;
  htmlBody: string;
  textBody: string;
  labelIds: string[];
  headers: Record<string, string>;
  unread: boolean;
  starred: boolean;
}

interface Label {
  id: string;
  name: string;
  type: 'system' | 'user';
  messagesUnread: number;
  messagesTotal: number;
}

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: string };
type Api<T> = ApiOk<T> | ApiErr;

interface Props { userId: string; userEmail: string }

// ---- helpers ------------------------------------------------------------
const SYSTEM_ORDER: Array<{ id: string; label: string }> = [
  { id: 'INBOX',    label: 'Inbox'   },
  { id: 'STARRED',  label: 'Starred' },
  { id: 'SNOOZED',  label: 'Snoozed' },
  { id: 'SENT',     label: 'Sent'    },
  { id: 'DRAFT',    label: 'Drafts'  },
  { id: 'CATEGORY_UPDATES', label: 'Updates' },
  { id: 'SPAM',     label: 'Spam'    },
  { id: 'TRASH',    label: 'Trash'   },
];

function parseFrom(raw: string): { name: string; email: string } {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: '', email: raw.trim() };
}

function relTime(ms: number): string {
  if (!ms) return '';
  const now = Date.now();
  const diff = now - ms;
  if (diff < 60_000) return 'now';
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return mins + 'm';
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours + 'h';
  const d = new Date(ms);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return hours + 'h';
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  const days = Math.round(hours / 24);
  if (days < 7) return days + 'd';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---- root ---------------------------------------------------------------
export default function MailClient({ userId: _userId, userEmail }: Props) {
  void _userId; // reserved for future targeted API calls
  const [labels, setLabels] = useState<Label[]>([]);
  const [currentLabel, setCurrentLabel] = useState<string>('INBOX');
  const [rows, setRows] = useState<ListRow[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<FullMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [committedQuery, setCommittedQuery] = useState<string>('');
  const [unreadFilter, setUnreadFilter] = useState<boolean>(false);
  const [starredFilter, setStarredFilter] = useState<boolean>(false);
  const [showCompose, setShowCompose] = useState<boolean>(false);
  const [replyOpen, setReplyOpen] = useState<boolean>(false);
  const [replyBody, setReplyBody] = useState<string>('');
  const [replySending, setReplySending] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const searchRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const infiniteSentinel = useRef<HTMLDivElement | null>(null);

  // ---- load labels once + polling ---------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/mail/labels', { cache: 'no-store' });
        const j = (await r.json()) as Api<Label[]>;
        if (j.ok === false) return;
        setLabels(j.data);
      } catch { /* silent */ }
    })();
  }, []);

  // ---- query debounce ---------------------------------------------------
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setCommittedQuery(query.trim()), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // ---- computed final query (label filters -> Gmail query) --------------
  const finalQ = useMemo(() => {
    const parts: string[] = [];
    if (committedQuery) parts.push(committedQuery);
    if (unreadFilter) parts.push('is:unread');
    if (starredFilter) parts.push('is:starred');
    return parts.join(' ');
  }, [committedQuery, unreadFilter, starredFilter]);

  // ---- load current label list -----------------------------------------
  const loadList = useCallback(async (append?: string) => {
    setLoadingList(true);
    setLastError(null);
    try {
      const params = new URLSearchParams();
      params.set('label', currentLabel);
      if (finalQ) params.set('q', finalQ);
      if (append) params.set('pageToken', append);
      params.set('max', '50');
      const r = await fetch('/api/mail/messages?' + params.toString(), { cache: 'no-store' });
      const j = (await r.json()) as Api<{ messages: ListRow[]; nextPageToken: string | null }>;
      if (j.ok === false) {
        setLastError(j.error);
        if (!append) setRows([]);
        setNextPageToken(null);
        return;
      }
      setNextPageToken(j.data.nextPageToken);
      setRows((prev) => (append ? [...prev, ...j.data.messages] : j.data.messages));
    } catch (e) {
      setLastError(e instanceof Error ? e.message : 'load_failed');
    } finally {
      setLoadingList(false);
    }
  }, [currentLabel, finalQ]);

  useEffect(() => {
    setRows([]);
    setSelectedId(null);
    setThreadMessages([]);
    void loadList();
  }, [loadList]);

  // ---- auto-poll (60s, tab-visible) -------------------------------------
  useEffect(() => {
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible') void loadList();
    }, 60_000);
    return () => clearInterval(iv);
  }, [loadList]);

  // ---- IntersectionObserver for infinite scroll -------------------------
  useEffect(() => {
    const node = infiniteSentinel.current;
    if (!node || !nextPageToken) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && nextPageToken && !loadingList) {
          void loadList(nextPageToken);
        }
      }
    }, { rootMargin: '200px' });
    io.observe(node);
    return () => io.disconnect();
  }, [nextPageToken, loadingList, loadList]);

  // ---- thread select ----------------------------------------------------
  const selectRow = useCallback(async (row: ListRow) => {
    setSelectedId(row.id);
    setReplyOpen(false);
    setReplyBody('');
    setLoadingThread(true);
    try {
      const r = await fetch('/api/mail/thread/' + encodeURIComponent(row.threadId), { cache: 'no-store' });
      const j = (await r.json()) as Api<FullMessage[]>;
      if (j.ok === false) {
        setThreadMessages([]);
        setLastError(j.error);
        return;
      }
      setThreadMessages(j.data);
      // Expand only the newest by default; older collapsed.
      const emap: Record<string, boolean> = {};
      j.data.forEach((m, i) => { emap[m.id] = i === j.data.length - 1; });
      setExpandedMap(emap);
      // Optimistic mark read
      if (row.unread) {
        setRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, unread: false } : x)));
        await fetch('/api/mail/message/' + encodeURIComponent(row.id) + '/modify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ removeLabels: ['UNREAD'] }),
        });
      }
    } finally {
      setLoadingThread(false);
    }
  }, []);

  // ---- row actions ------------------------------------------------------
  const archiveRow = useCallback(async (id: string) => {
    setRows((prev) => prev.filter((x) => x.id !== id));
    if (selectedId === id) { setSelectedId(null); setThreadMessages([]); }
    await fetch('/api/mail/message/' + encodeURIComponent(id) + '/modify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ removeLabels: ['INBOX'] }),
    });
  }, [selectedId]);

  const trashRow = useCallback(async (id: string) => {
    setRows((prev) => prev.filter((x) => x.id !== id));
    if (selectedId === id) { setSelectedId(null); setThreadMessages([]); }
    await fetch('/api/mail/message/' + encodeURIComponent(id), { method: 'DELETE' });
  }, [selectedId]);

  const toggleStar = useCallback(async (id: string) => {
    let nextStarred = false;
    setRows((prev) => prev.map((x) => {
      if (x.id !== id) return x;
      nextStarred = !x.starred;
      return { ...x, starred: nextStarred };
    }));
    await fetch('/api/mail/message/' + encodeURIComponent(id) + '/modify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(nextStarred ? { addLabels: ['STARRED'] } : { removeLabels: ['STARRED'] }),
    });
  }, []);

  const markUnread = useCallback(async (id: string) => {
    setRows((prev) => prev.map((x) => (x.id === id ? { ...x, unread: true } : x)));
    await fetch('/api/mail/message/' + encodeURIComponent(id) + '/modify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ addLabels: ['UNREAD'] }),
    });
  }, []);

  // ---- reply ------------------------------------------------------------
  const openReply = useCallback(() => {
    setReplyOpen(true);
    setReplyBody('');
  }, []);

  const sendReply = useCallback(async () => {
    if (threadMessages.length === 0 || !replyBody.trim()) return;
    const newest = threadMessages[threadMessages.length - 1];
    const parsed = parseFrom(newest.from);
    const subject = /^re[: ]/i.test(newest.subject) ? newest.subject : ('Re: ' + newest.subject);
    setReplySending(true);
    try {
      const r = await fetch('/api/mail/reply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          threadId: newest.threadId,
          inReplyToId: newest.id,
          to: parsed.email || newest.from,
          subject,
          body: '<div>' + replyBody.replace(/\n/g, '<br/>') + '</div>',
        }),
      });
      const j = await r.json();
      if (r.ok && j.ok !== false) {
        setReplyBody('');
        setReplyOpen(false);
        // Refetch the thread to show the newly-sent reply appended.
        const tr = await fetch('/api/mail/thread/' + encodeURIComponent(newest.threadId), { cache: 'no-store' });
        const tj = (await tr.json()) as Api<FullMessage[]>;
        if (tj.ok !== false) setThreadMessages(tj.data);
      } else {
        setLastError(j.error ?? 'reply_failed');
      }
    } catch (e) {
      setLastError(e instanceof Error ? e.message : 'reply_failed');
    } finally {
      setReplySending(false);
    }
  }, [threadMessages, replyBody]);

  // ---- keyboard shortcuts -----------------------------------------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = rows.findIndex((r) => r.id === selectedId);
      if (e.key === 'j') { e.preventDefault(); const n = rows[Math.min(rows.length - 1, idx + 1)]; if (n) void selectRow(n); }
      else if (e.key === 'k') { e.preventDefault(); const n = rows[Math.max(0, idx - 1)]; if (n) void selectRow(n); }
      else if (e.key === 'e' && selectedId) { e.preventDefault(); void archiveRow(selectedId); }
      else if (e.key === '#' && selectedId) { e.preventDefault(); void trashRow(selectedId); }
      else if (e.key === 's' && selectedId) { e.preventDefault(); void toggleStar(selectedId); }
      else if (e.key === 'r' && selectedId && threadMessages.length) { e.preventDefault(); openReply(); }
      else if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === 'Escape') {
        if (replyOpen) setReplyOpen(false);
        else { setSelectedId(null); setThreadMessages([]); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [rows, selectedId, threadMessages, replyOpen, selectRow, archiveRow, trashRow, toggleStar, openReply]);

  // ---- debug hook -------------------------------------------------------
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('debug=1')) {
      // eslint-disable-next-line no-console
      console.log('[mail]', { currentLabel, threadCount: rows.length, selectedId, lastError });
    }
  }, [currentLabel, rows.length, selectedId, lastError]);

  // ---- render -----------------------------------------------------------
  const userLabels = labels.filter((l) => l.type === 'user');

  return (
    <div style={{ height: '100vh', display: 'grid', gridTemplateColumns: '240px 380px 1fr', color: T.INK, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", background: T.WHITE }}>
      {/* LEFT RAIL */}
      <aside style={{ background: T.RAIL_BG, borderRight: '1px solid ' + T.HAIR, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 14, borderBottom: '1px solid ' + T.HAIR }}>
          <button
            type="button"
            onClick={() => setShowCompose(true)}
            style={{
              width: '100%', background: T.FOREST, color: T.WHITE, border: 'none',
              borderRadius: 6, padding: '10px 12px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', letterSpacing: '.02em',
            }}
          >Compose</button>
        </div>
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {SYSTEM_ORDER.map((s) => {
            const lbl = labels.find((l) => l.id === s.id);
            const unread = lbl?.messagesUnread ?? 0;
            return (
              <RailItem
                key={s.id}
                label={s.label}
                unread={unread}
                active={currentLabel === s.id}
                onClick={() => setCurrentLabel(s.id)}
              />
            );
          })}
          {userLabels.length > 0 && (
            <>
              <div style={{ padding: '10px 16px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: T.INK_M }}>Labels</div>
              {userLabels.map((l) => (
                <RailItem
                  key={l.id}
                  label={l.name}
                  unread={l.messagesUnread}
                  active={currentLabel === l.id}
                  onClick={() => setCurrentLabel(l.id)}
                />
              ))}
            </>
          )}
        </nav>
        <div style={{ padding: '10px 14px', borderTop: '1px solid ' + T.HAIR, fontSize: 11, color: T.INK_M, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span title={userEmail} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>{userEmail}</span>
          <button type="button" onClick={() => void loadList()} title="Refresh" style={{ background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 4, padding: '3px 8px', color: T.INK_S, fontSize: 12, cursor: 'pointer' }}>↻</button>
        </div>
      </aside>

      {/* MIDDLE THREAD LIST */}
      <section ref={listRef} style={{ borderRight: '1px solid ' + T.HAIR, background: T.WHITE, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 10, borderBottom: '1px solid ' + T.HAIR, position: 'sticky', top: 0, background: T.WHITE, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search: from:hoster label:booking after:2026/07/01"
              style={{
                flex: 1, border: '1px solid ' + T.HAIR, borderRadius: 6,
                padding: '7px 10px', fontSize: 12, background: T.WHITE, color: T.INK,
                outline: 'none',
              }}
            />
            <button type="button" onClick={() => void loadList()} title="Reload" style={{ background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 4, padding: '6px 8px', color: T.INK_S, fontSize: 12, cursor: 'pointer' }}>↻</button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <FilterChip label="Unread" active={unreadFilter} onClick={() => setUnreadFilter((v) => !v)} />
            <FilterChip label="Starred" active={starredFilter} onClick={() => setStarredFilter((v) => !v)} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingList && rows.length === 0 ? (
            <SkeletonList />
          ) : rows.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: T.INK_M, fontSize: 13 }}>No messages match this filter.</div>
          ) : (
            <>
              {rows.map((r) => (
                <ThreadRow
                  key={r.id}
                  row={r}
                  selected={r.id === selectedId}
                  onClick={() => void selectRow(r)}
                  onToggleStar={(e) => { e.stopPropagation(); void toggleStar(r.id); }}
                />
              ))}
              {nextPageToken && (
                <div ref={infiniteSentinel} style={{ padding: 10, textAlign: 'center', color: T.INK_M, fontSize: 11 }}>
                  {loadingList ? 'Loading…' : 'Scroll for more'}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* RIGHT MESSAGE PANE */}
      <section style={{ background: T.WHITE, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedId ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.INK_M, flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 42, color: T.HAIR }} aria-hidden>✉</div>
            <div style={{ fontSize: 13 }}>Select a conversation</div>
          </div>
        ) : loadingThread && threadMessages.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.INK_M, fontSize: 13 }}>Loading conversation…</div>
        ) : (
          <>
            <ThreadHeader
              subject={threadMessages[0]?.subject || '(no subject)'}
              onArchive={() => selectedId && void archiveRow(selectedId)}
              onTrash={() => selectedId && void trashRow(selectedId)}
              onStar={() => selectedId && void toggleStar(selectedId)}
              onMarkUnread={() => selectedId && void markUnread(selectedId)}
              starred={rows.find((x) => x.id === selectedId)?.starred ?? false}
            />
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {threadMessages.map((m, i) => (
                <MessageCard
                  key={m.id}
                  msg={m}
                  expanded={!!expandedMap[m.id]}
                  isNewest={i === threadMessages.length - 1}
                  onToggle={() => setExpandedMap((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                />
              ))}
            </div>
            <div style={{ borderTop: '1px solid ' + T.HAIR, background: T.WHITE, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!replyOpen ? (
                <button
                  type="button"
                  onClick={openReply}
                  style={{ alignSelf: 'flex-start', background: T.FOREST, color: T.WHITE, border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >Reply</button>
              ) : (
                <>
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write a reply…"
                    rows={5}
                    style={{ width: '100%', border: '1px solid ' + T.HAIR, borderRadius: 6, padding: 10, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: T.INK, background: T.WHITE, resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => void sendReply()}
                      disabled={replySending || !replyBody.trim()}
                      style={{ background: replySending || !replyBody.trim() ? '#8FA69A' : T.FOREST, color: T.WHITE, border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: replySending ? 'not-allowed' : 'pointer' }}
                    >{replySending ? 'Sending…' : 'Send'}</button>
                    <button
                      type="button"
                      onClick={() => { setReplyOpen(false); setReplyBody(''); }}
                      style={{ background: T.WHITE, color: T.INK, border: '1px solid ' + T.HAIR, borderRadius: 6, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}
                    >Cancel</button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </section>

      {showCompose && (
        <ComposeModal onClose={() => setShowCompose(false)} onSent={() => { setShowCompose(false); void loadList(); }} />
      )}

      {lastError && (
        <div style={{ position: 'fixed', bottom: 12, right: 12, background: T.RED, color: T.WHITE, padding: '8px 12px', borderRadius: 4, fontSize: 11, zIndex: 3000 }} onClick={() => setLastError(null)}>{lastError}</div>
      )}
    </div>
  );
}

// ---- subcomponents ------------------------------------------------------

function RailItem({ label, unread, active, onClick }: { label: string; unread: number; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const bg = active ? T.SELECT : hover ? T.HOVER : 'transparent';
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 16px', cursor: 'pointer', background: bg,
        borderLeft: active ? '3px solid ' + T.FOREST : '3px solid transparent',
        fontSize: 13, color: T.INK, fontWeight: active ? 600 : 500,
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {unread > 0 && (
        <span style={{ background: T.FOREST, color: T.WHITE, borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
          {unread > 999 ? '999+' : unread}
        </span>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: '1px solid ' + T.HAIR,
        background: active ? T.FOREST : T.WHITE,
        color: active ? T.WHITE : T.INK_S,
        borderRadius: 14, padding: '3px 10px', fontSize: 11, fontWeight: 600,
        cursor: 'pointer',
      }}
    >{label}</button>
  );
}

function SkeletonList() {
  return (
    <div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ padding: '10px 12px', borderBottom: '1px solid ' + T.HAIR, opacity: 0.6 }}>
          <div style={{ height: 10, background: T.CREAM, width: '35%', borderRadius: 3, marginBottom: 6 }} />
          <div style={{ height: 8, background: T.CREAM, width: '80%', borderRadius: 3 }} />
        </div>
      ))}
    </div>
  );
}

function ThreadRow({ row, selected, onClick, onToggleStar }: { row: ListRow; selected: boolean; onClick: () => void; onToggleStar: (e: React.MouseEvent) => void }) {
  const [hover, setHover] = useState(false);
  const bg = selected ? T.SELECT : hover ? T.HOVER : T.WHITE;
  const parsed = parseFrom(row.from);
  const senderName = parsed.name || parsed.email.split('@')[0];
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px', borderBottom: '1px solid ' + T.HAIR,
        background: bg, cursor: 'pointer',
      }}
    >
      <div style={{ width: 10, display: 'flex', justifyContent: 'center' }}>
        {row.unread && <span style={{ width: 8, height: 8, borderRadius: 4, background: T.UNREAD_DOT, display: 'inline-block' }} />}
      </div>
      <button type="button" onClick={onToggleStar} title={row.starred ? 'Unstar' : 'Star'} style={{ background: 'transparent', border: 'none', color: row.starred ? T.STAR : T.INK_M, cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>★</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: row.unread ? 700 : 500, color: T.INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {senderName}
          </div>
          <div style={{ fontSize: 11, color: T.INK_M, flexShrink: 0 }}>{relTime(row.dateMs)}</div>
        </div>
        <div style={{ fontSize: 12, color: T.INK, fontWeight: row.unread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.subject || '(no subject)'} {row.hasAttachment && <span style={{ color: T.INK_M }} title="Attachment">📎</span>}
        </div>
        <div style={{ fontSize: 11, color: T.INK_M, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.snippet}
        </div>
      </div>
    </div>
  );
}

function ThreadHeader({ subject, onArchive, onTrash, onStar, onMarkUnread, starred }: { subject: string; onArchive: () => void; onTrash: () => void; onStar: () => void; onMarkUnread: () => void; starred: boolean }) {
  return (
    <div style={{ padding: '14px 24px 12px', borderBottom: '1px solid ' + T.HAIR, background: T.WHITE, position: 'sticky', top: 0, zIndex: 2 }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: T.INK, marginBottom: 10, wordBreak: 'break-word' }}>{subject}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <HeaderBtn onClick={onArchive}>Archive</HeaderBtn>
        <HeaderBtn onClick={onTrash}>Trash</HeaderBtn>
        <HeaderBtn onClick={onStar}><span style={{ color: starred ? T.STAR : T.INK_S }}>★</span> {starred ? 'Unstar' : 'Star'}</HeaderBtn>
        <HeaderBtn onClick={onMarkUnread}>Mark unread</HeaderBtn>
      </div>
    </div>
  );
}

function HeaderBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: T.WHITE, color: T.INK, border: '1px solid ' + T.HAIR, borderRadius: 4, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
    >{children}</button>
  );
}

function MessageCard({ msg, expanded, isNewest, onToggle }: { msg: FullMessage; expanded: boolean; isNewest: boolean; onToggle: () => void }) {
  const parsed = parseFrom(msg.from);
  const senderName = parsed.name || parsed.email;
  return (
    <div style={{ border: '1px solid ' + T.HAIR, borderRadius: 8, background: T.WHITE, overflow: 'hidden' }}>
      <div
        onClick={onToggle}
        style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start', background: isNewest ? T.WHITE : T.RAIL_BG }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.INK }}>{senderName} <span style={{ color: T.INK_M, fontWeight: 400 }}>&lt;{parsed.email}&gt;</span></div>
          {!expanded && <div style={{ fontSize: 12, color: T.INK_M, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.snippet}</div>}
          {expanded && (
            <div style={{ fontSize: 11, color: T.INK_M, marginTop: 4 }}>
              to {msg.to}{msg.cc ? ' · cc ' + msg.cc : ''}
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: T.INK_M, flexShrink: 0, textAlign: 'right' }}>{msg.date ? new Date(msg.dateMs).toLocaleString() : ''}</div>
      </div>
      {expanded && (
        <div style={{ padding: '4px 20px 20px', maxWidth: 760, margin: '0 auto' }}>
          <div
            style={{ fontSize: 13, color: T.INK, lineHeight: 1.55, wordWrap: 'break-word', overflow: 'auto' }}
            dangerouslySetInnerHTML={{ __html: msg.htmlBody }}
          />
        </div>
      )}
    </div>
  );
}
