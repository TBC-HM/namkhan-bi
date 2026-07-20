'use client';
// app/marketing/subscribers/_components/SubscribersClient.tsx
// PBS 2026-07-16 — Subscribers directory + import panels + bulk actions.
// Every write goes through /api/marketing/subscribers/* which calls a
// SECURITY DEFINER RPC (fn_subscriber_*). No direct writes from client.
// Paper-white per Namkhan token burn (var(--paper-warm) is DARK).
//
// 2026-07-21 — Added subscriber groups (FIT/BTB/DMC + custom):
//  · dynamic KPI headline strip (one tile per group + Total) — click to filter
//  · groups chip row under Segments — click to filter + delete custom groups
//  · bulk "Assign to group" select in bulk-action bar
//  · row-level group chips (coloured by group.color)
//  · create-group modal (slug auto-derived from name)
//
// 2026-07-21 (pm) — /marketing/contacts folded in as top-level "Candidates pool"
// tab. Reads ?tab=candidates from URL to preserve the old contacts landing.
// Full contact table + top-domain chips + "Add to Lead" action all preserved.

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';

export interface SubscriberRow {
  id: number;
  email: string;
  name: string | null;
  tags: string[] | null;
  source: string;
  opted_in_at: string | null;
  unsubscribed_at: string | null;
  bounced_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  group_slugs?: string[] | null;
}

export interface ScrapeEventRow {
  id: number;
  url: string;
  title: string | null;
  target: 'lead' | 'subscriber';
  tags: string[] | null;
  emails_found: string[] | null;
  summary: string | null;
  lead_id: number | null;
  subscriber_ids: number[] | null;
  created_at: string;
}

export interface GmailContactRow {
  email: string;
  display_name: string | null;
  message_count: number;
  domain: string;
  last_seen_at: string | null;
  is_internal: boolean;
}

export interface GroupRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string;
  is_system: boolean;
  sort_order: number;
  member_count: number;
}

// Candidates pool (ex-/marketing/contacts):
export interface ContactRow {
  email: string;
  display_name: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  message_count: number;
  direction_mix: { in?: number; out?: number } | null;
  source_accounts: string[] | null;
  domain: string;
  is_internal: boolean;
  updated_at: string | null;
}

export interface DomainRow {
  domain: string;
  contact_count: number;
  total_messages: number;
  most_recent: string | null;
}

type SortKey = 'email' | 'name' | 'source' | 'created_at' | 'updated_at' | 'opted_in_at';

const HAIRLINE = '#E6DFCC';
const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const BRAND = '#084838';
const RED = '#B04A2F';
const PAPER = '#FFFFFF';
const WARM = '#F5F0E1';

const PAGE_SIZE = 50;

// Preset colours for the create-group modal picker.
const GROUP_COLOR_PRESETS = [
  '#7A4B2A', '#084838', '#B48A3A', '#B04A2F', '#3E5C76',
  '#7A5C99', '#4E6E58', '#8C5A3C', '#2E4B36', '#A65E44',
];

const cellStyle: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: 12,
  color: INK,
  borderBottom: '1px solid ' + HAIRLINE,
  verticalAlign: 'top',
  textAlign: 'left',
};
const headStyle: React.CSSProperties = {
  padding: '8px',
  fontSize: 11,
  fontWeight: 600,
  color: INK_SOFT,
  background: PAPER,
  borderBottom: '1px solid ' + HAIRLINE,
  textAlign: 'left',
  cursor: 'pointer',
  userSelect: 'none',
};
const buttonBase: React.CSSProperties = {
  fontSize: 11,
  padding: '6px 10px',
  borderRadius: 4,
  border: '1px solid ' + HAIRLINE,
  background: PAPER,
  color: INK,
  cursor: 'pointer',
};
const buttonPrimary: React.CSSProperties = {
  ...buttonBase,
  background: BRAND,
  color: PAPER,
  border: '1px solid ' + BRAND,
};
const buttonDanger: React.CSSProperties = {
  ...buttonBase,
  color: RED,
  border: '1px solid ' + RED,
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try { return new Date(d).toISOString().slice(0, 10); } catch { return '—'; }
}

function fmtDT(d: string | null): string {
  if (!d) return '—';
  try {
    const dd = new Date(d);
    return dd.toISOString().slice(0, 10) + ' ' + dd.toISOString().slice(11, 16);
  } catch { return '—'; }
}

// Escape a CSV cell.
function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// slugify — used in the create-group modal so PBS doesn't have to type a slug.
function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}

