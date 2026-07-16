'use client';
// app/mail/_client/MailClient.tsx
// Full-screen 3-pane Gmail client. Left rail (labels + auto-folders) · Middle
// thread list · Right message pane. Reuses ComposeModal for new messages;
// inline reply composer inside the message pane. Keyboard shortcuts j/k/e/#/s/r/// /Esc.
// Auto-poll every 60s while tab visible.
//
// PBS 2026-07-14 "professional full-screen mailbox, not the popup".
// PBS 2026-07-15 level-up: auto-folders (§1) · headline stripe (§2) ·
//                  per-thread AI actions (§3) · AI semantic search (§4) ·
//                  forwarded thread expansion (§5).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ComposeModal, { type ComposePrefill } from '@/app/_components/ComposeModal';
import { parseForwardedThread, isForwardedSubject, type ParsedMessage } from '@/lib/mail/parse-forwarded-thread';
// PBS 2026-07-16 · Item 3 — top-right UserMenu overlay for the full-screen /mail page.
import UserMenu from '@/components/nav/UserMenu';
import type { CurrentUser } from '@/lib/currentUser';

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
  RED:        '#B04A2F',
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

interface Props { userId: string; userEmail: string; currentUser?: CurrentUser | null }

// ---- auto-folder definitions -------------------------------------------
// PBS 2026-07-15 §1 — 4 mutually-exclusive smart folders below Forwarded.
type AutoFolder = 'to_me' | 'cloudbeds' | 'lighthouse' | 'answer_expected' | null;

const FOLDER_LABEL: Record<Exclude<AutoFolder, null>, string> = {
  to_me:           'To me only',
  cloudbeds:       'Cloudbeds',
  lighthouse:      'Lighthouse',
  answer_expected: 'Answer expected',
};
const FOLDER_ICON: Record<Exclude<AutoFolder, null>, string> = {
  to_me:           '📥',
  cloudbeds:       '📊',
  lighthouse:      '💡',
  answer_expected: '✋',
};
// PBS 2026-07-15 §5 · Direct = strict inbox. Adds no-reply/list-unsub exclusions.
// The /api/mail/messages route also folds in user-defined routing rules with
// route_to in ('newsletter','spam','hide','cloudbeds','lighthouse') as
// additional -from: exclusions on top of this base query.
const FOLDER_Q: Record<Exclude<AutoFolder, null>, string> = {
  to_me:           'to:me -cc:me -bcc:me -"list-unsubscribe" -from:(no-reply OR noreply OR notifications OR automated OR mailer-daemon OR postmaster) -in:spam -in:trash',
  cloudbeds:       'from:(cloudbeds.com OR no-reply@cloudbeds.com OR notifications@cloudbeds.com)',
  lighthouse:      'from:(lighthouse-hotels.com OR lighthouse.com OR notifications@lighthouse)',
  // PBS 2026-07-15 · BUG · previous query allowed CC'd bulk mail + used
  // `from:(-x -y)` which Gmail treats as "match everything" (the leading
  // dash inside the group is not a valid negation). Result: 0 mails in the
  // folder because everything got wiped by the -"list-unsubscribe" filter
  // combined with a query that returned too broadly.
  // Fix: force `to:me -cc:me -bcc:me` scope so we only surface mails PBS
  // is the primary addressee of, tighten age to 14d, broaden the
  // auto-notification sender exclusion set with proper per-clause -from:
  // negations (Gmail requires each excluded sender to be its own -from:).
  answer_expected: 'to:me -cc:me -bcc:me is:unread newer_than:14d -"list-unsubscribe" -from:(no-reply OR noreply OR notifications OR automated OR mailer-daemon OR postmaster OR cloudbeds.com OR lighthouse-hotels.com OR googlecommunityteam@ OR github@ OR notify@) -in:spam -in:trash',
};

// PBS 2026-07-15 · Forwarded aliases — the 7 shared inboxes that get forwarded
// to a personal Gmail. Adding a rail sub-folder per alias so PBS can drill into
// each queue. See item #3 · regression re-add.
const FORWARDED_ALIASES: string[] = [
  'book@thenamkhan.com',
  'gm@thenamkhan.com',
  'reservations@thenamkhan.com',
  'rom@thenamkhan.com',
  'xl@thenamkhan.com',
  'wm@thenamkhan.com',
  'hr@thenamkhan.com',
];

// PBS 2026-07-15 · Item 2 — Sent-from addresses (from sales.email_messages
// direction=outbound). Sub-folders under Sent scope by from:<alias>.
const SENT_FROM_ALIASES: string[] = [
  'rom@thenamkhan.com',
  'wm@thenamkhan.com',
  'pb@thenamkhan.com',
  'xl@thenamkhan.com',
  'pann@thenamkhan.com',
  'fc@thenamkhan.com',
  'rm@thenamkhan.com',
  'hr@thenamkhan.com',
  'book@thenamkhan.com',
  'purchasing@thenamkhan.com',
  'pbsbase@gmail.com',
];

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

// PBS 2026-07-15 · Item 4 — sender-email extractor for routing rule creation.
function extractSender(raw: string): string {
  return parseFrom(raw).email.toLowerCase();
}

// PBS 2026-07-15 · [↪ Forward] · strip Fwd:/FW: prefixes so we don't build
// "Fwd: Fwd: Fwd:" when forwarding an already-forwarded message.
function stripFwdPrefix(subject: string): string {
  return subject.replace(/^\s*(?:(?:fwd?|fw)\s*:\s*)+/i, '').trim();
}

