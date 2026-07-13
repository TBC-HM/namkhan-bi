// app/(cockpit)/_design/UnifiedMailInbox.tsx
// Sales · Mails — unified inbox across shared Google Workspace mailboxes.
// Full-width primitive (gridColumn: 1/-1). Design tokens per PBS 2026-07-13.
//
// Contract:
//   - Server hydrates initialThreads + mailboxes summary. Client-side handles
//     mailbox pill filter, unread toggle, search (throttled), refresh, mark-read,
//     star, load-more.
//   - Reply falls back to a Gmail deep link until ComposeModal.tsx (from the
//     per-user Gmail agent) lands. When it does, swap the anchor for the modal.
//   - No functions passed server→client — all data pre-shaped on the server.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ---- design tokens (memory-locked palette) ----
const T = {
  WHITE:  '#FFFFFF',
  HAIR:   '#E6DFCC',
  INK:    '#1B1B1B',
  INK_M:  '#5A5A5A',
  INK_S:  '#3A3A3A',
  FOREST: '#084838',
  CREAM:  '#F5F0E1',
  RED:    '#B03826',
  AMBER:  '#B48A3A',
};

// ---- public types ----
export interface Thread {
  mailbox_id: string;
  mailbox_address: string;
  label: string;
  badge_color: string;
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  dateMs: number;
  unread: boolean;
  starred: boolean;
}

export interface MailboxSummary {
  id: string;
  mailbox_address: string;
  label: string;
  badge_color: string;
  sort_order: number;
  active: boolean;
}

export interface UnifiedMailInboxProps {
  initialThreads: Thread[];
  mailboxes: MailboxSummary[];
  defaultMailboxId?: string;
  connectHref?: string;
}

function parseFrom(raw: string): { name: string; email: string } {
  const m = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: '', email: raw.trim() };
}

