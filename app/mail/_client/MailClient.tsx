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
  const [directFilter, setDirectFilter] = useState<boolean>(false);
  const [todayFilter, setTodayFilter] = useState<boolean>(false);
  const [weekFilter, setWeekFilter] = useState<boolean>(false);
  const [attachFilter, setAttachFilter] = useState<boolean>(false);
  const [newslettersOnly, setNewslettersOnly] = useState<boolean>(false);
  const [showCompose, setShowCompose] = useState<boolean>(false);
  const [replyOpen, setReplyOpen] = useState<boolean>(false);
  const [replyBody, setReplyBody] = useState<string>('');
  const [replySending, setReplySending] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  // Summary popover (calls /api/inbox/summary).
  const [summaryOpen, setSummaryOpen] = useState<boolean>(false);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
  const [summaryText, setSummaryText] = useState<string>('');
  // Poller freshness banner (Gmail sync pipeline last-run age in days).
  const [pollerDaysAgo, setPollerDaysAgo] = useState<number | null>(null);
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

  // ---- poller freshness (Gmail-side ingest pipeline is separate) --------
  // Mirrors the /mail/analytics staleness banner. Shows only when > 2 days.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/inbox/summary', { cache: 'no-store' });
        const j = await r.json() as { poller_minutes_since?: number | null };
        const mins = j?.poller_minutes_since ?? null;
        if (mins != null && Number.isFinite(mins)) {
          setPollerDaysAgo(Math.floor(mins / 1440));
        }
      } catch { /* silent */ }
    })();
  }, []);

  // ---- summary today ----------------------------------------------------
  const openSummary = useCallback(async () => {
    setSummaryOpen(true);
    setSummaryLoading(true);
    setSummaryText('');
    try {
      const r = await fetch('/api/inbox/summary', { cache: 'no-store' });
      const j = await r.json() as {
        inbound_24h?: number; outbound_24h?: number; unanswered?: number;
        unread?: number; top_senders_24h?: Array<{ email: string; name?: string | null; inbound_24h: number }>;
      };
      const inbound  = j.inbound_24h  ?? 0;
      const outbound = j.outbound_24h ?? 0;
      const unread   = j.unread       ?? 0;
      const unans    = j.unanswered   ?? 0;
      const top = (j.top_senders_24h ?? []).slice(0, 3)
        .map((s) => (s.name?.trim() || s.email))
        .filter(Boolean);
      const s1 = `Last 24h: ${inbound} in / ${outbound} out · ${unread} unread · ${unans} unanswered.`;
      const s2 = top.length
        ? `Top senders: ${top.join(', ')}.`
        : 'No standout senders in the last 24h.';
      const s3 = unans > 5
        ? `Focus first on the ${unans} unanswered threads — filter Unread + Direct-to-me to shortlist them.`
        : (unread > 0
            ? `Only ${unread} unread — you can clear the inbox in one pass.`
            : 'Inbox is clean. Ship the day.');
      setSummaryText([s1, s2, s3].join(' '));
    } catch (e) {
      setSummaryText(e instanceof Error ? ('Summary failed: ' + e.message) : 'Summary failed.');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // ---- query debounce ---------------------------------------------------
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setCommittedQuery(query.trim()), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // ---- computed final query (label filters -> Gmail query) --------------
  // Uses Gmail's native search operators so filtering happens server-side.
  //   direct: excludes CC/BCC — Gmail supports  `to:me -cc:me -bcc:me`
  //   today / week: `newer_than:1d` / `newer_than:7d`
  //   attach: `has:attachment`
  //   newslettersOnly: rely on the "unsubscribe" text OR List-Unsubscribe
  //     header — Gmail exposes `list:` operator for List-Id.
  const finalQ = useMemo(() => {
    const parts: string[] = [];
    if (committedQuery) parts.push(committedQuery);
    if (unreadFilter) parts.push('is:unread');
    if (starredFilter) parts.push('is:starred');
    if (directFilter)  parts.push('to:me -cc:me -bcc:me');
    if (todayFilter)   parts.push('newer_than:1d');
    if (weekFilter)    parts.push('newer_than:7d');
    if (attachFilter)  parts.push('has:attachment');
    if (newslettersOnly) parts.push('(unsubscribe OR "List-Unsubscribe")');
    return parts.join(' ');
  }, [committedQuery, unreadFilter, starredFilter, directFilter, todayFilter, weekFilter, attachFilter, newslettersOnly]);

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
  const newsletterLabels = userLabels.filter((l) => /news\s*letter|digest|weekly/i.test(l.name));
  const otherUserLabels = userLabels.filter((l) => !newsletterLabels.includes(l));

  return (
    <div style={{ height: '100vh', display: 'grid', gridTemplateColumns: '240px 380px 1fr', color: T.INK, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", background: T.WHITE }}>
      {/* LEFT RAIL */}
      <aside style={{ background: T.RAIL_BG, borderRight: '1px solid ' + T.HAIR, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 14, borderBottom: '1px solid ' + T.HAIR, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowCompose(true)}
            style={{
              width: '100%', background: T.FOREST, color: T.WHITE, border: 'none',
              borderRadius: 6, padding: '10px 12px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', letterSpacing: '.02em',
            }}
          >Compose</button>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mail"
            style={{
              width: '100%', border: '1px solid ' + T.HAIR, borderRadius: 6,
              padding: '7px 10px', fontSize: 12, background: T.WHITE, color: T.INK,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => void openSummary()}
            style={{
              width: '100%', background: T.WHITE, color: T.FOREST,
              border: '1px solid ' + T.FOREST, borderRadius: 6,
              padding: '8px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >Summary today</button>
        </div>

        {/* Sticky filter chips (multi-select). */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid ' + T.HAIR, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <FilterChip label="Direct" active={directFilter} onClick={() => setDirectFilter((v) => !v)} />
          <FilterChip label="Unread" active={unreadFilter} onClick={() => setUnreadFilter((v) => !v)} />
          <FilterChip label="Starred" active={starredFilter} onClick={() => setStarredFilter((v) => !v)} />
          <FilterChip label="Today" active={todayFilter} onClick={() => { setTodayFilter((v) => !v); if (!todayFilter) setWeekFilter(false); }} />
          <FilterChip label="Week" active={weekFilter} onClick={() => { setWeekFilter((v) => !v); if (!weekFilter) setTodayFilter(false); }} />
          <FilterChip label="Attach" active={attachFilter} onClick={() => setAttachFilter((v) => !v)} />
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

          {/* Newsletters section — user labels whose name contains "newsletter"
              OR the Gmail toggle that filters by List-Unsubscribe header. */}
          <div style={{ padding: '10px 16px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: T.INK_M }}>Newsletters</div>
          <RailItem
            label="All newsletters"
            unread={0}
            active={newslettersOnly}
            onClick={() => setNewslettersOnly((v) => !v)}
          />
          {newsletterLabels.map((l) => (
            <RailItem
              key={l.id}
              label={l.name}
              unread={l.messagesUnread}
              active={currentLabel === l.id}
              onClick={() => setCurrentLabel(l.id)}
            />
          ))}

          {otherUserLabels.length > 0 && (
            <>
              <div style={{ padding: '10px 16px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: T.INK_M }}>Labels</div>
              {otherUserLabels.map((l) => (
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

          {/* Settings-style link section */}
          <div style={{ padding: '10px 16px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: T.INK_M }}>Settings</div>
          <a href="/mail/automations" style={{ display: 'block', padding: '7px 16px', fontSize: 13, color: T.INK, textDecoration: 'none', borderLeft: '3px solid transparent' }}>Automations</a>
          <a href="/mail/autoresponder" style={{ display: 'block', padding: '7px 16px', fontSize: 13, color: T.INK, textDecoration: 'none', borderLeft: '3px solid transparent' }}>Auto-responder</a>
          <a href="/mail/analytics" style={{ display: 'block', padding: '7px 16px', fontSize: 13, color: T.INK, textDecoration: 'none', borderLeft: '3px solid transparent' }}>Analytics</a>
        </nav>

        <div style={{ padding: '10px 14px', borderTop: '1px solid ' + T.HAIR, fontSize: 11, color: T.INK_M, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span title={userEmail} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>{userEmail}</span>
          <button type="button" onClick={() => void loadList()} title="Refresh" style={{ background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 4, padding: '3px 8px', color: T.INK_S, fontSize: 12, cursor: 'pointer' }}>↻</button>
        </div>
      </aside>

      {/* MIDDLE THREAD LIST */}
      <section ref={listRef} style={{ borderRight: '1px solid ' + T.HAIR, background: T.WHITE, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 10, borderBottom: '1px solid ' + T.HAIR, position: 'sticky', top: 0, background: T.WHITE, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pollerDaysAgo != null && pollerDaysAgo > 2 && (
            <div style={{ background: T.CREAM, border: '1px solid ' + T.HAIR, borderRadius: 4, padding: '6px 10px', fontSize: 11, color: T.INK_S }}>
              Gmail sync poller last ran {pollerDaysAgo}d ago — some analytics may lag. Live inbox unaffected.
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.INK, textTransform: 'capitalize' }}>
              {(SYSTEM_ORDER.find((s) => s.id === currentLabel)?.label ?? labels.find((l) => l.id === currentLabel)?.name ?? currentLabel).toLowerCase()}
              {finalQ && (
                <span style={{ marginLeft: 6, fontSize: 11, color: T.INK_M, fontWeight: 400 }}>· filtered</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void loadList()}
              title="Reload"
              style={{ background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 4, padding: '4px 8px', color: T.INK_S, fontSize: 12, cursor: 'pointer' }}
            >↻</button>
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

      {summaryOpen && (
        <div
          onClick={() => setSummaryOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 2500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 520, maxWidth: '100%', background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.INK }}>Summary today</div>
              <button type="button" onClick={() => setSummaryOpen(false)} style={{ background: 'transparent', border: 'none', color: T.INK_M, cursor: 'pointer', fontSize: 16 }} aria-label="Close">×</button>
            </div>
            {summaryLoading ? (
              <div style={{ fontSize: 13, color: T.INK_M }}>Generating…</div>
            ) : (
              <div style={{ fontSize: 13, color: T.INK, lineHeight: 1.6 }}>{summaryText || 'No summary available.'}</div>
            )}
            <div style={{ fontSize: 11, color: T.INK_M }}>Source: /api/inbox/summary · live per-mailbox stats</div>
          </div>
        </div>
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

// Deterministic small colour palette for avatar backgrounds (paper-white
// tenant only uses inks/hairlines, so we lean on a muted saturation set).
const AVATAR_PALETTE = ['#084838', '#8B5A2B', '#5A5A5A', '#3A5A6B', '#7A4A5A', '#4A6B4A', '#8B6A2B'];

function Avatar({ name, email }: { name: string; email: string }) {
  const seed = (name || email || '?').trim();
  const initials = (() => {
    const parts = seed.replace(/["<>]/g, '').split(/[\s@._-]+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
    return (parts[0][0] + parts[1][0]).toUpperCase();
  })();
  const hash = (() => {
    let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return h;
  })();
  const bg = AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 14, background: bg, color: T.WHITE,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, letterSpacing: '.02em', flexShrink: 0,
    }} aria-hidden>{initials}</div>
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
      <div style={{ width: 8, display: 'flex', justifyContent: 'center' }}>
        {row.unread && <span style={{ width: 6, height: 6, borderRadius: 3, background: T.UNREAD_DOT, display: 'inline-block' }} />}
      </div>
      <Avatar name={senderName} email={parsed.email} />
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