// PBS 2026-07-15 · [↪ Forward] · build the standard "----- Forwarded message -----"
// block that goes into the composer body. Mirrors Gmail's forward format so
// downstream clients recognise the chain (and our own parseForwardedThread
// picks it up on re-open).
function buildForwardedBody(msg: FullMessage): string {
  const plain = (msg.textBody && msg.textBody.trim())
    ? msg.textBody
    : (msg.htmlBody || '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
  const trimmed = plain.replace(/\n{3,}/g, '\n\n').trim();
  const lines = [
    '---------- Forwarded message ----------',
    'From: ' + (msg.from || 'unknown'),
    'Date: ' + (msg.date || ''),
    'Subject: ' + (msg.subject || ''),
    'To: ' + (msg.to || ''),
  ];
  if (msg.cc) lines.push('Cc: ' + msg.cc);
  lines.push('');
  lines.push(trimmed);
  return lines.join('\n');
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

// Word count for triggering AI search button.
function looksLikeNlPrompt(q: string): boolean {
  const t = q.trim();
  if (!t) return false;
  if (t.endsWith('?')) return true;
  return t.split(/\s+/).length > 5;
}

// ---- root ---------------------------------------------------------------
export default function MailClient({ userId: _userId, userEmail, currentUser }: Props) {
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
  // PBS 2026-07-15 §1 · auto-folder. Defaults to 'to_me' (excludes list mail).
  // PBS 2026-07-17 BUG-1 FIX: default to null so Gmail label clicks aren't
  // silently filtered down to 0 by `to:me -cc:me -bcc:me`. That query hides
  // ~all SPAM / TRASH / SENT / newsletter labels (they aren't addressed to me
  // directly), which was the "Spam (38) → 0" symptom.
  const [activeFolder, setActiveFolder] = useState<AutoFolder>(null);
  // PBS 2026-07-17 BUG-2 FIX · forwardedAlias state (extracted so mutex works).
  const [forwardedAlias, setForwardedAlias] = useState<string | null>(null);
  // PBS 2026-07-15 · Item 2 — Sent sub-folder scope by from:<alias>.
  const [sentAlias, setSentAlias] = useState<string | null>(null);
  // PBS 2026-07-15 · Item 4 — user-defined custom smart folder scope.
  const [customFolder, setCustomFolder] = useState<string | null>(null);
  // PBS 2026-07-15 · Item 4 — routing rules for the current user (drives
  // custom-folder rail rendering + 3-dot menu badge).
  const [routingRules, setRoutingRules] = useState<Array<{ id: number; match_type: string; match_value: string; route_to: string; custom_folder: string | null }>>([]);
  // PBS 2026-07-15 · Item 1 — bulk-mark-read in-flight flag + toast.
  const [bulkReadLoading, setBulkReadLoading] = useState<boolean>(false);
  const [bulkReadToast, setBulkReadToast] = useState<string | null>(null);
  // PBS 2026-07-15 · Item 4+6 — per-row 3-dot open state + sender action toast.
  const [rowMenuFor, setRowMenuFor] = useState<string | null>(null);
  const [senderActionToast, setSenderActionToast] = useState<string | null>(null);
  // PBS 2026-07-17 · saved-important pseudo-folder (Feature 7).
  const [importantOnly, setImportantOnly] = useState<boolean>(false);
  // PBS 2026-07-15 §2 · headline stripe overdue chip.
  const [overdueFilter, setOverdueFilter] = useState<boolean>(false);
  const [showCompose, setShowCompose] = useState<boolean>(false);
  // PBS 2026-07-16: cross-page deep-link compose (e.g. /mail?compose=1&to=x@y&subject=Z).
  // Lets any page (Leads, Contacts, etc.) trigger in-app compose pre-filled — replaces mailto:.
  const [composePrefill, setComposePrefill] = useState<ComposePrefill | undefined>(undefined);
  const searchParams = useSearchParams();
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
  // PBS 2026-07-15 §2 · headline-stripe counts (client-side computed from rows).
  const [stripeCounts, setStripeCounts] = useState<{ unread: number; answer: number; today: number; overdue: number; replyRate7d: number | null }>({ unread: 0, answer: 0, today: 0, overdue: 0, replyRate7d: null });
  // PBS 2026-07-15 §3 · per-thread AI actions.
  const [aiSummary, setAiSummary] = useState<string>('');
  const [aiSummaryLoading, setAiSummaryLoading] = useState<boolean>(false);
  const [aiActionErr, setAiActionErr] = useState<string | null>(null);
  const [aiProposeLoading, setAiProposeLoading] = useState<boolean>(false);
  const [aiPolishLoading, setAiPolishLoading] = useState<boolean>(false);
  // PBS 2026-07-17 · summary refinements / translate / save toolbar (Feature 6).
  const [aiSummaryRefining, setAiSummaryRefining] = useState<string | null>(null);
  const [translateOpen, setTranslateOpen] = useState<boolean>(false);
  const [translating, setTranslating] = useState<string | null>(null);
  const [savedToImportant, setSavedToImportant] = useState<boolean>(false);
  const [savingImportant, setSavingImportant] = useState<boolean>(false);
  // PBS 2026-07-17 Feature 7 · saved-important list.
  const [importantMails, setImportantMails] = useState<Array<{
    id: number; thread_id: string; subject: string | null; from_email: string | null;
    from_name: string | null; summary: string | null; saved_at: string;
  }>>([]);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const infiniteSentinel = useRef<HTMLDivElement | null>(null);

  // ---- Convert-to-Lead / Create-Proposal (PBS 2026-07-15 Item 1) --------
  const [convertingLead, setConvertingLead] = useState<boolean>(false);
  const [creatingProposal, setCreatingProposal] = useState<boolean>(false);
  const [convertToast, setConvertToast] = useState<string | null>(null);
  const [convertToastLink, setConvertToastLink] = useState<string | null>(null);

  // ---- Resizable pane widths (PBS 2026-07-15 Item 3) --------------------
  // 4 draggable borders: rail | thread-list | (message body / composer +
  // summary card horizontal splits inside message pane).
  // Persisted in localStorage under 'mail_layout_v1'.
  interface LayoutV1 {
    railW: number;      // 200-400 · left rail width
    listW: number;      // 300-700 · thread list width
    composerH: number;  // 80-500 · inline reply composer height
    summaryH: number;   // 100-400 · AI summary card height
  }
  const DEFAULT_LAYOUT: LayoutV1 = { railW: 240, listW: 380, composerH: 180, summaryH: 200 };
  const [layout, setLayout] = useState<LayoutV1>(DEFAULT_LAYOUT);
  const dragRef = useRef<{ kind: keyof LayoutV1; startX: number; startY: number; startV: number } | null>(null);

  // Hydrate from localStorage on mount (never during SSR).
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' && window.localStorage.getItem('mail_layout_v1');
      if (raw) {
        const p = JSON.parse(raw) as Partial<LayoutV1>;
        setLayout({
          railW:     Math.min(400, Math.max(200, p.railW     ?? DEFAULT_LAYOUT.railW)),
          listW:     Math.min(700, Math.max(300, p.listW     ?? DEFAULT_LAYOUT.listW)),
          composerH: Math.min(500, Math.max( 80, p.composerH ?? DEFAULT_LAYOUT.composerH)),
          summaryH:  Math.min(400, Math.max(100, p.summaryH  ?? DEFAULT_LAYOUT.summaryH)),
        });
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist layout on change (debounced via microtask — cheap enough).
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem('mail_layout_v1', JSON.stringify(layout));
    } catch { /* ignore quota */ }
  }, [layout]);

  const beginDrag = useCallback((kind: keyof LayoutV1) => (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { kind, startX: e.clientX, startY: e.clientY, startV: layout[kind] };
    const isHorizontal = kind === 'railW' || kind === 'listW';
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      let delta = isHorizontal ? (ev.clientX - d.startX) : (ev.clientY - d.startY);
      // Composer handle sits ABOVE the composer, so dragging DOWN shrinks composer.
      if (d.kind === 'composerH') delta = -delta;
      // Summary handle sits BELOW the summary — dragging DOWN grows summary.
      // (default sign is fine.)
      let next = d.startV + delta;
      if (d.kind === 'railW')     next = Math.min(400, Math.max(200, next));
      if (d.kind === 'listW')     next = Math.min(700, Math.max(300, next));
      if (d.kind === 'composerH') next = Math.min(500, Math.max( 80, next));
      if (d.kind === 'summaryH')  next = Math.min(400, Math.max(100, next));
      setLayout((prev) => ({ ...prev, [d.kind]: Math.round(next) }));
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [layout]);

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

  // ---- load routing rules (drives custom-folder rail + finalQ) ----------
  // PBS 2026-07-15 · Item 4+7.
  const loadRoutingRules = useCallback(async () => {
    try {
      const r = await fetch('/api/mail/routing-rules', { cache: 'no-store' });
      const j = await r.json() as { ok: boolean; rules?: Array<{ id: number; match_type: string; match_value: string; route_to: string; custom_folder: string | null }> };
      if (j.ok && j.rules) setRoutingRules(j.rules);
    } catch { /* silent */ }
  }, []);
  useEffect(() => { void loadRoutingRules(); }, [loadRoutingRules]);

  // ---- bulk mark-read (Forwarded rail button) ---------------------------
  // PBS 2026-07-15 · Item 1. Uses the active forwardedAlias if one is picked;
  // otherwise runs across every forwarded queue.
  const bulkMarkForwardedRead = useCallback(async () => {
    setBulkReadLoading(true);
    setBulkReadToast(null);
    try {
      const to = forwardedAlias
        ? 'to:' + forwardedAlias
        : '(to:' + FORWARDED_ALIASES.join(' OR to:') + ')';
      const q = '(subject:Fwd OR subject:FW) is:unread ' + to;
      const r = await fetch('/api/mail/bulk-mark-read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const j = await r.json() as { ok: boolean; count?: number; error?: string };
      if (j.ok) setBulkReadToast('Marked ' + (j.count ?? 0) + ' forwarded mail(s) as read.');
      else setBulkReadToast('Failed: ' + (j.error || 'unknown'));
      void loadList();
    } catch (e) {
      setBulkReadToast('Failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBulkReadLoading(false);
      setTimeout(() => setBulkReadToast(null), 4000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forwardedAlias]);

  // ---- sender-action helpers (3-dot menu · Items 4 + 6) -----------------
  const routeSender = useCallback(async (senderEmail: string, route: 'newsletter' | 'spam' | 'cloudbeds' | 'lighthouse' | 'hide' | 'custom', customFolderName?: string) => {
    if (!senderEmail) return;
    try {
      const r = await fetch('/api/mail/routing-rules', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ match_type: 'from_email', match_value: senderEmail, route_to: route, custom_folder: customFolderName || null }),
      });
      const j = await r.json() as { ok: boolean; error?: string };
      if (j.ok) {
        setSenderActionToast('Routing ' + senderEmail + ' → ' + (route === 'custom' ? customFolderName : route));
        void loadRoutingRules();
        // Optimistically hide the row locally.
        setRows((prev) => prev.filter((row) => !row.from.toLowerCase().includes(senderEmail.toLowerCase())));
      } else setSenderActionToast('Failed: ' + (j.error || 'unknown'));
    } catch (e) {
      setSenderActionToast('Failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setTimeout(() => setSenderActionToast(null), 3500);
    }
  }, [loadRoutingRules]);

  const unsubscribeSender = useCallback(async (messageId: string, senderEmail: string) => {
    try {
      const r = await fetch('/api/mail/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messageId, sender: senderEmail }),
      });
      const j = await r.json() as { ok: boolean; method?: string; had_header?: boolean; warn?: string | null };
      if (j.ok) setSenderActionToast('Unsubscribed (' + (j.method || (j.had_header ? 'header' : 'no header')) + ') · routing rule added.');
      else setSenderActionToast('Unsubscribe issue: ' + (j.warn || 'unknown'));
      void loadRoutingRules();
    } catch (e) {
      setSenderActionToast('Failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setTimeout(() => setSenderActionToast(null), 4500);
    }
  }, [loadRoutingRules]);

  const markSpamAndBlock = useCallback(async (messageId: string, senderEmail: string) => {
    try {
      // 1. Move to SPAM via Gmail modify-labels (INBOX out, SPAM in).
      await fetch('/api/mail/modify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messageId, add: ['SPAM'], remove: ['INBOX', 'UNREAD'] }),
      }).catch(() => null);
      // 2. Add routing rule route_to=spam so future mail is filtered from Direct.
      await routeSender(senderEmail, 'spam');
      // 3. Best-effort unsubscribe (many spam senders honour List-Unsubscribe).
      await unsubscribeSender(messageId, senderEmail);
      setSenderActionToast('Spam · unsubscribed · sender blocked.');
      setTimeout(() => setSenderActionToast(null), 4500);
    } catch (e) {
      setSenderActionToast('Failed: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [routeSender, unsubscribeSender]);

  const createCustomFolderFromSender = useCallback(async (senderEmail: string) => {
    const name = prompt('Name the new smart folder (e.g. "OTAs", "Partners"):');
    if (!name || !name.trim()) return;
    await routeSender(senderEmail, 'custom', name.trim());
  }, [routeSender]);

  // PBS 2026-07-15 · Convert current thread to a Lead. Anthropic extracts
  // structured info from the first message; fn_lead_upsert lands the row.
  const convertThreadToLead = useCallback(async () => {
    if (!selectedId) return;
    if (!confirm('Convert this thread to a Lead? Guest info will be extracted from the message.')) return;
    setConvertingLead(true);
    setConvertToast(null);
    setConvertToastLink(null);
    try {
      const r = await fetch('/api/mail/convert-to-lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ thread_id: selectedId }),
      });
      const j = await r.json() as { ok: boolean; lead_id?: number; error?: string; detail?: string };
      if (j.ok && j.lead_id) {
        setConvertToast('Lead #' + j.lead_id + ' created');
        setConvertToastLink('/sales/leads');
      } else {
        setConvertToast('Failed: ' + (j.error || 'unknown') + (j.detail ? ' · ' + j.detail : ''));
      }
    } catch (e) {
      setConvertToast('Failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setConvertingLead(false);
      setTimeout(() => { setConvertToast(null); setConvertToastLink(null); }, 6000);
    }
  }, [selectedId]);

  // PBS 2026-07-15 · Create Lead + draft Proposal from current thread → wizard.
  const createProposalFromThread = useCallback(async () => {
    if (!selectedId) return;
    if (!confirm('Create a Lead + draft Proposal from this thread? Guest info will be extracted from the message.')) return;
    setCreatingProposal(true);
    setConvertToast(null);
    setConvertToastLink(null);
    try {
      const r = await fetch('/api/mail/create-proposal-from-mail', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ thread_id: selectedId }),
      });
      const j = await r.json() as { ok: boolean; lead_id?: number; proposal_id?: string; error?: string; detail?: string };
      if (j.ok && j.proposal_id) {
        setConvertToast('Proposal created · opening composer…');
        // Redirect to the wizard.
        if (typeof window !== 'undefined') window.location.href = '/sales/proposals/' + j.proposal_id + '/edit';
      } else {
        setConvertToast('Failed: ' + (j.error || 'unknown') + (j.detail ? ' · ' + j.detail : ''));
        setCreatingProposal(false);
        setTimeout(() => setConvertToast(null), 6000);
      }
    } catch (e) {
      setConvertToast('Failed: ' + (e instanceof Error ? e.message : String(e)));
      setCreatingProposal(false);
      setTimeout(() => setConvertToast(null), 6000);
    }
  }, [selectedId]);

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

  // ---- BUG 2 · mutual-exclusion helpers (PBS 2026-07-17) --------------
  // Clicking any Gmail label / smart-folder / alias must clear the OTHER
  // scope states so the new selection is a clean slate (chips stack; scope
  // slots don't). "All mail reset" nukes everything and returns to INBOX.
  const clearScopeStates = useCallback(() => {
    setActiveFolder(null);
    setNewslettersOnly(false);
    setForwardedAlias(null);
    setSentAlias(null);
    setCustomFolder(null);
    setImportantOnly(false);
  }, []);

  const pickSystemLabel = useCallback((id: string) => {
    clearScopeStates();
    setCurrentLabel(id);
  }, [clearScopeStates]);

  const pickUserLabel = useCallback((id: string) => {
    clearScopeStates();
    setCurrentLabel(id);
  }, [clearScopeStates]);

  const pickFolder = useCallback((f: Exclude<AutoFolder, null>) => {
    setImportantOnly(false);
    setNewslettersOnly(false);
    setForwardedAlias(null);
    setCurrentLabel('INBOX');
    setActiveFolder((prev) => (prev === f ? null : f));
  }, []);

  const pickNewsletters = useCallback(() => {
    setImportantOnly(false);
    setActiveFolder(null);
    setForwardedAlias(null);
    setCurrentLabel('INBOX');
    setNewslettersOnly((v) => !v);
  }, []);

  const pickForwardedAlias = useCallback((alias: string) => {
    setImportantOnly(false);
    setActiveFolder(null);
    setNewslettersOnly(false);
    setSentAlias(null);
    setCustomFolder(null);
    setCurrentLabel('INBOX');
    setForwardedAlias((prev) => (prev === alias ? null : alias));
  }, []);

  // PBS 2026-07-15 · Item 2 — Sent sub-folder scope helper (clears others).
  const pickSentAlias = useCallback((alias: string) => {
    setImportantOnly(false);
    setActiveFolder(null);
    setNewslettersOnly(false);
    setForwardedAlias(null);
    setCustomFolder(null);
    setCurrentLabel('SENT');
    setSentAlias((prev) => (prev === alias ? null : alias));
  }, []);

  // PBS 2026-07-15 · Item 4 — custom folder scope helper.
  const pickCustomFolder = useCallback((name: string) => {
    setImportantOnly(false);
    setActiveFolder(null);
    setNewslettersOnly(false);
    setForwardedAlias(null);
    setSentAlias(null);
    setCurrentLabel('INBOX');
    setCustomFolder((prev) => (prev === name ? null : name));
  }, []);

  const pickImportant = useCallback(() => {
    setActiveFolder(null);
    setNewslettersOnly(false);
    setForwardedAlias(null);
    setImportantOnly(true);
    setCurrentLabel('INBOX');
  }, []);

  const resetAllMail = useCallback(() => {
    clearScopeStates();
    setSentAlias(null);
    setCustomFolder(null);
    setCurrentLabel('INBOX');
    setUnreadFilter(false);
    setStarredFilter(false);
    setDirectFilter(false);
    setTodayFilter(false);
    setWeekFilter(false);
    setAttachFilter(false);
    setOverdueFilter(false);
    setQuery('');
    setCommittedQuery('');
  }, [clearScopeStates]);

  // ---- computed final query (label filters + folder + chips -> Gmail) ---
  // Uses Gmail's native search operators so filtering happens server-side.
  //   activeFolder: injects the folder operator (mutually exclusive with the
  //                 other 3 folders, stacks with the chips + Gmail label).
  //   direct: excludes CC/BCC — Gmail supports  `to:me -cc:me -bcc:me`
  //   today / week: `newer_than:1d` / `newer_than:7d`
  //   attach: `has:attachment`
  //   newslettersOnly: rely on the "unsubscribe" text OR List-Unsubscribe
  //     header — Gmail exposes `list:` operator for List-Id.
  const finalQ = useMemo(() => {
    const parts: string[] = [];
    if (committedQuery) parts.push(committedQuery);
    if (activeFolder) parts.push(FOLDER_Q[activeFolder]);
    if (forwardedAlias) parts.push('to:' + forwardedAlias);
    // PBS 2026-07-15 · Item 2 — Sent sub-folder scope (server-side).
    if (sentAlias) parts.push('from:' + sentAlias);
    // PBS 2026-07-15 · Item 4 — custom folder scope (folds all matching rules
    // for this folder name into a single Gmail OR-list of from: operators).
    if (customFolder) {
      const froms = routingRules
        .filter((r) => r.route_to === 'custom' && (r.custom_folder || '').toLowerCase() === customFolder.toLowerCase() && (r.match_type === 'from_email' || r.match_type === 'from_domain'))
        .map((r) => r.match_value);
      if (froms.length) parts.push('from:(' + froms.join(' OR ') + ')');
    }
    if (unreadFilter) parts.push('is:unread');
    if (starredFilter) parts.push('is:starred');
    if (directFilter)  parts.push('to:me -cc:me -bcc:me');
    if (todayFilter)   parts.push('newer_than:1d');
    if (weekFilter)    parts.push('newer_than:7d');
    if (attachFilter)  parts.push('has:attachment');
    if (overdueFilter) parts.push('is:unread older_than:2d newer_than:14d');
    if (newslettersOnly) {
      // PBS 2026-07-15 · Item 2 BUG-FIX — "Move sender to Newsletters" didn't
      // surface the sender inside the Newsletters view. The 3-dot menu wrote a
      // routing_rule route_to='newsletter' but the folder used only Gmail's
      // generic (unsubscribe OR "List-Unsubscribe") heuristic, ignoring the
      // user's manual pins. Mirror the customFolder pattern: OR-in every
      // manually routed sender so pinned rows appear alongside the heuristic.
      const newsletterSenders = routingRules
        .filter((r) => r.route_to === 'newsletter' && (r.match_type === 'from_email' || r.match_type === 'from_domain'))
        .map((r) => r.match_value)
        .filter(Boolean);
      if (newsletterSenders.length) {
        parts.push('((unsubscribe OR "List-Unsubscribe") OR from:(' + newsletterSenders.join(' OR ') + '))');
      } else {
        parts.push('(unsubscribe OR "List-Unsubscribe")');
      }
    }
    return parts.join(' ');
  }, [committedQuery, activeFolder, forwardedAlias, sentAlias, customFolder, routingRules, unreadFilter, starredFilter, directFilter, todayFilter, weekFilter, attachFilter, overdueFilter, newslettersOnly]);

  // ---- load current label list -----------------------------------------
  // PBS 2026-07-17 Feature 7 · when importantOnly is on, we bypass Gmail and
  // pull from /api/mail/save-important (backed by public.v_important_mails).
  const loadList = useCallback(async (append?: string) => {
    setLoadingList(true);
    setLastError(null);
    try {
      if (importantOnly) {
        const r = await fetch('/api/mail/save-important', { cache: 'no-store' });
        const j = await r.json() as { ok: boolean; mails?: Array<{
          id: number; thread_id: string; message_id: string | null; subject: string | null;
          from_email: string | null; from_name: string | null; summary: string | null;
          saved_at: string;
        }> };
        if (!j.ok || !j.mails) {
          setLastError('important_load_failed');
          setRows([]); setNextPageToken(null);
          return;
        }
        setImportantMails(j.mails.map((m) => ({
          id: m.id, thread_id: m.thread_id, subject: m.subject,
          from_email: m.from_email, from_name: m.from_name,
          summary: m.summary, saved_at: m.saved_at,
        })));
        // Adapt to ListRow shape for the middle pane.
        const nowMs = Date.now();
        setRows(j.mails.map((m) => ({
          id: m.message_id || m.thread_id,
          threadId: m.thread_id,
          subject: m.subject || '(no subject)',
          from: (m.from_name ? m.from_name + ' ' : '') + '<' + (m.from_email || 'unknown') + '>',
          to: '',
          date: m.saved_at,
          dateMs: Date.parse(m.saved_at) || nowMs,
          snippet: (m.summary || '').slice(0, 200),
          unread: false, starred: true, hasAttachment: false,
          labelIds: ['STARRED'],
        })));
        setNextPageToken(null);
        return;
      }
      const params = new URLSearchParams();
      params.set('label', currentLabel);
      if (finalQ) params.set('q', finalQ);
      if (append) params.set('pageToken', append);
      params.set('max', '50');
      // PBS 2026-07-15 · Item 5 — pass the active folder so /api/mail/messages
      // can fold in the user's routing-rule exclusions when Direct is active.
      if (activeFolder) params.set('folder', activeFolder);
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
  }, [currentLabel, finalQ, importantOnly, activeFolder]);

  useEffect(() => {
    setRows([]);
    setSelectedId(null);
    setThreadMessages([]);
    void loadList();
  }, [loadList]);

  // ---- headline stripe counts -------------------------------------------
  // Client-side compute from current rows. `replyRate7d` is a best-effort
  // — real sent/received split would need /api/mail/messages?label=SENT,
  // so we call both once when the pane opens.
  useEffect(() => {
    const now = Date.now();
    const dayMs = 86400_000;
    const unread = rows.filter((r) => r.unread).length;
    const today = rows.filter((r) => now - r.dateMs < dayMs).length;
    const overdue = rows.filter((r) => r.unread && (now - r.dateMs) > 2 * dayMs && (now - r.dateMs) < 14 * dayMs).length;
    const answer = rows.filter((r) => {
      if (!r.unread) return false;
      const from = (r.from || '').toLowerCase();
      if (/cloudbeds\.com|lighthouse-hotels\.com|noreply|no-reply/.test(from)) return false;
      if (now - r.dateMs > 30 * dayMs) return false;
      return true;
    }).length;
    setStripeCounts((prev) => ({ unread, answer, today, overdue, replyRate7d: prev.replyRate7d }));
  }, [rows]);

  // ---- reply-rate 7d (sent/received) — fetch once on mount --------------
  useEffect(() => {
    (async () => {
      try {
        const q = encodeURIComponent('newer_than:7d');
        const [rIn, rOut] = await Promise.all([
          fetch('/api/mail/messages?label=INBOX&q=' + q + '&max=100', { cache: 'no-store' }).then((r) => r.json()) as Promise<Api<{ messages: ListRow[] }>>,
          fetch('/api/mail/messages?label=SENT&q=' + q + '&max=100', { cache: 'no-store' }).then((r) => r.json()) as Promise<Api<{ messages: ListRow[] }>>,
        ]);
        const inbound = rIn.ok !== false ? (rIn.data.messages?.length ?? 0) : 0;
        const outbound = rOut.ok !== false ? (rOut.data.messages?.length ?? 0) : 0;
        const rate = inbound > 0 ? Math.round((outbound / inbound) * 100) : null;
        setStripeCounts((prev) => ({ ...prev, replyRate7d: rate }));
      } catch { /* silent */ }
    })();
  }, []);

  // ---- auto-poll (60s, tab-visible) -------------------------------------
  useEffect(() => {
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible') void loadList();
    }, 60_000);
    return () => clearInterval(iv);
  }, [loadList]);

  // ---- PBS 2026-07-16: deep-link compose -------------------------------
  // /mail?compose=1&to=x@y&subject=Z opens the composer pre-filled. Used by
  // Leads ✉ button, contact records, any page that wants in-app compose.
  useEffect(() => {
    if (!searchParams) return;
    if (searchParams.get('compose') !== '1') return;
    const to = searchParams.get('to') ?? '';
    const subject = searchParams.get('subject') ?? '';
    if (!to && !subject) return;
    setComposePrefill({ to: to || undefined, subject: subject || undefined });
    setShowCompose(true);
    // Only fire once per navigation — no reset on refresh needed since query
    // stays set and the user can close the modal to dismiss.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setAiSummary('');
    setAiActionErr(null);
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

  // PBS 2026-07-15 · [↪ Forward] · open ComposeModal pre-filled with the
  // newest message in the thread wrapped in the standard "Forwarded message"
  // block. Recipient is left empty for the sender to pick.
  // NOTE: attachments are NOT re-attached — the Gmail thread route does not
  // currently return attachment payloads; the sender must re-attach manually
  // via the 📎 button. This is called out in the compose modal (message chip).
  const forwardThread = useCallback(() => {
    if (threadMessages.length === 0) return;
    // Prefer the newest message as the forward source (most current context).
    const src = threadMessages[threadMessages.length - 1];
    const fwdSubject = 'Fwd: ' + stripFwdPrefix(src.subject || '(no subject)');
    setComposePrefill({
      to: '',
      subject: fwdSubject,
      forwardedBody: buildForwardedBody(src),
      // thread_id + in_reply_to intentionally omitted — forward starts a NEW
      // thread from Gmail's perspective (different topic + different audience).
    });
    setShowCompose(true);
  }, [threadMessages]);

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

  // ---- AI actions -------------------------------------------------------
  // PBS 2026-07-15 §3 · Anthropic-backed. Uses claude-sonnet-4-6 with the
  // "Vector" warm-professional Namkhan voice.
  const aiSummarize = useCallback(async () => {
    if (threadMessages.length === 0) return;
    const tid = threadMessages[0].threadId;
    setAiSummaryLoading(true);
    setAiActionErr(null);
    try {
      const r = await fetch('/api/mail/ai/summarize', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ thread_id: tid }),
      });
      const j = await r.json() as { ok: boolean; summary?: string; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error || 'summary_failed');
      setAiSummary(j.summary || '');
    } catch (e) {
      setAiActionErr(e instanceof Error ? e.message : 'summary_failed');
    } finally {
      setAiSummaryLoading(false);
    }
  }, [threadMessages]);

  const aiProposeReply = useCallback(async () => {
    if (threadMessages.length === 0) return;
    const tid = threadMessages[0].threadId;
    setAiProposeLoading(true);
    setAiActionErr(null);
    try {
      const r = await fetch('/api/mail/ai/propose-reply', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ thread_id: tid, tone: 'warm-professional' }),
      });
      const j = await r.json() as { ok: boolean; draft?: string; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error || 'propose_failed');
      setReplyBody(j.draft || '');
      setReplyOpen(true);
    } catch (e) {
      setAiActionErr(e instanceof Error ? e.message : 'propose_failed');
    } finally {
      setAiProposeLoading(false);
    }
  }, [threadMessages]);

  // PBS 2026-07-17 Feature 6 · summary refinement chips.
  const aiSummarizeRefine = useCallback(async (refine: 'shorten' | 'actionable' | 'focus_rate' | 'focus_dates') => {
    if (threadMessages.length === 0) return;
    const tid = threadMessages[0].threadId;
    setAiSummaryRefining(refine);
    setAiActionErr(null);
    try {
      const r = await fetch('/api/mail/ai/summarize', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ thread_id: tid, refine_mode: refine }),
      });
      const j = await r.json() as { ok: boolean; summary?: string; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error || 'refine_failed');
      setAiSummary(j.summary || '');
    } catch (e) {
      setAiActionErr(e instanceof Error ? e.message : 'refine_failed');
    } finally {
      setAiSummaryRefining(null);
    }
  }, [threadMessages]);

  // PBS 2026-07-17 Feature 6 · translate summary to target language.
  const aiTranslate = useCallback(async (lang: string) => {
    if (!aiSummary.trim()) return;
    setTranslating(lang);
    setTranslateOpen(false);
    setAiActionErr(null);
    try {
      const r = await fetch('/api/mail/ai/translate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: aiSummary, target_lang: lang }),
      });
      const j = await r.json() as { ok: boolean; translated?: string; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error || 'translate_failed');
      setAiSummary(j.translated || aiSummary);
    } catch (e) {
      setAiActionErr(e instanceof Error ? e.message : 'translate_failed');
    } finally {
      setTranslating(null);
    }
  }, [aiSummary]);

  // PBS 2026-07-17 Feature 6 · save summary + thread to important_mails.
  const saveImportant = useCallback(async () => {
    if (threadMessages.length === 0) return;
    const newest = threadMessages[threadMessages.length - 1];
    setSavingImportant(true);
    setAiActionErr(null);
    try {
      const parsed = parseFrom(newest.from);
      const r = await fetch('/api/mail/save-important', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          thread_id: newest.threadId,
          message_id: newest.id,
          subject:    newest.subject,
          from_email: parsed.email,
          from_name:  parsed.name || null,
          summary:    aiSummary || null,
        }),
      });
      const j = await r.json() as { ok: boolean; id?: number; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error || 'save_failed');
      setSavedToImportant(true);
      setTimeout(() => setSavedToImportant(false), 3000);
    } catch (e) {
      setAiActionErr(e instanceof Error ? e.message : 'save_failed');
    } finally {
      setSavingImportant(false);
    }
  }, [threadMessages, aiSummary]);

  // PBS 2026-07-17 Feature 6 · pre-fill reply composer from summary.
  const proposeFromSummary = useCallback(() => {
    if (!aiSummary.trim() || threadMessages.length === 0) return;
    const draft = 'Based on our thread:\n\n' + aiSummary + '\n\n[Draft your response above — the summary is here to anchor your reply.]';
    setReplyBody(draft);
    setReplyOpen(true);
  }, [aiSummary, threadMessages]);

  const aiPolish = useCallback(async () => {
    if (!replyBody.trim()) return;
    setAiPolishLoading(true);
    setAiActionErr(null);
    try {
      const r = await fetch('/api/mail/ai/polish', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draft: replyBody, tone: 'warm-professional' }),
      });
      const j = await r.json() as { ok: boolean; polished?: string; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error || 'polish_failed');
      setReplyBody(j.polished || replyBody);
    } catch (e) {
      setAiActionErr(e instanceof Error ? e.message : 'polish_failed');
    } finally {
      setAiPolishLoading(false);
    }
  }, [replyBody]);

  const aiSearch = useCallback(async () => {
    const p = query.trim();
    if (!p) return;
    try {
      const r = await fetch('/api/mail/ai/search', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: p }),
      });
      const j = await r.json() as { ok: boolean; query?: string; fallback?: boolean; error?: string };
      if (j.query) {
        setQuery(j.query);
        setCommittedQuery(j.query);
      }
    } catch {
      // Fallback: use raw prompt as normal search — already in `query`.
      setCommittedQuery(p);
    }
  }, [query]);

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
  const forwardedLabels = userLabels.filter((l) => /forward/i.test(l.name));
  const otherUserLabels = userLabels.filter((l) => !newsletterLabels.includes(l) && !forwardedLabels.includes(l));

  const showAiSearchBtn = looksLikeNlPrompt(query);

  return (
    <div style={{ height: '100vh', display: 'grid', gridTemplateColumns: layout.railW + 'px 4px ' + layout.listW + 'px 4px 1fr', color: T.INK, fontFamily: "-apple-system, 'SF Pro Text', system-ui, 'Segoe UI', sans-serif", background: T.WHITE }}>
      {/* PBS 2026-07-16 · Item 3 — top-right UserMenu overlay so the full-screen
          mailbox has the same avatar / Inbox / Settings / Sign-out dropdown as
          every other page. Positioned fixed, above the 3-pane grid. */}
      {currentUser && (
        <div style={{ position: 'fixed', top: 8, right: 12, zIndex: 100 }}>
          <UserMenu user={currentUser} />
        </div>
      )}
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
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mail"
              style={{
                flex: 1, border: '1px solid ' + T.HAIR, borderRadius: 6,
                padding: '7px 10px', fontSize: 12, background: T.WHITE, color: T.INK,
                outline: 'none',
              }}
            />
            {showAiSearchBtn && (
              <button
                type="button"
                onClick={() => void aiSearch()}
                title="Convert prompt to Gmail search via AI"
                style={{
                  background: T.WHITE, color: T.FOREST, border: '1px solid ' + T.FOREST,
                  borderRadius: 6, padding: '0 10px', fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >🔍 Ask AI</button>
            )}
          </div>
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
          {/* PBS 2026-07-17 · All-mail reset. Clears every scope + filter. */}
          <div
            onClick={resetAllMail}
            style={{
              margin: '4px 12px 8px', padding: '6px 10px', borderRadius: 4,
              border: '1px solid ' + T.HAIR, background: T.WHITE,
              fontSize: 11, color: T.INK_S, fontWeight: 600, cursor: 'pointer',
              textAlign: 'center',
            }}
            title="Clear every scope + filter"
          >← All mail (reset)</div>
          {SYSTEM_ORDER.map((s) => {
            const lbl = labels.find((l) => l.id === s.id);
            const unread = lbl?.messagesUnread ?? 0;
            const active = currentLabel === s.id && !importantOnly && !newslettersOnly && !forwardedAlias && !sentAlias && !customFolder && !activeFolder;
            return (
              <div key={s.id}>
                <RailItem
                  label={s.label}
                  unread={unread}
                  active={active}
                  onClick={() => pickSystemLabel(s.id)}
                />
                {/* PBS 2026-07-15 · Item 2 — Sent sub-folders scoped by from:<alias>. */}
                {s.id === 'SENT' && currentLabel === 'SENT' && (
                  <div style={{ paddingLeft: 12 }}>
                    {SENT_FROM_ALIASES.map((alias) => (
                      <RailItem
                        key={alias}
                        label={'· ' + alias.split('@')[0]}
                        unread={0}
                        active={sentAlias === alias}
                        onClick={() => pickSentAlias(alias)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* PBS 2026-07-17 Feature 7 · Important (saved). */}
          <div style={{ padding: '10px 16px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: T.INK_M }}>Saved</div>
          <RailItem
            label="⭐ Important"
            unread={importantMails.length}
            active={importantOnly}
            onClick={pickImportant}
          />

          {/* Newsletters section — user labels whose name contains "newsletter"
              OR the Gmail toggle that filters by List-Unsubscribe header. */}
          <div style={{ padding: '10px 16px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: T.INK_M }}>Newsletters</div>
          <RailItem
            label="All newsletters"
            unread={0}
            active={newslettersOnly && !currentLabel.startsWith('Label_')}
            onClick={pickNewsletters}
          />
          {newsletterLabels.map((l) => (
            <RailItem
              key={l.id}
              label={l.name}
              unread={l.messagesUnread}
              active={currentLabel === l.id && !newslettersOnly && !importantOnly && !forwardedAlias && !activeFolder}
              onClick={() => pickUserLabel(l.id)}
            />
          ))}

          {/* Forwarded section — user labels containing "forward" AND the 7
              alias sub-folders (PBS 2026-07-15 · Item 3 regression re-add). */}
          <div style={{ padding: '10px 16px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: T.INK_M, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Forwarded</span>
            <button
              type="button"
              onClick={() => void bulkMarkForwardedRead()}
              disabled={bulkReadLoading}
              title={forwardedAlias ? 'Mark all Fwd: unread in ' + forwardedAlias : 'Mark ALL forwarded unread as read across the 7 aliases'}
              style={{
                background: T.WHITE, color: T.FOREST,
                border: '1px solid ' + T.HAIR, borderRadius: 4,
                padding: '2px 6px', fontSize: 9.5, fontWeight: 600,
                cursor: bulkReadLoading ? 'wait' : 'pointer', opacity: bulkReadLoading ? 0.6 : 1,
                textTransform: 'none', letterSpacing: 0,
              }}
            >{bulkReadLoading ? '…' : '✓ read'}</button>
          </div>
          {FORWARDED_ALIASES.map((alias) => (
            <RailItem
              key={alias}
              label={'· ' + alias.split('@')[0]}
              unread={0}
              active={forwardedAlias === alias}
              onClick={() => pickForwardedAlias(alias)}
            />
          ))}
          {forwardedLabels.map((l) => (
            <RailItem
              key={l.id}
              label={l.name}
              unread={l.messagesUnread}
              active={currentLabel === l.id && !importantOnly && !forwardedAlias && !sentAlias && !customFolder && !newslettersOnly && !activeFolder}
              onClick={() => pickUserLabel(l.id)}
            />
          ))}

          {/* PBS 2026-07-15 §1 · Auto-folders (mutually exclusive). */}
          <div style={{ padding: '10px 16px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: T.INK_M }}>Smart folders</div>
          {(Object.keys(FOLDER_LABEL) as Array<Exclude<AutoFolder, null>>).map((f) => (
            <RailItem
              key={f}
              label={FOLDER_ICON[f] + ' ' + FOLDER_LABEL[f]}
              unread={0}
              active={activeFolder === f && !importantOnly}
              onClick={() => pickFolder(f)}
            />
          ))}

          {/* PBS 2026-07-15 · Item 4 — Custom smart folders (user routing rules). */}
          {(() => {
            const folders = Array.from(new Set(
              routingRules
                .filter((r) => r.route_to === 'custom' && r.custom_folder)
                .map((r) => r.custom_folder as string)
            )).sort();
            if (folders.length === 0) return null;
            return (
              <>
                <div style={{ padding: '10px 16px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: T.INK_M }}>Custom folders</div>
                {folders.map((name) => (
                  <RailItem
                    key={name}
                    label={'★ ' + name}
                    unread={0}
                    active={customFolder === name}
                    onClick={() => pickCustomFolder(name)}
                  />
                ))}
              </>
            );
          })()}

          {otherUserLabels.length > 0 && (
            <>
              <div style={{ padding: '10px 16px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: T.INK_M }}>Labels</div>
              {otherUserLabels.map((l) => (
                <RailItem
                  key={l.id}
                  label={l.name}
                  unread={l.messagesUnread}
                  active={currentLabel === l.id && !importantOnly && !newslettersOnly && !forwardedAlias && !sentAlias && !customFolder && !activeFolder}
                  onClick={() => pickUserLabel(l.id)}
                />
              ))}
            </>
          )}

          {/* Settings-style link section */}
          <div style={{ padding: '10px 16px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: T.INK_M }}>Settings</div>
          <a href="/mail/automations" style={{ display: 'block', padding: '7px 16px', fontSize: 13, color: T.INK, textDecoration: 'none', borderLeft: '3px solid transparent' }}>Automations</a>
          <a href="/mail/autoresponder" style={{ display: 'block', padding: '7px 16px', fontSize: 13, color: T.INK, textDecoration: 'none', borderLeft: '3px solid transparent' }}>Auto-responder</a>
          {/* PBS 2026-07-16 · Item 5 — Analytics moved out of the mail sidebar into
              the admin-only UserMenu (accessible via the top-right avatar). */}
          {/* PBS 2026-07-15 · Item 7 — routing rules editor. */}
          <a href="/mail/rules" style={{ display: 'block', padding: '7px 16px', fontSize: 13, color: T.INK, textDecoration: 'none', borderLeft: '3px solid transparent' }}>Routing rules</a>
        </nav>

        <div style={{ padding: '10px 14px', borderTop: '1px solid ' + T.HAIR, fontSize: 11, color: T.INK_M, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span title={userEmail} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>{userEmail}</span>
          <button type="button" onClick={() => void loadList()} title="Refresh" style={{ background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 4, padding: '3px 8px', color: T.INK_S, fontSize: 12, cursor: 'pointer' }}>↻</button>
        </div>
      </aside>

      {/* PBS 2026-07-15 · vertical drag handle between rail and thread list. */}
      <ResizeHandle orientation="col" onMouseDown={beginDrag('railW')} />

      {/* MIDDLE THREAD LIST */}
      <section ref={listRef} style={{ borderRight: '1px solid ' + T.HAIR, background: T.WHITE, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 10, borderBottom: '1px solid ' + T.HAIR, position: 'sticky', top: 0, background: T.WHITE, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* PBS 2026-07-15 §2 · Headline stripe. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            <StripeTile label="Unread" value={stripeCounts.unread} onClick={() => setUnreadFilter((v) => !v)} active={unreadFilter} />
            <StripeTile label="Answer" value={stripeCounts.answer} onClick={() => pickFolder('answer_expected')} active={activeFolder === 'answer_expected'} />
            <StripeTile label="Today"  value={stripeCounts.today}  onClick={() => setTodayFilter((v) => !v)} active={todayFilter} />
            <StripeTile label="Overdue" value={stripeCounts.overdue} onClick={() => setOverdueFilter((v) => !v)} active={overdueFilter} />
            <StripeTile label="Reply 7d" value={stripeCounts.replyRate7d == null ? '—' : (stripeCounts.replyRate7d + '%')} onClick={undefined} active={false} />
          </div>
          {pollerDaysAgo != null && pollerDaysAgo > 2 && (
            <div style={{ background: T.CREAM, border: '1px solid ' + T.HAIR, borderRadius: 4, padding: '6px 10px', fontSize: 11, color: T.INK_S }}>
              Gmail sync poller last ran {pollerDaysAgo}d ago — some analytics may lag. Live inbox unaffected.
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.INK, textTransform: 'capitalize' }}>
              {(SYSTEM_ORDER.find((s) => s.id === currentLabel)?.label ?? labels.find((l) => l.id === currentLabel)?.name ?? currentLabel).toLowerCase()}
              {activeFolder && (
                <span style={{ marginLeft: 6, fontSize: 11, color: T.FOREST, fontWeight: 600 }}>· {FOLDER_LABEL[activeFolder]}</span>
              )}
              {finalQ && !activeFolder && (
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
                  menuOpen={rowMenuFor === r.id}
                  onMenuToggle={(e) => { e.stopPropagation(); setRowMenuFor((prev) => prev === r.id ? null : r.id); }}
                  onMenuClose={() => setRowMenuFor(null)}
                  onRouteSender={(route, custom) => { const email = extractSender(r.from); void routeSender(email, route, custom); setRowMenuFor(null); }}
                  onCustomFolderFromSender={() => { const email = extractSender(r.from); void createCustomFolderFromSender(email); setRowMenuFor(null); }}
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

      {/* PBS 2026-07-15 · vertical drag handle between thread list and message pane. */}
      <ResizeHandle orientation="col" onMouseDown={beginDrag('listW')} />

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
              onDelete={() => {
                if (!selectedId) return;
                if (!confirm('Move this thread to Trash in Gmail? This can be undone from Gmail within 30 days.')) return;
                void trashRow(selectedId);
              }}
              /* PBS 2026-07-15 · Item 6 — Unsubscribe + Spam + Route from
                 message pane. Sender is the FROM of the newest (=latest) msg. */
              onUnsubscribe={() => {
                if (!selectedId) return;
                const newest = threadMessages[threadMessages.length - 1] || threadMessages[0];
                const sender = extractSender(newest?.from || '');
                if (!newest?.id) return;
                void unsubscribeSender(newest.id, sender);
              }}
              onSpam={() => {
                if (!selectedId) return;
                const newest = threadMessages[threadMessages.length - 1] || threadMessages[0];
                const sender = extractSender(newest?.from || '');
                if (!newest?.id) return;
                if (!confirm('Move to Spam + block sender + attempt unsubscribe?')) return;
                void markSpamAndBlock(newest.id, sender);
              }}
              onRouteSender={(route) => {
                const newest = threadMessages[threadMessages.length - 1] || threadMessages[0];
                const sender = extractSender(newest?.from || '');
                if (route === 'custom') {
                  void createCustomFolderFromSender(sender);
                } else {
                  void routeSender(sender, route);
                }
              }}
              /* PBS 2026-07-15 · one-click Convert-to-Lead + Draft-Proposal. */
              onConvertToLead={() => void convertThreadToLead()}
              convertingLead={convertingLead}
              onCreateProposal={() => void createProposalFromThread()}
              creatingProposal={creatingProposal}
              /* PBS 2026-07-15 · [↪ Forward] · opens ComposeModal pre-filled. */
              onForward={forwardThread}
            />
            {/* PBS 2026-07-15 · Convert-to-Lead / Create-Proposal toast. */}
            {convertToast && (
              <div style={{ margin: '8px 24px 0', background: T.CREAM, border: '1px solid ' + T.HAIR, borderRadius: 4, padding: '8px 12px', fontSize: 12, color: T.INK, display: 'flex', gap: 10, alignItems: 'center' }}>
                <span>→ {convertToast}</span>
                {convertToastLink && (
                  <a href={convertToastLink} style={{ color: T.FOREST, fontWeight: 600, textDecoration: 'underline' }}>Open in Leads</a>
                )}
              </div>
            )}
            {/* PBS 2026-07-15 §3 · AI actions row + inline summary. */}
            <div style={{ padding: '10px 24px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <AiBtn onClick={() => void aiSummarize()} disabled={aiSummaryLoading} loading={aiSummaryLoading}>✨ Summarize thread</AiBtn>
                <AiBtn onClick={() => void aiProposeReply()} disabled={aiProposeLoading} loading={aiProposeLoading}>✍ Propose answer</AiBtn>
                <AiBtn onClick={() => void aiPolish()} disabled={aiPolishLoading || !replyBody.trim()} loading={aiPolishLoading}>🪄 Polish my answer</AiBtn>
              </div>
              {aiActionErr && (
                <div style={{ fontSize: 11, color: T.RED }}>AI error: {aiActionErr}</div>
              )}
              {aiSummary && (
                <div style={{ background: T.CREAM, border: '1px solid ' + T.HAIR, borderRadius: 6, padding: '10px 14px', fontSize: 12, color: T.INK, lineHeight: 1.55, maxHeight: layout.summaryH + 'px', overflowY: 'auto', position: 'relative' }}>
                  {/* PBS 2026-07-15 · summary-card resize handle (bottom). */}
                  <div onMouseDown={beginDrag('summaryH')} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, cursor: 'row-resize' }} title="Drag to resize summary" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: T.INK_M, fontWeight: 600 }}>Vector summary</div>
                    <button type="button" onClick={() => setAiSummary('')} style={{ background: 'transparent', border: 'none', color: T.INK_M, cursor: 'pointer', fontSize: 14 }} aria-label="Clear">×</button>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{aiSummary}</div>
                  {/* PBS 2026-07-17 · refine + translate + save toolbar. */}
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4, position: 'relative' }}>
                    <SumChip onClick={() => void aiSummarizeRefine('shorten')}     loading={aiSummaryRefining === 'shorten'}     label="Shorten" />
                    <SumChip onClick={() => void aiSummarizeRefine('actionable')}  loading={aiSummaryRefining === 'actionable'}  label="Actionable" />
                    <SumChip onClick={() => void aiSummarizeRefine('focus_rate')}  loading={aiSummaryRefining === 'focus_rate'}  label="Focus on rate" />
                    <SumChip onClick={() => void aiSummarizeRefine('focus_dates')} loading={aiSummaryRefining === 'focus_dates'} label="Focus on dates" />
                    <div style={{ position: 'relative' }}>
                      <SumChip onClick={() => setTranslateOpen((v) => !v)} loading={!!translating} label={translating ? 'Translating…' : '🌐 Translate ▾'} />
                      {translateOpen && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 30, marginTop: 4, background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,.1)', minWidth: 140 }}>
                          {['EN','FR','DE','ES','TH','LO','JA','ZH'].map((lg) => (
                            <div key={lg} onClick={() => void aiTranslate(lg)} style={{ padding: '6px 10px', fontSize: 11, color: T.INK, cursor: 'pointer' }}>{lg}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <SumChip onClick={() => void saveImportant()} loading={savingImportant} label={savedToImportant ? '✓ Saved' : '💾 Save to important'} />
                    <SumChip onClick={proposeFromSummary}         loading={false}          label="✍ Propose reply from this" />
                  </div>
                </div>
              )}
            </div>
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
            <div style={{ borderTop: '1px solid ' + T.HAIR, background: T.WHITE, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: replyOpen ? layout.composerH : 'auto', position: 'relative' }}>
              {/* PBS 2026-07-15 · composer resize handle (top edge). Drag UP to grow, DOWN to shrink. */}
              {replyOpen && (
                <div onMouseDown={beginDrag('composerH')} style={{ position: 'absolute', left: 0, right: 0, top: -2, height: 4, cursor: 'row-resize', zIndex: 5 }} title="Drag to resize composer" />
              )}
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
                    style={{ width: '100%', flex: 1, minHeight: 60, border: '1px solid ' + T.HAIR, borderRadius: 6, padding: 10, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: T.INK, background: T.WHITE, resize: 'none' }}
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
                      onClick={() => void aiPolish()}
                      disabled={aiPolishLoading || !replyBody.trim()}
                      style={{ background: T.WHITE, color: T.FOREST, border: '1px solid ' + T.FOREST, borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: aiPolishLoading ? 'not-allowed' : 'pointer' }}
                    >{aiPolishLoading ? 'Polishing…' : '🪄 Polish'}</button>
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
        <ComposeModal
          prefill={composePrefill}
          onClose={() => { setShowCompose(false); setComposePrefill(undefined); }}
          onSent={() => { setShowCompose(false); setComposePrefill(undefined); void loadList(); }}
        />
      )}

      {lastError && (
        <div style={{ position: 'fixed', bottom: 12, right: 12, background: T.RED, color: T.WHITE, padding: '8px 12px', borderRadius: 4, fontSize: 11, zIndex: 3000 }} onClick={() => setLastError(null)}>{lastError}</div>
      )}
      {/* PBS 2026-07-15 · Item 1 + 4 + 6 toasts. */}
      {bulkReadToast && (
        <div style={{ position: 'fixed', bottom: 12, left: 12, background: T.FOREST, color: T.WHITE, padding: '8px 12px', borderRadius: 4, fontSize: 11, zIndex: 3000 }}>{bulkReadToast}</div>
      )}
      {senderActionToast && (
        <div style={{ position: 'fixed', bottom: 40, left: 12, background: T.INK, color: T.WHITE, padding: '8px 12px', borderRadius: 4, fontSize: 11, zIndex: 3000 }}>{senderActionToast}</div>
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

// PBS 2026-07-15 §2 · headline stripe tile.
function StripeTile({ label, value, onClick, active }: { label: string; value: number | string; onClick: (() => void) | undefined; active: boolean }) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      style={{
        background: T.WHITE, border: '1px solid ' + (active ? T.FOREST : T.HAIR),
        borderRadius: 4, padding: '6px 8px', textAlign: 'center',
        cursor: clickable ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', minHeight: 46,
      }}
    >
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: T.INK_M, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, color: T.INK, fontWeight: 700, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

// PBS 2026-07-17 · summary refine/translate/save chip.
function SumChip({ label, onClick, loading }: { label: string; onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        background: T.WHITE, color: T.FOREST, border: '1px solid ' + T.HAIR,
        borderRadius: 12, padding: '3px 10px', fontSize: 10.5, fontWeight: 600,
        cursor: loading ? 'wait' : 'pointer',
        opacity: loading ? 0.7 : 1,
      }}
    >{loading ? '…' : label}</button>
  );
}

// PBS 2026-07-15 §3 · AI action button.
function AiBtn({ children, onClick, disabled, loading }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: T.WHITE, color: disabled ? '#9AA' : T.FOREST,
        border: '1px solid ' + (disabled ? T.HAIR : T.FOREST),
        borderRadius: 4, padding: '5px 10px', fontSize: 11, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.75 : 1,
      }}
    >{loading ? '…' : children}</button>
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

function ThreadRow({ row, selected, onClick, onToggleStar, menuOpen, onMenuToggle, onMenuClose, onRouteSender, onCustomFolderFromSender }: {
  row: ListRow;
  selected: boolean;
  onClick: () => void;
  onToggleStar: (e: React.MouseEvent) => void;
  menuOpen?: boolean;
  onMenuToggle?: (e: React.MouseEvent) => void;
  onMenuClose?: () => void;
  onRouteSender?: (route: 'newsletter' | 'spam' | 'cloudbeds' | 'lighthouse' | 'hide', customFolder?: string) => void;
  onCustomFolderFromSender?: () => void;
}) {
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
        background: bg, cursor: 'pointer', position: 'relative',
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
      {/* PBS 2026-07-15 · Item 4 — per-row 3-dot menu for sender routing. */}
      {onMenuToggle && (
        <button
          type="button"
          onClick={onMenuToggle}
          title="Route this sender…"
          style={{ background: 'transparent', border: 'none', color: T.INK_M, cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
        >⋯</button>
      )}
      {menuOpen && onRouteSender && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: 42, right: 8, zIndex: 50,
            background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,.12)', minWidth: 220, padding: 4,
          }}
        >
          <div style={{ padding: '4px 8px', fontSize: 10, textTransform: 'uppercase', color: T.INK_M, letterSpacing: '.06em' }}>Route {parsed.email} →</div>
          <MenuItem onClick={() => onRouteSender('newsletter')}>📰 Newsletters</MenuItem>
          <MenuItem onClick={() => onRouteSender('cloudbeds')}>📊 Cloudbeds</MenuItem>
          <MenuItem onClick={() => onRouteSender('lighthouse')}>💡 Lighthouse</MenuItem>
          <MenuItem onClick={() => onRouteSender('spam')}>🚫 Spam</MenuItem>
          <MenuItem onClick={() => onRouteSender('hide')}>🙈 Hide from Direct</MenuItem>
          {onCustomFolderFromSender && (
            <MenuItem onClick={onCustomFolderFromSender}>➕ Create custom folder…</MenuItem>
          )}
          <div style={{ borderTop: '1px solid ' + T.HAIR, marginTop: 4, padding: 4 }}>
            <MenuItem onClick={() => onMenuClose && onMenuClose()}>Cancel</MenuItem>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ padding: '7px 10px', fontSize: 12, color: T.INK, background: hover ? T.HOVER : 'transparent', cursor: 'pointer', borderRadius: 3 }}
    >{children}</div>
  );
}

function ThreadHeader({ subject, onArchive, onTrash, onStar, onMarkUnread, starred, onDelete, onUnsubscribe, onSpam, onRouteSender, onConvertToLead, convertingLead, onCreateProposal, creatingProposal, onForward }: {
  subject: string;
  onArchive: () => void;
  onTrash: () => void;
  onStar: () => void;
  onMarkUnread: () => void;
  starred: boolean;
  onDelete: () => void;
  onUnsubscribe?: () => void;
  onSpam?: () => void;
  onRouteSender?: (route: 'newsletter' | 'cloudbeds' | 'lighthouse' | 'hide' | 'custom') => void;
  // PBS 2026-07-15 · Convert-to-Lead / Create-Proposal primary actions.
  onConvertToLead?: () => void;
  convertingLead?: boolean;
  onCreateProposal?: () => void;
  creatingProposal?: boolean;
  // PBS 2026-07-15 · Forward · opens ComposeModal pre-filled with the newest
  // message wrapped in the standard "----- Forwarded message -----" block.
  onForward?: () => void;
}) {
  const [routeOpen, setRouteOpen] = useState(false);
  return (
    <div style={{ padding: '14px 24px 12px', borderBottom: '1px solid ' + T.HAIR, background: T.WHITE, position: 'sticky', top: 0, zIndex: 2 }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: T.INK, marginBottom: 10, wordBreak: 'break-word' }}>{subject}</div>
      {/* PBS 2026-07-15 · Primary CRM actions row (green) — Convert-to-Lead + Create-Proposal. */}
      {(onConvertToLead || onCreateProposal) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {onConvertToLead && (
            <PrimaryBtn onClick={onConvertToLead} disabled={!!convertingLead}>
              {convertingLead ? '⏳ Extracting…' : '👤 Convert to Lead'}
            </PrimaryBtn>
          )}
          {onCreateProposal && (
            <PrimaryBtn onClick={onCreateProposal} disabled={!!creatingProposal}>
              {creatingProposal ? '⏳ Drafting…' : '📄 Create Proposal'}
            </PrimaryBtn>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <HeaderBtn onClick={onArchive}>Archive</HeaderBtn>
        <HeaderBtn onClick={onTrash}>Trash</HeaderBtn>
        <HeaderBtn onClick={onStar}><span style={{ color: starred ? T.STAR : T.INK_S }}>★</span> {starred ? 'Unstar' : 'Star'}</HeaderBtn>
        <HeaderBtn onClick={onMarkUnread}>Mark unread</HeaderBtn>
        {/* PBS 2026-07-15 · [↪ Forward] · opens ComposeModal with the newest
            message wrapped in "----- Forwarded message -----" block.
            Attachments are NOT re-attached (Gmail thread route doesn't return
            them yet); sender must re-attach manually via the 📎 button. */}
        {onForward && <HeaderBtn onClick={onForward}><span style={{ color: T.FOREST, fontWeight: 700 }}>↪ Forward</span></HeaderBtn>}
        {/* PBS 2026-07-17 Feature 6 · Delete = confirm + Gmail TRASH + local remove. */}
        <HeaderBtn onClick={onDelete}><span style={{ color: T.RED }}>🗑 Delete</span></HeaderBtn>
        {/* PBS 2026-07-15 · Item 6 — Unsubscribe / Spam / Route sender. */}
        {onUnsubscribe && <HeaderBtn onClick={onUnsubscribe}>📵 Unsubscribe</HeaderBtn>}
        {onSpam && <HeaderBtn onClick={onSpam}><span style={{ color: T.RED }}>🚫 Mark as Spam</span></HeaderBtn>}
        {onRouteSender && (
          <div style={{ position: 'relative' }}>
            <HeaderBtn onClick={() => setRouteOpen((v) => !v)}>⋯ Route sender ▾</HeaderBtn>
            {routeOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 30,
                background: T.WHITE, border: '1px solid ' + T.HAIR, borderRadius: 4,
                boxShadow: '0 4px 12px rgba(0,0,0,.12)', minWidth: 200, padding: 4,
              }}>
                <MenuItem onClick={() => { setRouteOpen(false); onRouteSender('newsletter'); }}>📰 Newsletters</MenuItem>
                <MenuItem onClick={() => { setRouteOpen(false); onRouteSender('cloudbeds'); }}>📊 Cloudbeds</MenuItem>
                <MenuItem onClick={() => { setRouteOpen(false); onRouteSender('lighthouse'); }}>💡 Lighthouse</MenuItem>
                <MenuItem onClick={() => { setRouteOpen(false); onRouteSender('hide'); }}>🙈 Hide from Direct</MenuItem>
                <MenuItem onClick={() => { setRouteOpen(false); onRouteSender('custom'); }}>➕ Custom folder…</MenuItem>
              </div>
            )}
          </div>
        )}
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

// PBS 2026-07-15 · Item 3 — drag-to-resize handle (4px invisible strip that
// shows a 1-px brand-green line on hover). Grid cell parent gives it space;
// mouseDown is wired to a caller-supplied handler that runs the drag loop.
function ResizeHandle({ orientation, onMouseDown }: { orientation: 'col' | 'row'; onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void }) {
  const [hover, setHover] = useState(false);
  const isCol = orientation === 'col';
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={isCol ? 'Drag to resize width' : 'Drag to resize height'}
      style={{
        cursor: isCol ? 'col-resize' : 'row-resize',
        background: hover ? T.FOREST : 'transparent',
        transition: 'background 120ms',
        ...(isCol
          ? { width: 4, height: '100%' }
          : { height: 4, width: '100%' }),
      }}
    />
  );
}

// PBS 2026-07-15 · Green primary buttons for Convert-to-Lead / Create-Proposal.
function PrimaryBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? '#B4C7C1' : T.FOREST,
        color: '#FFFFFF',
        border: '1px solid ' + T.FOREST,
        borderRadius: 4,
        padding: '7px 14px',
        fontSize: 12,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        letterSpacing: '.02em',
      }}
    >{children}</button>
  );
}

// PBS 2026-07-15 §5 · Forwarded-thread expansion. If subject starts with
// Fwd:/FW: we run the pure parser and render a vertical stack of parsed
// sub-messages (fallback = current single-body render + a discreet note).
function MessageCard({ msg, expanded, isNewest, onToggle }: { msg: FullMessage; expanded: boolean; isNewest: boolean; onToggle: () => void }) {
  const parsed = parseFrom(msg.from);
  const senderName = parsed.name || parsed.email;

  const fwd = useMemo(() => {
    if (!isForwardedSubject(msg.subject)) return null;
    // Prefer textBody for parsing; fall back to stripped htmlBody.
    const source = msg.textBody?.trim() || msg.htmlBody.replace(/<[^>]+>/g, '\n').replace(/\n{3,}/g, '\n\n');
    return parseForwardedThread(source, msg.subject);
  }, [msg.subject, msg.textBody, msg.htmlBody]);

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
          {fwd && fwd.messages.length > 1 ? (
            <ForwardedStack parsed={fwd.messages} parseFallback={fwd.parseFallback} />
          ) : (
            <>
              <div
                style={{ fontSize: 13, color: T.INK, lineHeight: 1.55, wordWrap: 'break-word', overflow: 'auto' }}
                dangerouslySetInnerHTML={{ __html: msg.htmlBody }}
              />
              {fwd && fwd.parseFallback && (
                <div style={{ marginTop: 12, fontSize: 11, color: T.INK_M, fontStyle: 'italic' }}>
                  ⚠ Could not parse forwarded chain — showing raw body.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Stack of parsed forwarded messages, most-recent-first, older collapsed.
function ForwardedStack({ parsed, parseFallback }: { parsed: ParsedMessage[]; parseFallback: boolean }) {
  const ordered = [...parsed].reverse();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {ordered.map((p, i) => (
        <ForwardedCard key={i} p={p} defaultOpen={i === 0 || p.depth === 0} />
      ))}
      {parseFallback && (
        <div style={{ fontSize: 11, color: T.INK_M, fontStyle: 'italic' }}>
          ⚠ Could not fully parse forwarded chain — best-effort split.
        </div>
      )}
    </div>
  );
}

function ForwardedCard({ p, defaultOpen }: { p: ParsedMessage; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: '1px solid ' + T.HAIR, borderRadius: 6, background: p.is_forward ? T.RAIL_BG : T.WHITE }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: T.INK, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.from || (p.is_forward ? 'Forwarded message' : 'Note')}
            {p.depth > 0 && <span style={{ marginLeft: 6, fontSize: 10, color: T.INK_M }}>· depth {p.depth}</span>}
          </div>
          <div style={{ color: T.INK_M, fontSize: 11, marginTop: 2 }}>
            {p.date}{p.to ? ' · to ' + p.to : ''}
          </div>
        </div>
        <div style={{ color: T.INK_M, fontSize: 12 }}>{open ? '−' : '+'}</div>
      </div>
      {open && (
        <div style={{ padding: '4px 14px 12px', fontSize: 12, color: T.INK, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {p.body || <span style={{ color: T.INK_M, fontStyle: 'italic' }}>(empty)</span>}
        </div>
      )}
    </div>
  );
}
