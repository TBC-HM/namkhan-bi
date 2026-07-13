// app/(cockpit)/_design/UnifiedMailInbox.tsx
// Sales · Mails — unified inbox across shared Gmail aliases (filter mode).
// Full-width primitive (gridColumn: 1/-1). Design tokens per PBS 2026-07-13.
//
// PBS 2026-07-13 · v2 pivot to filter mode.
// PBS 2026-07-14 · v3 mail-to-lead UX:
//   - New optional props: enableMultiSelect, renderRowActions, linkedLeads,
//     dismissedThreadIds, bulk callbacks.
//   - Backward-compatible: existing callers (like /inbox) that omit the new
//     props see zero visual change.
//   - Multi-select adds a leading checkbox column + sticky bulk-action bar.
//   - renderRowActions renders per-row inline actions (e.g. Convert chip)
//     BEFORE the existing hover-only icon actions cluster.
//   - linkedLeads / dismissedThreadIds drive the Lead #N and Dismissed chips
//     rendered inside the built-in inline action slot.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import ComposeModal, { type ComposePrefill } from '@/app/_components/ComposeModal';

const T = {
  WHITE:  '#FFFFFF',
  HAIR:   '#E6DFCC',
  INK:    '#1B1B1B',
  INK_M:  '#5A5A5A',
  INK_S:  '#3A3A3A',
  FOREST: '#084838',
  CREAM:  '#F5F0E1',
  CHIP:   '#F5F0E0',
  MUTED:  '#8B7355',
  RED:    '#B03826',
  AMBER:  '#B48A3A',
};

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
  // v3 optional props (mail-to-lead UX)
  renderRowActions?: (thread: Thread) => ReactNode;
  linkedLeads?: Record<string, number>;
  dismissedThreadIds?: string[] | Set<string>;
  enableMultiSelect?: boolean;
  bulkActionLabel?: string;
  bulkSecondaryLabel?: string;
  onBulkPrimary?: (threads: Thread[]) => Promise<void> | void;
  onBulkSecondary?: (threads: Thread[]) => Promise<void> | void;
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
  const {
    mailboxes: initialMailboxes,
    initialThreads,
    defaultMailboxId,
    renderRowActions,
    linkedLeads,
    dismissedThreadIds,
    enableMultiSelect,
    bulkActionLabel,
    bulkSecondaryLabel,
    onBulkPrimary,
    onBulkSecondary,
  } = props;

  const [mailboxes, setMailboxes] = useState<MailboxSummary[]>(initialMailboxes);
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [selectedMailbox, setSelectedMailbox] = useState<string>(defaultMailboxId ?? 'all');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [committedSearch, setCommittedSearch] = useState<string>('');
  const [limit, setLimit] = useState<number>(50);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [busyMsgId, setBusyMsgId] = useState<string | null>(null);
  const [showManage, setShowManage] = useState(false);
  const [composeFor, setComposeFor] = useState<{ prefill: ComposePrefill; mailboxId: string; mailboxLabel: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<'primary'|'secondary'|null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissedSet = useMemo<Set<string>>(() => {
    if (!dismissedThreadIds) return new Set();
    if (dismissedThreadIds instanceof Set) return dismissedThreadIds;
    return new Set(dismissedThreadIds);
  }, [dismissedThreadIds]);

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

  // Clear stale selections when the visible thread list changes.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(threads.map((t) => t.id));
      const next = new Set<string>();
      prev.forEach((id) => { if (visible.has(id)) next.add(id); });
      return next.size === prev.size ? prev : next;
    });
  }, [threads]);

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

  const openReply = useCallback((t: Thread) => {
    const parsed = parseFrom(t.from);
    const subject = /^re[: ]/i.test(t.subject) ? t.subject : ('Re: ' + (t.subject || ''));
    setComposeFor({
      prefill: {
        to: parsed.email || t.from,
        subject,
        thread_id: t.threadId,
        in_reply_to: t.id,
        quoted_from: t.from,
        quoted_date: t.date,
        quoted_snippet: t.snippet,
      },
      mailboxId: t.mailbox_id,
      mailboxLabel: t.label,
    });
  }, []);

  const refreshMailboxes = useCallback(async () => {
    location.reload();
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectedThreads = useMemo(() => threads.filter((t) => selectedIds.has(t.id)), [threads, selectedIds]);
  const allVisibleSelected = threads.length > 0 && threads.every((t) => selectedIds.has(t.id));
  const someVisibleSelected = threads.some((t) => selectedIds.has(t.id));

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        threads.forEach((t) => next.delete(t.id));
        return next;
      }
      const next = new Set(prev);
      threads.forEach((t) => next.add(t.id));
      return next;
    });
  }, [threads, allVisibleSelected]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const runBulkPrimary = useCallback(async () => {
    if (!onBulkPrimary || selectedThreads.length === 0) return;
    setBulkBusy('primary');
    try {
      await onBulkPrimary(selectedThreads);
      clearSelection();
    } finally { setBulkBusy(null); }
  }, [onBulkPrimary, selectedThreads, clearSelection]);

  const runBulkSecondary = useCallback(async () => {
    if (!onBulkSecondary || selectedThreads.length === 0) return;
    setBulkBusy('secondary');
    try {
      await onBulkSecondary(selectedThreads);
      clearSelection();
    } finally { setBulkBusy(null); }
  }, [onBulkSecondary, selectedThreads, clearSelection]);

  const showCheckboxes = !!enableMultiSelect;
  const showBulkBar = showCheckboxes && selectedIds.size > 0;
  const nSel = selectedIds.size;
  const primaryLabel = (bulkActionLabel ?? 'Convert to Leads') + ' (' + nSel + ')';
  const secondaryLabel = (bulkSecondaryLabel ?? 'Dismiss') + ' (' + nSel + ')';

  return (
    <div style={S.wrap}>
      <div style={S.headerRow}>
        <div style={S.headerTitle}>Shared inboxes · unified · filter mode</div>
        <button type="button" onClick={() => setShowManage(true)} style={S.manageBtn}>Manage aliases</button>
      </div>

      {showBulkBar && (
        <div style={S.bulkBar} role="region" aria-label="Bulk actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.INK }}>{nSel} selected</span>
            {onBulkPrimary && (
              <button
                type="button"
                onClick={() => void runBulkPrimary()}
                disabled={bulkBusy !== null}
                style={S.bulkPrimaryBtn}
              >{bulkBusy === 'primary' ? 'Working…' : primaryLabel}</button>
            )}
            {onBulkSecondary && (
              <button
                type="button"
                onClick={() => void runBulkSecondary()}
                disabled={bulkBusy !== null}
                style={S.bulkSecondaryBtn}
              >{bulkBusy === 'secondary' ? 'Working…' : secondaryLabel}</button>
            )}
          </div>
          <button
            type="button"
            onClick={clearSelection}
            aria-label="Clear selection"
            style={S.bulkClearBtn}
          >×</button>
        </div>
      )}

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
          {showCheckboxes && (
            <div style={{ width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input
                type="checkbox"
                aria-label="Select all visible"
                checked={allVisibleSelected}
                ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
                onChange={toggleSelectAllVisible}
                style={cbStyle()}
              />
            </div>
          )}
          <div style={{ ...S.th, width: 100 }}>Mailbox</div>
          <div style={{ ...S.th, width: 220 }}>From</div>
          <div style={{ ...S.th, flex: 1 }}>Subject</div>
          <div style={{ ...S.th, width: 100, textAlign: 'right' }}>Time</div>
          <div style={{ ...S.th, width: 240, textAlign: 'right' }}>Actions</div>
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
            showCheckbox={showCheckboxes}
            checked={selectedIds.has(t.id)}
            onToggleCheck={() => toggleSelect(t.id)}
            onMarkRead={() => void markRead(t)}
            onToggleStar={() => void toggleStar(t)}
            onReply={() => openReply(t)}
            linkedLeadId={linkedLeads?.[t.threadId]}
            dismissed={dismissedSet.has(t.threadId)}
            extraActions={renderRowActions ? renderRowActions(t) : null}
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

      {showManage && (
        <ManageAliasesModal
          mailboxes={mailboxes}
          onClose={() => setShowManage(false)}
          onChanged={(next) => setMailboxes(next)}
          onNeedFullReload={() => void refreshMailboxes()}
        />
      )}

      {composeFor && (
        <ComposeModal
          prefill={composeFor.prefill}
          sharedMailboxId={composeFor.mailboxId}
          sharedMailboxLabel={composeFor.mailboxLabel}
          onClose={() => setComposeFor(null)}
          onSent={() => { setComposeFor(null); void load(); }}
        />
      )}
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

function cbStyle(): React.CSSProperties {
  return {
    width: 12,
    height: 12,
    margin: 0,
    accentColor: T.INK,
    cursor: 'pointer',
  };
}

function MailRow(props: {
  t: Thread;
  busy: boolean;
  showCheckbox: boolean;
  checked: boolean;
  onToggleCheck: () => void;
  onMarkRead: () => void;
  onToggleStar: () => void;
  onReply: () => void;
  linkedLeadId?: number;
  dismissed?: boolean;
  extraActions?: ReactNode;
}) {
  const { t, busy, showCheckbox, checked, onToggleCheck, onMarkRead, onToggleStar, onReply, linkedLeadId, dismissed, extraActions } = props;
  const [hover, setHover] = useState(false);
  const parsed = parseFrom(t.from);
  const displayName = parsed.name || parsed.email.split('@')[0];
  const domain = parsed.email.includes('@') ? '@' + parsed.email.split('@')[1] : '';
  const rowBg = checked ? T.CHIP : (hover ? T.CREAM : T.WHITE);
  const unreadBorder = t.unread ? '3px solid ' + T.FOREST : '3px solid transparent';
  const showCheckboxAlways = checked || hover;

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
      {showCheckbox && (
        <div style={{ width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <input
            type="checkbox"
            aria-label="Select thread"
            checked={checked}
            onChange={onToggleCheck}
            style={{ ...cbStyle(), visibility: showCheckboxAlways ? 'visible' : 'hidden' }}
          />
        </div>
      )}
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

      <div style={{ width: 240, textAlign: 'right', display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
        {/* Persistent chips (always visible): lead link, dismissed marker, extraActions */}
        {linkedLeadId ? (
          <a
            href={'/sales/leads?highlight=' + linkedLeadId}
            title={'Open lead #' + linkedLeadId}
            style={leadChipStyle()}
          >→ Lead #{linkedLeadId}</a>
        ) : dismissed ? (
          <span style={dismissedChipStyle()} title="This thread was dismissed">Dismissed</span>
        ) : extraActions ? (
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>{extraActions}</span>
        ) : null}
        {/* Hover-only icon cluster */}
        <span style={{ display: 'inline-flex', gap: 4, visibility: hover ? 'visible' : 'hidden' }}>
          <IconAction title="Open in Gmail" href={gmailDeepLink(t.threadId)}>↗</IconAction>
          {t.unread && <IconAction title="Mark read" onClick={onMarkRead}>✓</IconAction>}
          <IconAction title="Reply from this alias" onClick={onReply}>✎</IconAction>
          <IconAction title={t.starred ? 'Unstar' : 'Star'} onClick={onToggleStar}>
            <span style={{ color: t.starred ? T.AMBER : T.INK_S }}>★</span>
          </IconAction>
        </span>
      </div>
    </div>
  );
}

function leadChipStyle(): React.CSSProperties {
  return {
    background: T.CHIP,
    color: T.MUTED,
    border: '1px solid ' + T.HAIR,
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 11,
    fontWeight: 600,
    textDecoration: 'none',
    fontStyle: 'italic',
    whiteSpace: 'nowrap',
  };
}

function dismissedChipStyle(): React.CSSProperties {
  return {
    background: T.WHITE,
    color: T.MUTED,
    border: '1px solid ' + T.HAIR,
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };
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

function ManageAliasesModal(props: {
  mailboxes: MailboxSummary[];
  onClose: () => void;
  onChanged: (next: MailboxSummary[]) => void;
  onNeedFullReload: () => void;
}) {
  const { mailboxes, onClose, onNeedFullReload } = props;
  const [addr, setAddr] = useState('');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#084838');
  const [sortOrder, setSortOrder] = useState<string>('100');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>('');

  const activeMailboxes = mailboxes.filter((m) => m.active);

  const add = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/sales/mails/add-alias', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mailbox_address: addr.trim().toLowerCase(),
          label: label.trim(),
          badge_color: color.trim(),
          sort_order: Number(sortOrder) || 100,
        }),
      });
      const j = await r.json();
      if (!r.ok || j.error) { setErr(j.detail ?? j.error ?? 'add failed'); return; }
      onNeedFullReload();
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this alias? Its inbox will disappear from the unified view.')) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/sales/mails/disconnect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mailbox_id: id }),
      });
      if (!r.ok) { const j = await r.json(); setErr(j.detail ?? j.error ?? 'remove failed'); return; }
      onNeedFullReload();
    } finally { setBusy(false); }
  };

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 4900,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{ width: 520, background: T.WHITE, borderRadius: 8, border: '1px solid ' + T.HAIR, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid ' + T.HAIR, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.INK }}>Manage shared aliases</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: T.INK_M, cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: T.INK_M, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Active</div>
            {activeMailboxes.length === 0 ? (
              <div style={{ fontSize: 13, color: T.INK_M }}>No active aliases yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activeMailboxes.map((m) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: '1px solid ' + T.HAIR, borderRadius: 6 }}>
                    <span style={{ display: 'inline-block', background: m.badge_color, color: T.WHITE, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{m.label}</span>
                    <span style={{ fontSize: 12, color: T.INK }}>{m.mailbox_address}</span>
                    <button
                      type="button"
                      onClick={() => void remove(m.id)}
                      style={{ marginLeft: 'auto', background: T.WHITE, color: T.RED, border: '1px solid ' + T.HAIR, borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      disabled={busy}
                    >Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 11, color: T.INK_M, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Add alias</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="alias@thenamkhan.com" style={S.modalInput} />
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Booking)" style={S.modalInput} />
              <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#084838" style={S.modalInput} />
              <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="Sort order" style={S.modalInput} />
            </div>
            <div style={{ fontSize: 11, color: T.INK_M, marginTop: 6 }}>
              Only <code>@thenamkhan.com</code> addresses are accepted. Add Send-As for the alias in your Gmail settings to enable replies.
            </div>
            {err && <div style={{ marginTop: 8, padding: '6px 10px', background: T.CREAM, border: '1px solid ' + T.HAIR, borderRadius: 4, color: T.RED, fontSize: 12 }}>{err}</div>}
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => void add()}
                style={{ background: T.FOREST, color: T.WHITE, border: 'none', borderRadius: 4, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                disabled={busy || !addr.trim() || !label.trim()}
              >Add alias</button>
              <button
                type="button"
                onClick={onClose}
                style={{ background: T.WHITE, color: T.INK, border: '1px solid ' + T.HAIR, borderRadius: 4, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}
              >Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
  manageBtn: {
    background: T.WHITE,
    color: T.FOREST,
    border: '1px solid ' + T.HAIR,
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  bulkBar: {
    position: 'sticky',
    top: 0,
    zIndex: 3,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    background: T.WHITE,
    borderBottom: '1px solid ' + T.HAIR,
  },
  bulkPrimaryBtn: {
    background: T.INK,
    color: T.WHITE,
    border: '1px solid ' + T.INK,
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  bulkSecondaryBtn: {
    background: T.WHITE,
    color: T.INK,
    border: '1px solid ' + T.HAIR,
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  bulkClearBtn: {
    background: 'transparent',
    border: 'none',
    color: T.INK_M,
    cursor: 'pointer',
    fontSize: 18,
    lineHeight: 1,
    padding: '2px 6px',
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
  modalInput: {
    height: 32,
    padding: '0 10px',
    border: '1px solid ' + T.HAIR,
    borderRadius: 4,
    fontSize: 12,
    color: T.INK,
    background: T.WHITE,
    outline: 'none',
  },
};