function relTime(ms: number): string {
  if (!ms) return '';
  const now = Date.now();
  const diffMs = now - ms;
  if (diffMs < 60_000) return 'just now';
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return mins + 'm ago';
  const hours = Math.round(mins / 60);
  const isToday = new Date(ms).toDateString() === new Date().toDateString();
  if (isToday) {
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (new Date(ms).toDateString() === y.toDateString()) return 'yesterday';
  if (hours < 24 * 7) return Math.round(hours / 24) + 'd ago';
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function gmailDeepLink(threadId: string): string {
  return 'https://mail.google.com/mail/u/0/#inbox/' + threadId;
}

export default function UnifiedMailInbox(props: UnifiedMailInboxProps) {
  const { mailboxes, initialThreads, defaultMailboxId, connectHref } = props;

  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [selectedMailbox, setSelectedMailbox] = useState<string>(defaultMailboxId ?? 'all');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [committedSearch, setCommittedSearch] = useState<string>('');
  const [limit, setLimit] = useState<number>(50);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [busyMsgId, setBusyMsgId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setCommittedSearch(search.trim()), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (selectedMailbox && selectedMailbox !== 'all') params.set('mailbox_id', selectedMailbox);
      if (unreadOnly) params.set('unread', 'true');
      if (committedSearch) params.set('q', committedSearch);
      params.set('limit', String(limit));
      const r = await fetch('/api/sales/mails/inbox?' + params.toString(), { cache: 'no-store' });
      if (!r.ok) return;
      const j = (await r.json()) as { threads?: Thread[] };
      setThreads(j.threads ?? []);
    } finally {
      setRefreshing(false);
    }
  }, [selectedMailbox, unreadOnly, committedSearch, limit]);

  useEffect(() => { void load(); }, [load]);

  const activeMailboxes = useMemo(() => mailboxes.filter((m) => m.active), [mailboxes]);

  const markRead = useCallback(async (t: Thread) => {
    setBusyMsgId(t.id);
    try {
      await fetch('/api/sales/mails/mark-read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mailbox_id: t.mailbox_id, message_id: t.id }),
      });
      setThreads((prev) => prev.map((x) => (x.id === t.id ? { ...x, unread: false } : x)));
    } finally { setBusyMsgId(null); }
  }, []);

  const toggleStar = useCallback(async (t: Thread) => {
    setBusyMsgId(t.id);
    try {
      await fetch('/api/sales/mails/star', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mailbox_id: t.mailbox_id, message_id: t.id, action: t.starred ? 'unstar' : 'star' }),
      });
      setThreads((prev) => prev.map((x) => (x.id === t.id ? { ...x, starred: !x.starred } : x)));
    } finally { setBusyMsgId(null); }
  }, []);

  return (
    <div style={S.wrap}>
      <div style={S.headerRow}>
        <div style={S.headerTitle}>Shared inboxes · unified</div>
        {connectHref && (
          <a href={connectHref} style={S.connectLink}>+ Connect another mailbox</a>
        )}
      </div>

      <div style={S.filterBar}>
        <div style={S.pillRow}>
          <PillButton
            label={'All (' + activeMailboxes.length + ')'}
            active={selectedMailbox === 'all'}
            color={T.FOREST}
            onClick={() => setSelectedMailbox('all')}
          />
          {activeMailboxes.map((m) => (
            <PillButton
              key={m.id}
              label={m.label}
              active={selectedMailbox === m.id}
              color={m.badge_color || T.FOREST}
              onClick={() => setSelectedMailbox(m.id)}
            />
          ))}
        </div>

        <div style={S.rightCluster}>
          <label style={S.unreadToggleLbl}>
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              style={{ margin: 0 }}
            />
            <span style={{ ...S.unreadToggleTxt, color: unreadOnly ? T.WHITE : T.INK_S, background: unreadOnly ? T.FOREST : T.CREAM }}>
              Unread only
            </span>
          </label>
          <input
            type="search"
            placeholder="Search subject, from, body…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={S.searchInput}
          />
          <button
            type="button"
            onClick={() => void load()}
            style={S.refreshBtn}
            aria-label="Refresh inbox"
            disabled={refreshing}
          >
            <span style={{ display: 'inline-block', transform: refreshing ? 'rotate(360deg)' : 'none', transition: 'transform 800ms linear' }}>↻</span>
            &nbsp;Refresh
          </button>
        </div>
      </div>

      <div style={S.tableWrap} role="table" aria-label="Unified mailbox inbox">
        <div style={S.tableHead} role="row">
          <div style={{ ...S.th, width: 100 }}>Mailbox</div>
          <div style={{ ...S.th, width: 220 }}>From</div>
          <div style={{ ...S.th, flex: 1 }}>Subject</div>
          <div style={{ ...S.th, width: 100, textAlign: 'right' }}>Time</div>
          <div style={{ ...S.th, width: 200, textAlign: 'right' }}>Actions</div>
        </div>

        {threads.length === 0 ? (
          <div style={S.emptyState}>
            {refreshing ? 'Loading…' : 'No messages match.'}
          </div>
        ) : threads.map((t) => (
          <MailRow
            key={t.mailbox_id + ':' + t.id}
            t={t}
            busy={busyMsgId === t.id}
            onMarkRead={() => void markRead(t)}
            onToggleStar={() => void toggleStar(t)}
          />
        ))}

        {threads.length >= limit && (
          <div style={S.loadMoreWrap}>
            <button
              type="button"
              style={S.loadMoreBtn}
              onClick={() => setLimit((n) => n + 50)}
              disabled={refreshing}
            >
              Load 50 more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PillButton(props: { label: string; active: boolean; color: string; onClick: () => void }) {
  const { label, active, color, onClick } = props;
  const bg = active ? color : T.CREAM;
  const fg = active ? T.WHITE : T.INK_S;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: '1px solid ' + T.HAIR,
        background: bg,
        color: fg,
        borderRadius: 16,
        padding: '5px 12px',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '.01em',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function MailRow(props: { t: Thread; busy: boolean; onMarkRead: () => void; onToggleStar: () => void }) {
  const { t, busy, onMarkRead, onToggleStar } = props;
  const [hover, setHover] = useState(false);
  const parsed = parseFrom(t.from);
  const displayName = parsed.name || parsed.email.split('@')[0];
  const domain = parsed.email.includes('@') ? '@' + parsed.email.split('@')[1] : '';
  const rowBg = hover ? T.CREAM : T.WHITE;
  const unreadBorder = t.unread ? '3px solid ' + T.FOREST : '3px solid transparent';

  return (
    <div
      role="row"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: 56,
        padding: '8px 12px 8px 9px',
        borderBottom: '1px solid ' + T.HAIR,
        borderLeft: unreadBorder,
        background: rowBg,
        opacity: busy ? 0.55 : 1,
      }}
    >
      <div style={{ width: 100 }}>
        <span
          style={{
            display: 'inline-block',
            background: t.badge_color || T.FOREST,
            color: T.WHITE,
            padding: '3px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.02em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            maxWidth: 90,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={t.mailbox_address}
        >
          {t.label}
        </span>
      </div>

      <div style={{ width: 220, paddingRight: 12 }}>
        <div style={{ fontSize: 13, color: T.INK, fontWeight: t.unread ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {displayName}
        </div>
        {domain && <div style={{ fontSize: 11, color: T.INK_M, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{domain}</div>}
      </div>

      <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
        <div style={{ fontSize: 13, color: T.INK, fontWeight: t.unread ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {t.subject || '(no subject)'}
        </div>
        <div style={{ fontSize: 11, color: T.INK_M, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {t.snippet}
        </div>
      </div>

      <div style={{ width: 100, textAlign: 'right', fontSize: 12, color: T.INK_M }}>{relTime(t.dateMs)}</div>

      <div style={{ width: 200, textAlign: 'right', display: 'flex', gap: 4, justifyContent: 'flex-end', visibility: hover ? 'visible' : 'hidden' }}>
        <IconAction title="Open in Gmail" href={gmailDeepLink(t.threadId)}>↗</IconAction>
        {t.unread && <IconAction title="Mark read" onClick={onMarkRead}>✓</IconAction>}
        <IconAction title="Reply in Gmail" href={gmailDeepLink(t.threadId)}>✎</IconAction>
        <IconAction title={t.starred ? 'Unstar' : 'Star'} onClick={onToggleStar}>
          <span style={{ color: t.starred ? T.AMBER : T.INK_S }}>★</span>
        </IconAction>
      </div>
    </div>
  );
}

function IconAction(props: { title: string; onClick?: () => void; href?: string; children: React.ReactNode }) {
  const { title, onClick, href, children } = props;
  const common: React.CSSProperties = {
    background: T.WHITE,
    border: '1px solid ' + T.HAIR,
    color: T.INK_S,
    borderRadius: 4,
    padding: '3px 8px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    lineHeight: 1,
  };
  if (href) return <a href={href} target="_blank" rel="noreferrer" title={title} style={common}>{children}</a>;
  return <button type="button" title={title} onClick={onClick} style={common}>{children}</button>;
}

const S: Record<string, React.CSSProperties> = {
  wrap: {
    gridColumn: '1 / -1',
    background: T.WHITE,
    border: '1px solid ' + T.HAIR,
    borderRadius: 8,
    padding: 0,
    overflow: 'hidden',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid ' + T.HAIR,
    background: T.WHITE,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: T.INK,
    letterSpacing: '.01em',
  },
  connectLink: {
    fontSize: 12,
    color: T.FOREST,
    textDecoration: 'none',
    fontWeight: 600,
  },
  filterBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    borderBottom: '1px solid ' + T.HAIR,
    background: T.WHITE,
    flexWrap: 'wrap',
  },
  pillRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  rightCluster: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  unreadToggleLbl: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  unreadToggleTxt: {
    fontSize: 12,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 4,
    border: '1px solid ' + T.HAIR,
  },
  searchInput: {
    width: 400,
    maxWidth: '100%',
    height: 30,
    padding: '0 10px',
    border: '1px solid ' + T.HAIR,
    borderRadius: 6,
    fontSize: 12,
    color: T.INK,
    background: T.WHITE,
    outline: 'none',
  },
  refreshBtn: {
    background: T.WHITE,
    color: T.INK_S,
    border: '1px solid ' + T.HAIR,
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  tableWrap: {
    background: T.WHITE,
  },
  tableHead: {
    display: 'flex',
    alignItems: 'center',
    background: T.WHITE,
    borderBottom: '1px solid ' + T.HAIR,
    padding: '8px 12px 8px 9px',
    borderLeft: '3px solid transparent',
  },
  th: {
    fontSize: 10,
    color: T.INK_M,
    fontWeight: 700,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
  },
  emptyState: {
    padding: '24px 16px',
    fontSize: 13,
    color: T.INK_M,
    textAlign: 'center',
    background: T.WHITE,
  },
  loadMoreWrap: {
    padding: '10px 16px',
    background: T.WHITE,
    borderTop: '1px solid ' + T.HAIR,
    display: 'flex',
    justifyContent: 'center',
  },
  loadMoreBtn: {
    background: T.WHITE,
    color: T.FOREST,
    border: '1px solid ' + T.HAIR,
    borderRadius: 6,
    padding: '6px 16px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