export default function SubscribersClient({
  initialSubscribers,
  gmailCandidates,
  scrapeEvents,
  initialGroups,
  allContacts = [],
  topDomains = [],
}: {
  initialSubscribers: SubscriberRow[];
  gmailCandidates: GmailContactRow[];
  scrapeEvents: ScrapeEventRow[];
  initialGroups: GroupRow[];
  allContacts?: ContactRow[];
  topDomains?: DomainRow[];
}) {
  // Top-level tab: ?tab=candidates lands on the Candidates pool (ex-/marketing/contacts).
  const searchParams = useSearchParams();
  const initialTopTab: 'subscribers' | 'candidates' =
    searchParams?.get('tab') === 'candidates' ? 'candidates' : 'subscribers';
  const [topTab, setTopTab] = useState<'subscribers' | 'candidates'>(initialTopTab);

  const [subs, setSubs] = useState<SubscriberRow[]>(initialSubscribers);
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'unsub' | 'bounced'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [tab, setTab] = useState<'gmail' | 'csv' | 'manual' | 'scrape'>('gmail');
  const [busy, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [optInModal, setOptInModal] = useState(false);
  const [optInList, setOptInList] = useState<{id:number; email:string; name:string|null; token:string}[]>([]);

  // Groups state — served from initialGroups; refreshed on create/delete.
  const [groups, setGroups] = useState<GroupRow[]>(initialGroups);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const groupBySlug = useMemo(() => {
    const m = new Map<string, GroupRow>();
    for (const g of groups) m.set(g.slug, g);
    return m;
  }, [groups]);

  // Refresh groups list from server (after create/delete).
  const refreshGroups = useCallback(async () => {
    const r = await fetch('/api/marketing/subscribers/groups', { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (j.ok && Array.isArray(j.groups)) setGroups(j.groups as GroupRow[]);
  }, []);

  const allTags = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of subs) for (const t of s.tags ?? []) c[t] = (c[t] ?? 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [subs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = subs.slice();
    if (statusFilter === 'active')  rows = rows.filter((r) => !!r.opted_in_at && !r.unsubscribed_at);
    if (statusFilter === 'pending') rows = rows.filter((r) => !r.opted_in_at && !r.unsubscribed_at);
    if (statusFilter === 'unsub')   rows = rows.filter((r) => !!r.unsubscribed_at);
    if (statusFilter === 'bounced') rows = rows.filter((r) => !!r.bounced_at);
    if (tagFilter) rows = rows.filter((r) => (r.tags ?? []).includes(tagFilter));
    if (groupFilter) rows = rows.filter((r) => (r.group_slugs ?? []).includes(groupFilter));
    if (q) rows = rows.filter((r) =>
      r.email.toLowerCase().includes(q)
      || (r.name ?? '').toLowerCase().includes(q)
      || (r.source ?? '').toLowerCase().includes(q)
      || (r.tags ?? []).some((t) => t.toLowerCase().includes(q))
    );
    rows.sort((a, b) => {
      let av: string | number = ''; let bv: string | number = '';
      const k = sortKey;
      if (k === 'email' || k === 'source') { av = a[k] ?? ''; bv = b[k] ?? ''; }
      else if (k === 'name') { av = a.name ?? ''; bv = b.name ?? ''; }
      else { av = a[k] ?? ''; bv = b[k] ?? ''; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [subs, query, tagFilter, groupFilter, statusFilter, sortKey, sortDir]);

  const paged = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'created_at' || k === 'updated_at' || k === 'opted_in_at' ? 'desc' : 'asc'); }
  }

  function toggleRow(id: number) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleAllVisible() {
    const visible = paged.map((r) => r.id);
    const allSel = visible.every((id) => selected.has(id));
    setSelected((s) => {
      const n = new Set(s);
      if (allSel) visible.forEach((id) => n.delete(id));
      else visible.forEach((id) => n.add(id));
      return n;
    });
  }

  // ─── row actions ────────────────────────────────────────────────
  const doUnsub = useCallback(async (id: number) => {
    if (!confirm('Unsubscribe this contact?')) return;
    startTransition(async () => {
      const r = await fetch('/api/marketing/subscribers/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action: 'unsubscribe' }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.ok) {
        setSubs((prev) => prev.map((s) => s.id === id ? { ...s, unsubscribed_at: new Date().toISOString(), is_active: false } : s));
      } else {
        setMsg('Unsubscribe failed: ' + (j.error ?? 'unknown'));
      }
    });
  }, []);

  const doSetTags = useCallback(async (id: number, tags: string[]) => {
    startTransition(async () => {
      const r = await fetch('/api/marketing/subscribers/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action: 'set_tags', tags }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.ok) setSubs((prev) => prev.map((s) => s.id === id ? { ...s, tags } : s));
      else setMsg('Tag update failed');
    });
  }, []);

  // ─── bulk actions ───────────────────────────────────────────────
  const doBulk = useCallback(async (action: 'delete' | 'add_tag' | 'remove_tag' | 'unsubscribe', tag?: string) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (action === 'delete' && !confirm('Delete ' + ids.length + ' subscribers? This cannot be undone.')) return;
    if (action === 'unsubscribe' && !confirm('Unsubscribe ' + ids.length + ' contacts?')) return;
    startTransition(async () => {
      const r = await fetch('/api/marketing/subscribers/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids, action, tag }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { setMsg('Bulk failed: ' + (j.error ?? 'unknown')); return; }
      if (action === 'delete') {
        setSubs((prev) => prev.filter((s) => !selected.has(s.id)));
        setSelected(new Set());
      } else if (action === 'add_tag' && tag) {
        setSubs((prev) => prev.map((s) => selected.has(s.id) ? { ...s, tags: Array.from(new Set([...(s.tags ?? []), tag])) } : s));
      } else if (action === 'remove_tag' && tag) {
        setSubs((prev) => prev.map((s) => selected.has(s.id) ? { ...s, tags: (s.tags ?? []).filter((t) => t !== tag) } : s));
      } else if (action === 'unsubscribe') {
        setSubs((prev) => prev.map((s) => selected.has(s.id) ? { ...s, unsubscribed_at: new Date().toISOString(), is_active: false } : s));
        setSelected(new Set());
      }
      setMsg('Done: ' + j.affected + ' affected');
    });
  }, [selected]);

  // Bulk assign to group — updates group_slugs optimistically + refreshes group counts.
  const doBulkAssignGroup = useCallback(async (groupId: string) => {
    const ids = Array.from(selected);
    const g = groups.find((x) => x.id === groupId);
    if (!ids.length || !g) return;
    startTransition(async () => {
      const r = await fetch('/api/marketing/subscribers/groups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'assign', subscriber_ids: ids, group_id: groupId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { setMsg('Assign failed: ' + (j.error ?? 'unknown')); return; }
      setSubs((prev) => prev.map((s) => selected.has(s.id)
        ? { ...s, group_slugs: Array.from(new Set([...(s.group_slugs ?? []), g.slug])) }
        : s));
      setMsg('Assigned ' + (j.affected ?? ids.length) + ' to ' + g.name);
      refreshGroups();
    });
  }, [selected, groups, refreshGroups]);

  // Create group — POST create then refresh.
  const doCreateGroup = useCallback(async (slug: string, name: string, description: string, color: string) => {
    const r = await fetch('/api/marketing/subscribers/groups', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create', slug, name, description, color }),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) { setMsg('Create failed: ' + (j.error ?? 'unknown')); return false; }
    await refreshGroups();
    setMsg('Group "' + name + '" created');
    return true;
  }, [refreshGroups]);

  // Delete group — guard against is_system + confirm.
  const doDeleteGroup = useCallback(async (g: GroupRow) => {
    if (g.is_system) { setMsg('System groups cannot be deleted'); return; }
    if (!confirm('Delete group "' + g.name + '"? Members lose the tag (subscribers themselves are NOT deleted).')) return;
    startTransition(async () => {
      const r = await fetch('/api/marketing/subscribers/groups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'delete', group_id: g.id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { setMsg('Delete failed: ' + (j.error ?? 'unknown')); return; }
      setSubs((prev) => prev.map((s) => ({
        ...s,
        group_slugs: (s.group_slugs ?? []).filter((sl) => sl !== g.slug),
      })));
      if (groupFilter === g.slug) setGroupFilter(null);
      await refreshGroups();
      setMsg('Group "' + g.name + '" deleted');
    });
  }, [groupFilter, refreshGroups]);

  function exportSelected() {
    const rows = selected.size > 0 ? subs.filter((s) => selected.has(s.id)) : filtered;
    const headers = ['email','name','tags','groups','source','opted_in_at','unsubscribed_at','bounced_at','created_at','notes'];
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push([
        csvCell(r.email), csvCell(r.name), csvCell((r.tags ?? []).join('|')),
        csvCell((r.group_slugs ?? []).join('|')),
        csvCell(r.source), csvCell(r.opted_in_at), csvCell(r.unsubscribed_at),
        csvCell(r.bounced_at), csvCell(r.created_at), csvCell(r.notes),
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'namkhan-subscribers-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── opt-in campaign ────────────────────────────────────────────
  async function openOptInModal() {
    const pending = subs.filter((s) => !s.opted_in_at && !s.unsubscribed_at).map((s) => s.id);
    if (!pending.length) { alert('No pending subscribers to confirm.'); return; }
    const r = await fetch('/api/marketing/subscribers/issue-tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: pending }),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) { alert('Token issue failed: ' + (j.error ?? 'unknown')); return; }
    setOptInList(j.tokens ?? []);
    setOptInModal(true);
  }

  async function sendOptInBatch() {
    if (!optInList.length) return;
    if (!confirm('Send opt-in email to ' + optInList.length + ' contacts via your Gmail?')) return;
    startTransition(async () => {
      const r = await fetch('/api/marketing/subscribers/send-opt-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tokens: optInList }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.ok) {
        setMsg('Sent ' + (j.sent ?? 0) + ' opt-in emails · ' + (j.failed ?? 0) + ' failed');
        setOptInModal(false);
      } else {
        alert('Send failed: ' + (j.error ?? 'unknown'));
      }
    });
  }

  const pendingCount = subs.filter((s) => !s.opted_in_at && !s.unsubscribed_at).length;

  // Client-side per-group counts (respect current filter set later applied by user).
  // We use full subs so tiles remain stable regardless of filters.
  const clientGroupCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of subs) for (const sl of s.group_slugs ?? []) c[sl] = (c[sl] ?? 0) + 1;
    return c;
  }, [subs]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Top-level tab strip: Subscribers | Candidates pool.
          "Candidates pool" is the ex-/marketing/contacts landing (Gmail-extract directory). */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid ' + HAIRLINE }}>
        {([
          { k: 'subscribers', label: 'Subscribers',      count: subs.length },
          { k: 'candidates',  label: 'Candidates pool',  count: allContacts.length },
        ] as const).map((t) => {
          const active = topTab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setTopTab(t.k)}
              style={{
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                padding: '10px 18px',
                border: 'none',
                background: 'transparent',
                color: active ? INK : INK_SOFT,
                borderBottom: active ? '2px solid ' + BRAND : '2px solid transparent',
                cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              {t.label} <span style={{ color: INK_SOFT, fontWeight: 400, marginLeft: 4 }}>· {t.count.toLocaleString()}</span>
            </button>
          );
        })}
      </div>

      {topTab === 'candidates' ? (
        <CandidatesPool contacts={allContacts} topDomains={topDomains} />
      ) : (<>

      {msg && (
        <div style={{ padding: '6px 10px', fontSize: 11, color: BRAND, background: PAPER, border: '1px solid ' + HAIRLINE, borderRadius: 4 }}>
          {msg} <button onClick={() => setMsg(null)} style={{ ...buttonBase, marginLeft: 8, padding: '2px 6px' }}>dismiss</button>
        </div>
      )}

      {/* Dynamic KPI headline strip — Total + one tile per group. Click to filter. */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0' }}>
        <GroupTile
          label="Total"
          value={subs.length}
          color={INK}
          active={groupFilter === null}
          onClick={() => { setGroupFilter(null); setPage(0); }}
        />
        {groups.map((g) => (
          <GroupTile
            key={g.id}
            label={g.name}
            value={clientGroupCounts[g.slug] ?? g.member_count ?? 0}
            color={g.color}
            active={groupFilter === g.slug}
            onClick={() => { setGroupFilter(groupFilter === g.slug ? null : g.slug); setPage(0); }}
          />
        ))}
      </div>

      {/* Action bar: search + status + opt-in button + import toggle */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', background: PAPER, padding: 8, border: '1px solid ' + HAIRLINE, borderRadius: 4 }}>
        <input
          type="search"
          placeholder="search email / name / tag"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }}
          style={{ flex: '1 1 240px', fontSize: 12, padding: '6px 8px', border: '1px solid ' + HAIRLINE, borderRadius: 4, background: PAPER, color: INK }}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(0); }}
          style={{ fontSize: 12, padding: '6px 8px', border: '1px solid ' + HAIRLINE, borderRadius: 4, background: PAPER, color: INK }}
        >
          <option value="all">All ({subs.length})</option>
          <option value="active">Active ({subs.filter((s) => !!s.opted_in_at && !s.unsubscribed_at).length})</option>
          <option value="pending">Pending ({pendingCount})</option>
          <option value="unsub">Unsubscribed ({subs.filter((s) => !!s.unsubscribed_at).length})</option>
          <option value="bounced">Bounced ({subs.filter((s) => !!s.bounced_at).length})</option>
        </select>
        <button
          onClick={openOptInModal}
          disabled={pendingCount === 0}
          style={{ ...buttonPrimary, opacity: pendingCount === 0 ? 0.5 : 1 }}
        >
          Send opt-in email to {pendingCount} unconfirmed
        </button>
        <button onClick={() => setImportOpen((o) => !o)} style={buttonBase}>
          {importOpen ? 'Close import' : 'Import ▾'}
        </button>
        <a
          href="/marketing/subscribers/bookmarklet"
          style={{ ...buttonBase, textDecoration: 'none' }}
        >
          Bookmarklet
        </a>
      </div>

      {/* Segments panel */}
      {allTags.length > 0 && (
        <div style={{ background: PAPER, padding: 8, border: '1px solid ' + HAIRLINE, borderRadius: 4 }}>
          <div style={{ fontSize: 11, color: INK_SOFT, marginBottom: 6 }}>Segments · click to filter</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button
              onClick={() => { setTagFilter(null); setPage(0); }}
              style={{
                ...buttonBase,
                background: tagFilter === null ? BRAND : PAPER,
                color: tagFilter === null ? PAPER : INK,
                border: '1px solid ' + (tagFilter === null ? BRAND : HAIRLINE),
              }}
            >
              all
            </button>
            {allTags.map(([t, c]) => (
              <button
                key={t}
                onClick={() => { setTagFilter(t === tagFilter ? null : t); setPage(0); }}
                style={{
                  ...buttonBase,
                  background: tagFilter === t ? BRAND : PAPER,
                  color: tagFilter === t ? PAPER : INK,
                  border: '1px solid ' + (tagFilter === t ? BRAND : HAIRLINE),
                }}
              >
                {t} · {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Groups filter chip row */}
      <div style={{ background: PAPER, padding: 8, border: '1px solid ' + HAIRLINE, borderRadius: 4 }}>
        <div style={{ fontSize: 11, color: INK_SOFT, marginBottom: 6 }}>Groups · click to filter</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <button
            onClick={() => { setGroupFilter(null); setPage(0); }}
            style={{
              ...buttonBase,
              background: groupFilter === null ? BRAND : PAPER,
              color: groupFilter === null ? PAPER : INK,
              border: '1px solid ' + (groupFilter === null ? BRAND : HAIRLINE),
            }}
          >
            all
          </button>
          {groups.map((g) => {
            const active = groupFilter === g.slug;
            return (
              <span key={g.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <button
                  onClick={() => { setGroupFilter(active ? null : g.slug); setPage(0); }}
                  title={g.description ?? g.slug}
                  style={{
                    ...buttonBase,
                    background: active ? g.color : PAPER,
                    color: active ? PAPER : INK,
                    border: '1px solid ' + (active ? g.color : HAIRLINE),
                    borderRight: g.is_system ? ('1px solid ' + (active ? g.color : HAIRLINE)) : 'none',
                    borderTopRightRadius: g.is_system ? 4 : 0,
                    borderBottomRightRadius: g.is_system ? 4 : 0,
                  }}
                >
                  <span style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                    background: g.color, marginRight: 6, verticalAlign: 'middle',
                    border: active ? '1px solid ' + PAPER : '1px solid ' + HAIRLINE,
                  }} />
                  {g.name} · {clientGroupCounts[g.slug] ?? g.member_count ?? 0}
                </button>
                {!g.is_system && (
                  <button
                    onClick={() => doDeleteGroup(g)}
                    title={'Delete group "' + g.name + '"'}
                    style={{
                      ...buttonBase,
                      padding: '6px 8px',
                      color: RED,
                      background: PAPER,
                      border: '1px solid ' + HAIRLINE,
                      borderLeft: 'none',
                      borderTopLeftRadius: 0,
                      borderBottomLeftRadius: 0,
                    }}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
          <button
            onClick={() => setShowCreateGroup(true)}
            style={{ ...buttonBase, borderStyle: 'dashed', color: BRAND }}
          >
            + New group
          </button>
        </div>
      </div>

      {/* Import panel */}
      {importOpen && (
        <ImportPanel
          tab={tab} setTab={setTab}
          gmailCandidates={gmailCandidates}
          scrapeEvents={scrapeEvents}
          onImported={(rows) => {
            setSubs((prev) => {
              const byId = new Map(prev.map((r) => [r.id, r]));
              for (const r of rows) byId.set(r.id, r);
              return Array.from(byId.values()).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
            });
            setMsg('Imported ' + rows.length + ' rows');
          }}
        />
      )}

      {/* Bulk action bar (only when selection) */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: WARM, padding: 8, border: '1px solid ' + HAIRLINE, borderRadius: 4, fontSize: 12, flexWrap: 'wrap' }}>
          <strong>{selected.size}</strong> selected
          <BulkTagAction onAdd={(t) => doBulk('add_tag', t)} onRemove={(t) => doBulk('remove_tag', t)} />
          <select
            defaultValue=""
            onChange={(e) => {
              const gid = e.target.value;
              if (!gid) return;
              doBulkAssignGroup(gid);
              e.target.value = '';
            }}
            style={{ fontSize: 11, padding: '4px 6px', border: '1px solid ' + HAIRLINE, background: PAPER, color: INK }}
          >
            <option value="">Assign to group…</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button onClick={exportSelected} style={buttonBase}>Export CSV</button>
          <button onClick={() => doBulk('unsubscribe')} style={buttonBase}>Unsubscribe</button>
          <button onClick={() => doBulk('delete')} style={buttonDanger}>Delete</button>
          <button onClick={() => setSelected(new Set())} style={{ ...buttonBase, marginLeft: 'auto' }}>Clear</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: PAPER, border: '1px solid ' + HAIRLINE, borderRadius: 4, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: PAPER }}>
          <thead>
            <tr>
              <th style={{ ...headStyle, width: 30 }}>
                <input type="checkbox"
                  checked={paged.length > 0 && paged.every((r) => selected.has(r.id))}
                  onChange={toggleAllVisible}
                />
              </th>
              <th style={headStyle} onClick={() => toggleSort('email')}>email {sortKey === 'email' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle} onClick={() => toggleSort('name')}>name {sortKey === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle}>tags</th>
              <th style={headStyle} onClick={() => toggleSort('opted_in_at')}>opted in? {sortKey === 'opted_in_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle} onClick={() => toggleSort('source')}>source {sortKey === 'source' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle} onClick={() => toggleSort('created_at')}>added {sortKey === 'created_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle} onClick={() => toggleSort('updated_at')}>last activity {sortKey === 'updated_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={{ ...headStyle, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => (
              <SubscriberRowView
                key={r.id}
                row={r}
                groupBySlug={groupBySlug}
                selected={selected.has(r.id)}
                onToggle={() => toggleRow(r.id)}
                onUnsub={() => doUnsub(r.id)}
                onSetTags={(tags) => doSetTags(r.id, tags)}
              />
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={9} style={{ ...cellStyle, textAlign: 'center', color: INK_SOFT, padding: 20 }}>
                {subs.length === 0 ? 'No subscribers yet. Use the Import panel above.' : 'No rows match the filters.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', fontSize: 11, color: INK_SOFT }}>
          <span>{filtered.length.toLocaleString()} rows · page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} style={buttonBase}>‹ prev</button>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={buttonBase}>next ›</button>
        </div>
      )}

      {/* Opt-in modal */}
      {optInModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: PAPER, padding: 20, borderRadius: 6, maxWidth: 620, width: '90%', maxHeight: '80vh', overflow: 'auto', border: '1px solid ' + HAIRLINE }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 14, color: INK }}>Send opt-in email to {optInList.length} unconfirmed</h3>
            <p style={{ fontSize: 12, color: INK_SOFT, margin: '0 0 12px 0' }}>
              Each recipient will get a personalised email with a one-click magic link to confirm.
              Once they click, <code>opted_in_at</code> is set to now and they become eligible for future campaigns.
              Sender = your connected Gmail account.
            </p>
            <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid ' + HAIRLINE, borderRadius: 4, marginBottom: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr><th style={headStyle}>email</th><th style={headStyle}>name</th></tr>
                </thead>
                <tbody>
                  {optInList.slice(0, 100).map((t) => (
                    <tr key={t.id}><td style={cellStyle}>{t.email}</td><td style={cellStyle}>{t.name ?? '—'}</td></tr>
                  ))}
                  {optInList.length > 100 && (
                    <tr><td colSpan={2} style={{ ...cellStyle, color: INK_SOFT, textAlign: 'center' }}>… and {optInList.length - 100} more</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setOptInModal(false)} style={buttonBase} disabled={busy}>Cancel</button>
              <button onClick={sendOptInBatch} style={buttonPrimary} disabled={busy}>{busy ? 'Sending…' : 'Send ' + optInList.length + ' emails'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Create-group modal */}
      {showCreateGroup && (
        <CreateGroupModal
          existingSlugs={new Set(groups.map((g) => g.slug))}
          onClose={() => setShowCreateGroup(false)}
          onSubmit={async (slug, name, description, color) => {
            const ok = await doCreateGroup(slug, name, description, color);
            if (ok) setShowCreateGroup(false);
          }}
        />
      )}
      </>)}
    </div>
  );
}

// ─── Candidates pool (ex-/marketing/contacts landing) ───────────────
// Top-500 v_gmail_contacts payload · client-side filter/sort ·
// internal/external toggle · top-10 external-domain chips ·
// per-row "+ Lead" that POSTs to /api/sales/leads/create.
type ContactSortKey = 'email' | 'display_name' | 'domain' | 'first_seen_at' | 'last_seen_at' | 'message_count';

function CandidatesPool({
  contacts, topDomains,
}: {
  contacts: ContactRow[];
  topDomains: DomainRow[];
}) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<ContactSortKey>('message_count');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [scope, setScope] = useState<'external' | 'internal' | 'all'>('external');
  const [addedLeads, setAddedLeads] = useState<Record<string, 'ok' | 'err'>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = contacts.slice();
    if (scope === 'external') rows = rows.filter((r) => !r.is_internal);
    else if (scope === 'internal') rows = rows.filter((r) => r.is_internal);
    if (q) rows = rows.filter((r) =>
      r.email.toLowerCase().includes(q)
      || (r.display_name ?? '').toLowerCase().includes(q)
      || (r.domain ?? '').toLowerCase().includes(q)
    );
    rows.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (sortKey) {
        case 'message_count':
          av = a.message_count; bv = b.message_count; break;
        case 'first_seen_at':
          av = a.first_seen_at ?? ''; bv = b.first_seen_at ?? ''; break;
        case 'last_seen_at':
          av = a.last_seen_at ?? ''; bv = b.last_seen_at ?? ''; break;
        case 'display_name':
          av = (a.display_name ?? '').toLowerCase(); bv = (b.display_name ?? '').toLowerCase(); break;
        case 'domain':
          av = a.domain ?? ''; bv = b.domain ?? ''; break;
        case 'email':
        default:
          av = a.email; bv = b.email; break;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [contacts, query, sortKey, sortDir, scope]);

  function toggleSort(k: ContactSortKey) {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'message_count' ? 'desc' : 'asc'); }
  }

  async function addToLead(row: ContactRow) {
    setAddedLeads((s) => ({ ...s, [row.email]: 'ok' }));
    try {
      const guessedCompany = row.display_name?.trim() || row.domain || row.email.split('@')[1] || 'Unknown';
      const r = await fetch('/api/sales/leads/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          company_name: guessedCompany,
          type: 'other',
          origin: 'inbound',
          email: row.email,
          decision_maker_name: row.display_name ?? null,
          notes: 'Added from Gmail contact extract. Seen in: '
            + (row.source_accounts ?? []).join(', ')
            + '. Messages: ' + row.message_count + '.',
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) setAddedLeads((s) => ({ ...s, [row.email]: 'err' }));
    } catch {
      setAddedLeads((s) => ({ ...s, [row.email]: 'err' }));
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ padding: '8px 12px', fontSize: 11, color: INK_SOFT, background: WARM, border: '1px solid ' + HAIRLINE, borderRadius: 4 }}>
        Extracted from connected Gmail mailboxes for internal reference. Marketing outreach requires opt-in — <em>do not</em> add to newsletters without consent.
        Use <strong>+ Lead</strong> to move a candidate into the sales pipeline.
      </div>

      {/* Scope toggle + filter */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: PAPER, padding: 8, border: '1px solid ' + HAIRLINE, borderRadius: 4 }}>
        {(['external', 'internal', 'all'] as const).map((s) => {
          const active = scope === s;
          return (
            <button
              key={s}
              onClick={() => setScope(s)}
              style={{
                ...buttonBase,
                background: active ? BRAND : PAPER,
                color: active ? PAPER : INK,
                border: '1px solid ' + (active ? BRAND : HAIRLINE),
                textTransform: 'capitalize',
              }}
            >
              {s}
            </button>
          );
        })}
        <input
          type="search"
          placeholder="filter email / name / domain…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: '1 1 240px', fontSize: 12, padding: '6px 8px', border: '1px solid ' + HAIRLINE, borderRadius: 4, background: PAPER, color: INK }}
        />
        <div style={{ fontSize: 11, color: INK_SOFT }}>
          {filtered.length.toLocaleString()} of top {contacts.length.toLocaleString()} (by message count)
        </div>
      </div>

      {/* Top external domains */}
      {topDomains.length > 0 && (
        <div style={{ background: PAPER, padding: 8, border: '1px solid ' + HAIRLINE, borderRadius: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: INK_SOFT, marginBottom: 6 }}>TOP 10 EXTERNAL DOMAINS</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {topDomains.map((d) => (
              <div
                key={d.domain}
                title={d.contact_count.toLocaleString() + ' contacts · last seen ' + fmtDate(d.most_recent)}
                style={{ padding: '4px 10px', fontSize: 11, color: INK, background: PAPER, border: '1px solid ' + HAIRLINE, borderRadius: 4, cursor: 'pointer' }}
                onClick={() => { setQuery(d.domain); setScope('external'); }}
              >
                <span style={{ fontWeight: 600 }}>{d.domain}</span>
                <span style={{ color: INK_SOFT, marginLeft: 6 }}>{d.total_messages.toLocaleString()} msgs · {d.contact_count} contacts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contacts table */}
      <div style={{ overflowX: 'auto', background: PAPER, border: '1px solid ' + HAIRLINE, borderRadius: 4 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: PAPER }}>
          <thead>
            <tr>
              <th style={headStyle} onClick={() => toggleSort('email')}>email {sortKey === 'email' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle} onClick={() => toggleSort('display_name')}>name {sortKey === 'display_name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle} onClick={() => toggleSort('domain')}>domain {sortKey === 'domain' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle} onClick={() => toggleSort('first_seen_at')}>first seen {sortKey === 'first_seen_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle} onClick={() => toggleSort('last_seen_at')}>last seen {sortKey === 'last_seen_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle} onClick={() => toggleSort('message_count')}>msgs {sortKey === 'message_count' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
              <th style={headStyle}>source</th>
              <th style={headStyle}>internal?</th>
              <th style={headStyle}>action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const state = addedLeads[r.email];
              return (
                <tr key={r.email}>
                  <td style={cellStyle}><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.email}</span></td>
                  <td style={cellStyle}>{r.display_name ?? <span style={{ color: INK_SOFT }}>—</span>}</td>
                  <td style={cellStyle}>{r.domain}</td>
                  <td style={cellStyle}>{fmtDate(r.first_seen_at)}</td>
                  <td style={cellStyle}>{fmtDate(r.last_seen_at)}</td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.message_count.toLocaleString()}</td>
                  <td style={{ ...cellStyle, fontSize: 11, color: INK_SOFT }}>{(r.source_accounts ?? []).join(', ')}</td>
                  <td style={cellStyle}>
                    {r.is_internal
                      ? <span style={{ color: INK_SOFT, fontSize: 11 }}>staff</span>
                      : <span style={{ color: BRAND, fontWeight: 600, fontSize: 11 }}>external</span>}
                  </td>
                  <td style={cellStyle}>
                    {r.is_internal ? (
                      <span style={{ color: INK_SOFT, fontSize: 11 }}>—</span>
                    ) : state === 'ok' ? (
                      <span style={{ color: BRAND, fontSize: 11, fontWeight: 600 }}>added ✓</span>
                    ) : state === 'err' ? (
                      <span style={{ color: RED, fontSize: 11 }}>failed</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addToLead(r)}
                        style={{ ...buttonBase, padding: '3px 8px', color: BRAND }}
                      >
                        + Lead
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ ...cellStyle, textAlign: 'center', color: INK_SOFT, padding: 20 }}>
                  {contacts.length === 0
                    ? 'No Gmail contacts extracted yet. Connect a mailbox and run extraction from the (former) /marketing/contacts admin panel.'
                    : (query ? 'No matches for “' + query + '”.' : 'No rows match the current scope.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── KPI headline tile ───────────────────────────────────────────
function GroupTile({
  label, value, color, active, onClick,
}: {
  label: string;
  value: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: PAPER,
        border: '1px solid ' + (active ? color : HAIRLINE),
        borderWidth: active ? 2 : 1,
        borderRadius: 4,
        padding: '10px 14px',
        minWidth: 120,
        cursor: 'pointer',
        textAlign: 'left',
        position: 'relative',
        color: INK,
        flex: '0 0 auto',
      }}
    >
      <span style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 4,
        background: color, borderTopLeftRadius: 3, borderTopRightRadius: 3,
      }} />
      <div style={{ fontSize: 20, fontWeight: 600, color: INK, marginTop: 4 }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: 11, color: INK_SOFT, marginTop: 2 }}>{label}</div>
    </button>
  );
}

// ─── row view with inline editable tag chips ─────────────────────────
function SubscriberRowView({
  row, groupBySlug, selected, onToggle, onUnsub, onSetTags,
}: {
  row: SubscriberRow;
  groupBySlug: Map<string, GroupRow>;
  selected: boolean;
  onToggle: () => void;
  onUnsub: () => void;
  onSetTags: (tags: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState((row.tags ?? []).join(', '));

  function commit() {
    const arr = draft.split(',').map((s) => s.trim()).filter(Boolean);
    onSetTags(arr);
    setEditing(false);
  }

  const optedIn = !!row.opted_in_at;
  const unsub = !!row.unsubscribed_at;
  const rowGroups = (row.group_slugs ?? [])
    .map((sl) => groupBySlug.get(sl))
    .filter((g): g is GroupRow => !!g);

  return (
    <tr style={{ background: selected ? '#F9F5EA' : PAPER, opacity: unsub ? 0.55 : 1 }}>
      <td style={cellStyle}>
        <input type="checkbox" checked={selected} onChange={onToggle} />
      </td>
      <td style={cellStyle}>
        <div style={{ fontFamily: 'monospace', fontSize: 11 }}>{row.email}</div>
        {row.bounced_at && <div style={{ fontSize: 10, color: RED }}>bounced</div>}
      </td>
      <td style={cellStyle}>{row.name ?? '—'}</td>
      <td style={{ ...cellStyle, minWidth: 160 }}>
        {editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
              autoFocus
              style={{ flex: 1, fontSize: 11, padding: '2px 4px', border: '1px solid ' + HAIRLINE, background: PAPER, color: INK }}
            />
            <button onClick={commit} style={{ ...buttonBase, padding: '2px 6px' }}>✓</button>
          </div>
        ) : (
          <div onClick={() => setEditing(true)} style={{ cursor: 'pointer', minHeight: 18, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {(row.tags ?? []).length === 0 && rowGroups.length === 0 && (
              <span style={{ color: INK_SOFT, fontSize: 10 }}>+ add tag</span>
            )}
            {(row.tags ?? []).map((t) => (
              <span key={t} style={{ fontSize: 10, padding: '1px 6px', background: WARM, border: '1px solid ' + HAIRLINE, borderRadius: 10, color: INK }}>{t}</span>
            ))}
            {rowGroups.map((g) => (
              <span
                key={g.id}
                title={'Group: ' + g.name}
                style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 10,
                  background: g.color, color: PAPER,
                  border: '1px solid ' + g.color,
                }}
              >
                {g.name}
              </span>
            ))}
          </div>
        )}
      </td>
      <td style={cellStyle}>
        {unsub ? <span style={{ color: INK_SOFT }}>—</span>
          : optedIn ? <span style={{ color: BRAND }}>✓ yes</span>
          : <span style={{ color: RED }}>· pending</span>}
      </td>
      <td style={cellStyle}><span style={{ fontSize: 10, color: INK_SOFT }}>{row.source}</span></td>
      <td style={cellStyle}>{fmtDate(row.created_at)}</td>
      <td style={cellStyle}>{fmtDate(row.updated_at)}</td>
      <td style={cellStyle}>
        {!unsub && (
          <button onClick={onUnsub} title="Unsubscribe" style={{ ...buttonBase, padding: '2px 6px', color: RED, border: '1px solid ' + HAIRLINE }}>×</button>
        )}
      </td>
    </tr>
  );
}

// ─── bulk tag helper ──────────────────────────────────────────────────
function BulkTagAction({
  onAdd, onRemove,
}: { onAdd: (t: string) => void; onRemove: (t: string) => void }) {
  const [t, setT] = useState('');
  return (
    <>
      <input
        placeholder="tag"
        value={t}
        onChange={(e) => setT(e.target.value)}
        style={{ fontSize: 11, padding: '4px 6px', border: '1px solid ' + HAIRLINE, background: PAPER, color: INK, width: 100 }}
      />
      <button onClick={() => { if (t.trim()) { onAdd(t.trim()); setT(''); } }} style={buttonBase}>+ tag</button>
      <button onClick={() => { if (t.trim()) { onRemove(t.trim()); setT(''); } }} style={buttonBase}>− tag</button>
    </>
  );
}

// ─── create-group modal ─────────────────────────────────────────────
function CreateGroupModal({
  existingSlugs, onClose, onSubmit,
}: {
  existingSlugs: Set<string>;
  onClose: () => void;
  onSubmit: (slug: string, name: string, description: string, color: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(GROUP_COLOR_PRESETS[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function onNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function submit() {
    const s = slug.trim();
    const n = name.trim();
    if (!s || !n) { setErr('name and slug are required'); return; }
    if (!/^[a-z0-9_]+$/.test(s)) { setErr('slug must be lowercase a-z, 0-9, or _'); return; }
    if (existingSlugs.has(s)) { setErr('slug already exists'); return; }
    setErr(null);
    setBusy(true);
    try {
      await onSubmit(s, n, description.trim(), color);
    } finally {
      setBusy(false);
    }
  }

  const input: React.CSSProperties = {
    fontSize: 12, padding: '6px 8px', border: '1px solid ' + HAIRLINE,
    borderRadius: 4, background: PAPER, color: INK, width: '100%',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: PAPER, padding: 20, borderRadius: 6, maxWidth: 480, width: '90%',
        border: '1px solid ' + HAIRLINE, display: 'grid', gap: 10,
      }}>
        <h3 style={{ margin: 0, fontSize: 14, color: INK }}>New subscriber group</h3>
        <label style={{ fontSize: 11, color: INK_SOFT }}>name
          <input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g. VIP travellers" style={input} autoFocus />
        </label>
        <label style={{ fontSize: 11, color: INK_SOFT }}>slug · lowercase snake_case
          <input
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
            placeholder="e.g. vip_travellers"
            style={input}
          />
        </label>
        <label style={{ fontSize: 11, color: INK_SOFT }}>description · optional
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="short one-liner" style={input} />
        </label>
        <div>
          <div style={{ fontSize: 11, color: INK_SOFT, marginBottom: 4 }}>colour</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {GROUP_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                title={c}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: c, cursor: 'pointer',
                  border: color === c ? '3px solid ' + INK : '1px solid ' + HAIRLINE,
                  padding: 0,
                }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              title="custom colour"
              style={{ width: 28, height: 28, border: '1px solid ' + HAIRLINE, borderRadius: 4, background: PAPER, cursor: 'pointer' }}
            />
          </div>
        </div>
        {err && <div style={{ fontSize: 11, color: RED }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onClose} style={buttonBase} disabled={busy}>Cancel</button>
          <button onClick={submit} style={buttonPrimary} disabled={busy}>{busy ? 'Creating…' : 'Create group'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── import panel with 4 tabs ────────────────────────────────────────
function ImportPanel({
  tab, setTab, gmailCandidates, scrapeEvents, onImported,
}: {
  tab: 'gmail' | 'csv' | 'manual' | 'scrape';
  setTab: (t: 'gmail' | 'csv' | 'manual' | 'scrape') => void;
  gmailCandidates: GmailContactRow[];
  scrapeEvents: ScrapeEventRow[];
  onImported: (rows: SubscriberRow[]) => void;
}) {
  const TABS: Array<{ k: 'gmail' | 'csv' | 'manual' | 'scrape'; label: string }> = [
    { k: 'gmail',  label: 'From Gmail contacts' },
    { k: 'csv',    label: 'From CSV' },
    { k: 'manual', label: 'Manual add' },
    { k: 'scrape', label: 'From web scrape' },
  ];

  async function submit(rows: Array<{ email: string; name?: string; tags?: string[] }>, source: string, tags: string[] = []) {
    if (!rows.length) return { ok: false, reason: 'no_rows' };
    const r = await fetch('/api/marketing/subscribers/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rows, source, tags }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.ok) onImported(j.new_rows ?? []);
    return j;
  }

  return (
    <div style={{ background: PAPER, border: '1px solid ' + HAIRLINE, borderRadius: 4 }}>
      <div style={{ display: 'flex', borderBottom: '1px solid ' + HAIRLINE }}>
        {TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            style={{
              fontSize: 11, padding: '8px 12px', border: 'none',
              background: tab === t.k ? WARM : PAPER,
              color: tab === t.k ? INK : INK_SOFT,
              borderBottom: tab === t.k ? '2px solid ' + BRAND : 'none',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ padding: 12 }}>
        {tab === 'gmail'  && <GmailImportTab candidates={gmailCandidates} submit={submit} />}
        {tab === 'csv'    && <CsvImportTab submit={submit} />}
        {tab === 'manual' && <ManualAddTab submit={submit} />}
        {tab === 'scrape' && <ScrapeListTab events={scrapeEvents} submit={submit} />}
      </div>
    </div>
  );
}

// ─── Gmail import tab ────────────────────────────────────────────
function GmailImportTab({
  candidates, submit,
}: {
  candidates: GmailContactRow[];
  submit: (rows: Array<{email:string;name?:string;tags?:string[]}>, source: string, tags?: string[]) => Promise<{ok?:boolean; error?:string; inserted?:number; updated?:number}>;
}) {
  const [minCount, setMinCount] = useState(2);
  const [domain, setDomain] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const d = domain.trim().toLowerCase();
    return candidates.filter((c) =>
      c.message_count >= minCount
      && (d === '' || c.domain.toLowerCase().includes(d))
    );
  }, [candidates, minCount, domain]);

  async function importSelected() {
    const rows = filtered
      .filter((c) => selected.has(c.email))
      .map((c) => ({ email: c.email, name: c.display_name ?? undefined }));
    if (!rows.length) { setMsg('Select at least one row'); return; }
    setBusy(true);
    const r = await submit(rows, 'gmail_extract', ['from_gmail']);
    setBusy(false);
    if (r.ok) { setMsg(`Imported ${r.inserted ?? 0} new · ${r.updated ?? 0} updated`); setSelected(new Set()); }
    else setMsg('Import failed: ' + (r.error ?? 'unknown'));
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 11, color: INK_SOFT }}>min messages
          <input type="number" min={1} value={minCount} onChange={(e) => setMinCount(Number(e.target.value) || 1)}
            style={{ fontSize: 11, padding: '4px 6px', marginLeft: 4, width: 60, border: '1px solid ' + HAIRLINE, background: PAPER, color: INK }} />
        </label>
        <label style={{ fontSize: 11, color: INK_SOFT }}>domain contains
          <input value={domain} onChange={(e) => setDomain(e.target.value)}
            style={{ fontSize: 11, padding: '4px 6px', marginLeft: 4, width: 140, border: '1px solid ' + HAIRLINE, background: PAPER, color: INK }} />
        </label>
        <button onClick={() => setSelected(new Set(filtered.map((c) => c.email)))} style={buttonBase}>select all ({filtered.length})</button>
        <button onClick={() => setSelected(new Set())} style={buttonBase}>clear</button>
        <button onClick={importSelected} disabled={busy || selected.size === 0} style={buttonPrimary}>
          {busy ? 'Importing…' : 'Import ' + selected.size + ' selected'}
        </button>
      </div>
      {msg && <div style={{ fontSize: 11, color: BRAND, marginBottom: 8 }}>{msg}</div>}
      <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid ' + HAIRLINE, borderRadius: 4 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, background: PAPER }}>
          <thead>
            <tr>
              <th style={{ ...headStyle, width: 30 }}></th>
              <th style={headStyle}>email</th>
              <th style={headStyle}>name</th>
              <th style={headStyle}>domain</th>
              <th style={headStyle}>msgs</th>
              <th style={headStyle}>last seen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((c) => (
              <tr key={c.email}>
                <td style={cellStyle}>
                  <input type="checkbox" checked={selected.has(c.email)} onChange={() => {
                    setSelected((s) => { const n = new Set(s); if (n.has(c.email)) n.delete(c.email); else n.add(c.email); return n; });
                  }} />
                </td>
                <td style={cellStyle}><span style={{ fontFamily: 'monospace' }}>{c.email}</span></td>
                <td style={cellStyle}>{c.display_name ?? '—'}</td>
                <td style={cellStyle}>{c.domain}</td>
                <td style={cellStyle}>{c.message_count}</td>
                <td style={cellStyle}>{fmtDate(c.last_seen_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── CSV import tab ──────────────────────────────────────────────
function CsvImportTab({ submit }: { submit: (rows: Array<{email:string;name?:string;tags?:string[]}>, source: string) => Promise<{ok?:boolean; error?:string; inserted?:number; updated?:number}>; }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Array<{email:string;name?:string;tags?:string[]}>>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function parse() {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) { setPreview([]); return; }
    const header = lines[0].toLowerCase().split(',').map((s) => s.trim());
    const emailIdx = header.indexOf('email');
    const nameIdx  = header.indexOf('name');
    const tagsIdx  = header.indexOf('tags');
    const start = emailIdx >= 0 ? 1 : 0;
    const rows: Array<{email:string;name?:string;tags?:string[]}> = [];
    for (let i = start; i < lines.length; i++) {
      const cols = lines[i].split(',').map((s) => s.trim());
      const email = emailIdx >= 0 ? cols[emailIdx] : cols[0];
      if (!email || !email.includes('@')) continue;
      const name = nameIdx >= 0 ? cols[nameIdx] : undefined;
      const tags = tagsIdx >= 0 && cols[tagsIdx] ? cols[tagsIdx].split('|').map((s) => s.trim()).filter(Boolean) : undefined;
      rows.push({ email, name, tags });
    }
    setPreview(rows);
  }

  async function fileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const t = await f.text();
    setText(t);
  }

  async function commit() {
    if (!preview.length) return;
    setBusy(true);
    const r = await submit(preview, 'csv_upload');
    setBusy(false);
    if (r.ok) { setMsg(`Imported ${r.inserted ?? 0} new · ${r.updated ?? 0} updated`); setPreview([]); setText(''); }
    else setMsg('Import failed: ' + (r.error ?? 'unknown'));
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: INK_SOFT, marginBottom: 6 }}>
        Header row: <code>email,name,tags</code> · tags pipe-separated (e.g. <code>vip|dmc</code>).
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="email,name,tags&#10;jane@company.com,Jane Doe,vip"
        rows={6}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: 11, padding: 8, border: '1px solid ' + HAIRLINE, borderRadius: 4, background: PAPER, color: INK, resize: 'vertical' }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
        <input type="file" accept=".csv,text/csv" onChange={fileChosen} style={{ fontSize: 11 }} />
        <button onClick={parse} style={buttonBase}>Preview</button>
        <button onClick={commit} disabled={busy || preview.length === 0} style={buttonPrimary}>{busy ? 'Importing…' : 'Import ' + preview.length + ' rows'}</button>
      </div>
      {msg && <div style={{ fontSize: 11, color: BRAND, marginTop: 6 }}>{msg}</div>}
      {preview.length > 0 && (
        <div style={{ marginTop: 8, maxHeight: 200, overflow: 'auto', border: '1px solid ' + HAIRLINE, borderRadius: 4 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr><th style={headStyle}>email</th><th style={headStyle}>name</th><th style={headStyle}>tags</th></tr>
            </thead>
            <tbody>
              {preview.slice(0, 50).map((r, i) => (
                <tr key={i}><td style={cellStyle}>{r.email}</td><td style={cellStyle}>{r.name ?? '—'}</td><td style={cellStyle}>{(r.tags ?? []).join(', ')}</td></tr>
              ))}
              {preview.length > 50 && <tr><td colSpan={3} style={{ ...cellStyle, color: INK_SOFT, textAlign: 'center' }}>… {preview.length - 50} more</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Manual add tab ───────────────────────────────────────────────
function ManualAddTab({ submit }: { submit: (rows: Array<{email:string;name?:string;tags?:string[]}>, source: string) => Promise<{ok?:boolean; error?:string; inserted?:number; updated?:number}>; }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function add() {
    if (!email || !email.includes('@')) { setMsg('valid email required'); return; }
    setBusy(true);
    const r = await submit([{ email: email.trim(), name: name.trim() || undefined, tags: tags.split(',').map((s) => s.trim()).filter(Boolean) }], 'manual');
    setBusy(false);
    if (r.ok) { setMsg('Added.'); setEmail(''); setName(''); setTags(''); }
    else setMsg('Failed: ' + (r.error ?? 'unknown'));
  }

  const input: React.CSSProperties = { fontSize: 12, padding: '6px 8px', border: '1px solid ' + HAIRLINE, borderRadius: 4, background: PAPER, color: INK, width: '100%' };

  return (
    <div style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
      <label style={{ fontSize: 11, color: INK_SOFT }}>email
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" style={input} />
      </label>
      <label style={{ fontSize: 11, color: INK_SOFT }}>name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" style={input} />
      </label>
      <label style={{ fontSize: 11, color: INK_SOFT }}>tags · comma-separated
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vip, wedding" style={input} />
      </label>
      <div>
        <button onClick={add} disabled={busy} style={buttonPrimary}>{busy ? 'Adding…' : 'Add subscriber'}</button>
      </div>
      {msg && <div style={{ fontSize: 11, color: BRAND }}>{msg}</div>}
    </div>
  );
}

// ─── Web scrape list tab ──────────────────────────────────────────
function ScrapeListTab({
  events, submit,
}: {
  events: ScrapeEventRow[];
  submit: (rows: Array<{email:string;name?:string;tags?:string[]}>, source: string, tags?: string[]) => Promise<{ok?:boolean; error?:string; inserted?:number; updated?:number}>;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function importAll(ev: ScrapeEventRow) {
    if (!ev.emails_found?.length) return;
    setBusyId(ev.id);
    const rows = ev.emails_found.map((e) => ({ email: e }));
    const tags = ['from_scrape', ...(ev.tags ?? [])];
    const r = await submit(rows, 'web_scrape', tags);
    setBusyId(null);
    if (r.ok) setMsg(`Imported ${r.inserted ?? 0} new · ${r.updated ?? 0} updated from ${ev.title ?? ev.url}`);
    else setMsg('Import failed: ' + (r.error ?? 'unknown'));
  }

  if (!events.length) {
    return (
      <div style={{ fontSize: 12, color: INK_SOFT, padding: 8 }}>
        No web scrapes yet. Install the <a href="/marketing/subscribers/bookmarklet" style={{ color: BRAND }}>bookmarklet</a> to capture contacts from any site.
      </div>
    );
  }

  return (
    <div>
      {msg && <div style={{ fontSize: 11, color: BRAND, marginBottom: 8 }}>{msg}</div>}
      <div style={{ display: 'grid', gap: 6 }}>
        {events.map((ev) => (
          <div key={ev.id} style={{ padding: 8, border: '1px solid ' + HAIRLINE, borderRadius: 4, background: PAPER }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <a href={ev.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: BRAND, fontWeight: 600, textDecoration: 'none', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ev.title ?? ev.url}
              </a>
              <span style={{ fontSize: 10, color: INK_SOFT }}>{fmtDT(ev.created_at)}</span>
              <span style={{ fontSize: 10, padding: '1px 6px', background: WARM, border: '1px solid ' + HAIRLINE, borderRadius: 10 }}>
                {ev.target}
              </span>
            </div>
            {ev.summary && <div style={{ fontSize: 11, color: INK_SOFT, marginTop: 4 }}>{ev.summary}</div>}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: INK_SOFT }}>{ev.emails_found?.length ?? 0} emails:</span>
              {(ev.emails_found ?? []).slice(0, 6).map((e) => (
                <span key={e} style={{ fontFamily: 'monospace', fontSize: 10, padding: '1px 4px', background: WARM, borderRadius: 2 }}>{e}</span>
              ))}
              {(ev.emails_found?.length ?? 0) > 6 && (
                <span style={{ fontSize: 10, color: INK_SOFT }}>+ {(ev.emails_found?.length ?? 0) - 6} more</span>
              )}
            </div>
            {(ev.emails_found?.length ?? 0) > 0 && (
              <button
                onClick={() => importAll(ev)}
                disabled={busyId === ev.id}
                style={{ ...buttonBase, marginTop: 6 }}
              >
                {busyId === ev.id ? 'Importing…' : `Add all ${ev.emails_found?.length ?? 0} to subscribers`}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
