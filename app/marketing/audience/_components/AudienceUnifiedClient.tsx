'use client';
// app/marketing/audience/_components/AudienceUnifiedClient.tsx
// PBS 2026-07-21 · Phase 2 unified audience directory.
// One table for subscribers + prospects · KPI headline strip · scrape embed ·
// filters (source / status / MX / group) · search · bulk group assign (subscribers only).
// Design: paper white #FFFFFF, hairline #E6DFCC — no var(--paper-warm).
//
// 2026-07-21 · Audience settings feature additions:
//   1. Group multi-select filter (UNION semantics)
//   2. Per-row Delete button (soft-delete → auto blocklist via trigger)
//   3. Sortable column headers (asc/desc, default created_at desc)

import { useCallback, useMemo, useState, useTransition } from 'react';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_S  = '#5A5A5A';
const BRAND  = '#084838';
const WARM   = '#F5F0E1';
const RED    = '#B03826';

export interface AudienceRow {
  audience_id: string;              // 'subscriber:123' | 'prospect:<uuid>'
  source: 'subscriber' | 'prospect';
  email: string;
  name: string | null;
  company: string | null;
  country: string | null;
  lifecycle_stage: string | null;
  opted_in_at: string | null;
  unsubscribed_at: string | null;
  bounced_at: string | null;
  tags: string[] | null;
  groups: string[] | null;
  mx_valid: boolean | null;
  booking_count: number | null;
  is_pinned: boolean;
  ingest_source: string | null;
  created_at: string | null;
  updated_at: string | null;
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

type SourceFilter = 'all' | 'subscribers' | 'prospects';
type StatusFilter = 'any' | 'active' | 'pending' | 'unsub' | 'bounced';
type MxFilter = 'any' | 'valid' | 'invalid';
type TabKey = 'table' | 'scrape';

type SortKey = 'email' | 'name' | 'country' | 'group' | 'source' | 'created_at' | 'opted_in_at';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 50;

interface Props {
  initialRows: AudienceRow[];
  initialGroups: GroupRow[];
  initialSource: SourceFilter;
  initialTab: TabKey;
}

export default function AudienceUnifiedClient({
  initialRows, initialGroups, initialSource, initialTab,
}: Props) {
  const [rows, setRows] = useState<AudienceRow[]>(initialRows);
  const [groups, setGroups] = useState<GroupRow[]>(initialGroups);
  const [tab, setTab] = useState<TabKey>(initialTab);

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(initialSource);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('any');
  const [mxFilter, setMxFilter]         = useState<MxFilter>('any');
  const [groupFilters, setGroupFilters] = useState<string[]>([]);  // multi-select UNION
  const [groupDdOpen, setGroupDdOpen]   = useState(false);
  const [query, setQuery]               = useState('');
  const [page, setPage]                 = useState(0);
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [msg, setMsg]                   = useState<string | null>(null);
  const [busy, startTransition]         = useTransition();

  // Sort state (default: created_at desc → newest first)
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const toggleSort = (k: SortKey) => {
    setSortKey((prev) => {
      if (prev === k) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(k === 'created_at' || k === 'opted_in_at' ? 'desc' : 'asc');
      return k;
    });
    setPage(0);
  };

  // Scrape embed state (simple: leads_finder actor)
  const [scrapeOpen, setScrapeOpen]     = useState(initialTab === 'scrape');
  const [scrapeKeywords, setScrapeKeywords] = useState('luxury travel\ntour operator');
  const [scrapeRoles, setScrapeRoles]   = useState('Marketing Director\nCEO');
  const [scrapeCountry, setScrapeCountry] = useState('');
  const [scrapeTagHint, setScrapeTagHint] = useState('');
  const [scrapeMax, setScrapeMax]       = useState(30);
  const [scrapeResult, setScrapeResult] = useState<{ok:boolean; msg:string} | null>(null);
  const [scrapeRunning, setScrapeRunning] = useState(false);

  const totalCount = rows.length;
  const subCount   = useMemo(() => rows.filter(r => r.source === 'subscriber').length, [rows]);
  const proCount   = useMemo(() => rows.filter(r => r.source === 'prospect').length, [rows]);

  // Per-group counts across the whole dataset (subscribers only currently carry groups)
  const groupCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) for (const g of r.groups ?? []) m[g] = (m[g] ?? 0) + 1;
    return m;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groupSet = new Set(groupFilters);
    const filteredRows = rows.filter((r) => {
      if (sourceFilter === 'subscribers' && r.source !== 'subscriber') return false;
      if (sourceFilter === 'prospects' && r.source !== 'prospect') return false;
      if (r.source === 'subscriber') {
        if (statusFilter === 'active'  && !(r.opted_in_at && !r.unsubscribed_at)) return false;
        if (statusFilter === 'pending' && !(!r.opted_in_at && !r.unsubscribed_at)) return false;
        if (statusFilter === 'unsub'   && !r.unsubscribed_at) return false;
        if (statusFilter === 'bounced' && !r.bounced_at) return false;
      } else {
        // Status filter is subscribers-only. When active on prospect view, hide prospects.
        if (statusFilter !== 'any' && sourceFilter !== 'prospects') return false;
      }
      if (r.source === 'prospect') {
        if (mxFilter === 'valid' && r.mx_valid !== true) return false;
        if (mxFilter === 'invalid' && r.mx_valid !== false) return false;
      } else {
        if (mxFilter !== 'any' && sourceFilter !== 'subscribers') return false;
      }
      // Multi-group UNION: row matches if it belongs to ANY selected group
      if (groupSet.size > 0) {
        const rg = r.groups ?? [];
        let hit = false;
        for (const g of rg) { if (groupSet.has(g)) { hit = true; break; } }
        if (!hit) return false;
      }
      if (q) {
        const hay = (r.email + ' ' + (r.name ?? '') + ' ' + (r.company ?? '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // Sort
    const dir = sortDir === 'asc' ? 1 : -1;
    const cmpStr = (a: string | null | undefined, b: string | null | undefined) => {
      const A = (a ?? '').toLowerCase(); const B = (b ?? '').toLowerCase();
      if (A < B) return -1 * dir; if (A > B) return 1 * dir; return 0;
    };
    filteredRows.sort((a, b) => {
      switch (sortKey) {
        case 'email':   return cmpStr(a.email, b.email);
        case 'name':    return cmpStr(a.name, b.name);
        case 'country': return cmpStr(a.country, b.country);
        case 'source':  return cmpStr(a.source, b.source);
        case 'group': {
          const aG = (a.groups ?? []).slice().sort().join(',');
          const bG = (b.groups ?? []).slice().sort().join(',');
          return cmpStr(aG, bG);
        }
        case 'opted_in_at': return cmpStr(a.opted_in_at, b.opted_in_at);
        case 'created_at':
        default:            return cmpStr(a.created_at, b.created_at);
      }
    });
    return filteredRows;
  }, [rows, sourceFilter, statusFilter, mxFilter, groupFilters, query, sortKey, sortDir]);

  const paged = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const toggleRow = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleAllOnPage = () => {
    setSelected((s) => {
      const n = new Set(s);
      const allSelected = paged.every((r) => n.has(r.audience_id));
      for (const r of paged) { if (allSelected) n.delete(r.audience_id); else n.add(r.audience_id); }
      return n;
    });
  };

  // Only subscriber rows are actionable for group assign (prospects unsupported yet).
  const selectedSubscriberIds = useMemo(() => {
    const ids: number[] = [];
    for (const id of selected) {
      if (id.startsWith('subscriber:')) {
        const n = Number(id.slice('subscriber:'.length));
        if (Number.isFinite(n)) ids.push(n);
      }
    }
    return ids;
  }, [selected]);

  const refreshGroups = useCallback(async () => {
    const r = await fetch('/api/marketing/subscribers/groups', { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (j.ok && Array.isArray(j.groups)) setGroups(j.groups as GroupRow[]);
  }, []);

  const doBulkAssignGroup = useCallback((groupId: string) => {
    const ids = selectedSubscriberIds;
    const g = groups.find((x) => x.id === groupId);
    if (!ids.length || !g) { setMsg('Select subscriber rows first (prospects not supported yet).'); return; }
    startTransition(async () => {
      const r = await fetch('/api/marketing/subscribers/groups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'assign', subscriber_ids: ids, group_id: groupId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { setMsg('Assign failed: ' + (j.error ?? 'unknown')); return; }
      setMsg(`Assigned ${j.affected ?? ids.length} subscribers to ${g.name}. Refresh to see chips.`);
      refreshGroups();
    });
  }, [selectedSubscriberIds, groups, refreshGroups]);

  const doBulkUnsubscribe = useCallback(() => {
    const ids = selectedSubscriberIds;
    if (!ids.length) { setMsg('Select subscriber rows first.'); return; }
    if (!confirm(`Unsubscribe ${ids.length} subscribers? This sets unsubscribed_at.`)) return;
    startTransition(async () => {
      const r = await fetch('/api/marketing/subscribers/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'unsubscribe', subscriber_ids: ids }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { setMsg('Unsubscribe failed: ' + (j.error ?? 'unknown')); return; }
      setMsg(`Unsubscribed ${j.affected ?? ids.length}. Refresh to see status.`);
    });
  }, [selectedSubscriberIds]);

  const doDeleteRow = useCallback((row: AudienceRow) => {
    if (row.source !== 'subscriber') {
      setMsg('Delete only supported on subscriber rows (prospects coming soon).');
      return;
    }
    if (!confirm(`Delete ${row.email} and add to blocklist forever?`)) return;
    startTransition(async () => {
      const r = await fetch('/api/marketing/audience/subscriber-delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ audience_id: row.audience_id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { setMsg('Delete failed: ' + (j.error ?? 'unknown')); return; }
      setRows((prev) => prev.filter((x) => x.audience_id !== row.audience_id));
      setSelected((s) => {
        if (!s.has(row.audience_id)) return s;
        const n = new Set(s); n.delete(row.audience_id); return n;
      });
      setMsg(`Deleted ${row.email} · added to blocklist.`);
    });
  }, []);

  const exportCsv = () => {
    const target = selected.size ? filtered.filter(r => selected.has(r.audience_id)) : filtered;
    const header = ['audience_id','source','email','name','company','country','lifecycle_stage','opted_in_at','unsubscribed_at','bounced_at','mx_valid','booking_count','groups','tags','ingest_source','created_at'];
    const lines = [header.join(',')];
    for (const r of target) {
      const row = [
        r.audience_id, r.source, r.email, r.name ?? '', r.company ?? '', r.country ?? '',
        r.lifecycle_stage ?? '',
        r.opted_in_at ?? '', r.unsubscribed_at ?? '', r.bounced_at ?? '',
        r.mx_valid === null ? '' : String(r.mx_valid),
        r.booking_count == null ? '' : String(r.booking_count),
        (r.groups ?? []).join('|'), (r.tags ?? []).join('|'),
        r.ingest_source ?? '', r.created_at ?? '',
      ].map((v) => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      });
      lines.push(row.join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `audience-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const runScrape = async () => {
    setScrapeRunning(true);
    setScrapeResult(null);
    try {
      const keywords = scrapeKeywords.split('\n').map((s) => s.trim()).filter(Boolean);
      const roles    = scrapeRoles.split('\n').map((s) => s.trim()).filter(Boolean);
      const input: Record<string, unknown> = {
        job_titles: roles, keywords, max_records: scrapeMax,
      };
      if (scrapeCountry.trim()) input.country = scrapeCountry.trim();
      const r = await fetch('/api/marketing/prospects/scrape', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actor: 'leads_finder', input, tag_hint: scrapeTagHint || undefined }),
      });
      const j = await r.json();
      if (j.ok) setScrapeResult({ ok: true, msg: `Scrape ok: ${j.items_returned} items, ${j.inserted} inserted, ${j.skipped} skipped, ${j.duration_ms}ms. Refresh to see them in the table.` });
      else       setScrapeResult({ ok: false, msg: `Scrape failed: ${j.error ?? 'unknown'} — ${j.detail ?? ''}` });
    } catch (e) {
      setScrapeResult({ ok: false, msg: `Scrape error: ${(e as Error).message}` });
    } finally {
      setScrapeRunning(false);
    }
  };

  const toggleGroupFilter = (slug: string) => {
    setGroupFilters((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]);
    setPage(0);
  };
  const resetGroupFilters = () => { setGroupFilters([]); setPage(0); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI headline strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <KpiCell label="Total people" value={totalCount} highlight />
        <KpiCell label="Subscribers"  value={subCount}   onClick={() => { setSourceFilter('subscribers'); setPage(0); }} />
        <KpiCell label="Prospects"    value={proCount}   onClick={() => { setSourceFilter('prospects');   setPage(0); }} />
        {groups.map((g) => (
          <KpiCell
            key={g.id}
            label={g.name}
            value={groupCounts[g.slug] ?? g.member_count ?? 0}
            color={g.color}
            onClick={() => toggleGroupFilter(g.slug)}
            active={groupFilters.includes(g.slug)}
          />
        ))}
      </div>

      {/* Scrape embed */}
      <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4 }}>
        <button
          onClick={() => setScrapeOpen((v) => !v)}
          style={{
            width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent',
            border: 'none', cursor: 'pointer', color: INK, fontSize: 13, fontWeight: 600,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>{scrapeOpen ? '▼' : '▶'} Start scraping engine</span>
          <span style={{ fontSize: 11, color: INK_S, fontWeight: 400 }}>
            leads_finder actor · results land in prospects
          </span>
        </button>
        {scrapeOpen && (
          <div style={{ padding: 16, borderTop: `1px solid ${HAIR}`, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <label style={{ fontSize: 11, color: INK_S }}>
              Keywords (one per line)
              <textarea value={scrapeKeywords} onChange={(e) => setScrapeKeywords(e.target.value)}
                rows={3} style={inputStyle} />
            </label>
            <label style={{ fontSize: 11, color: INK_S }}>
              Job titles / roles (one per line)
              <textarea value={scrapeRoles} onChange={(e) => setScrapeRoles(e.target.value)}
                rows={3} style={inputStyle} />
            </label>
            <label style={{ fontSize: 11, color: INK_S }}>
              Country (optional)
              <input value={scrapeCountry} onChange={(e) => setScrapeCountry(e.target.value)}
                placeholder="United States" style={inputStyle as React.CSSProperties} />
            </label>
            <label style={{ fontSize: 11, color: INK_S }}>
              Tag hint (chip applied to imported rows)
              <input value={scrapeTagHint} onChange={(e) => setScrapeTagHint(e.target.value)}
                placeholder="wave-2026-07" style={inputStyle as React.CSSProperties} />
            </label>
            <label style={{ fontSize: 11, color: INK_S }}>
              Max records
              <input type="number" min={1} max={500} value={scrapeMax}
                onChange={(e) => setScrapeMax(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                style={inputStyle as React.CSSProperties} />
            </label>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={runScrape} disabled={scrapeRunning}
                style={{
                  padding: '8px 14px', background: BRAND, color: WHITE, border: 'none',
                  borderRadius: 3, cursor: scrapeRunning ? 'wait' : 'pointer', fontSize: 12, fontWeight: 600,
                }}
              >
                {scrapeRunning ? 'Scraping…' : 'Scrape'}
              </button>
              <a href="/marketing/prospects/sequences" style={{ fontSize: 11, color: BRAND, textDecoration: 'none' }}>
                → Advanced actors (7 pipelines)
              </a>
            </div>
            {scrapeResult && (
              <div style={{
                gridColumn: '1 / -1',
                padding: 10, borderRadius: 3, fontSize: 12,
                background: scrapeResult.ok ? '#EEF7F0' : '#FBEDE7',
                color: scrapeResult.ok ? BRAND : '#B04A2F',
              }}>{scrapeResult.msg}</div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <FilterGroup label="Source">
          {(['all','subscribers','prospects'] as SourceFilter[]).map((k) => (
            <FilterChip key={k} active={sourceFilter === k} onClick={() => { setSourceFilter(k); setPage(0); }}>
              {k}
            </FilterChip>
          ))}
        </FilterGroup>
        <FilterGroup label="Status (subs)">
          {(['any','active','pending','unsub','bounced'] as StatusFilter[]).map((k) => (
            <FilterChip key={k} active={statusFilter === k} onClick={() => { setStatusFilter(k); setPage(0); }}>
              {k}
            </FilterChip>
          ))}
        </FilterGroup>
        <FilterGroup label="MX (prospects)">
          {(['any','valid','invalid'] as MxFilter[]).map((k) => (
            <FilterChip key={k} active={mxFilter === k} onClick={() => { setMxFilter(k); setPage(0); }}>
              {k}
            </FilterChip>
          ))}
        </FilterGroup>

        {/* Group multi-select dropdown */}
        <FilterGroup label="Groups">
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setGroupDdOpen((v) => !v)}
              style={{
                padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                background: groupFilters.length ? BRAND : WHITE,
                color: groupFilters.length ? WHITE : INK,
                border: `1px solid ${groupFilters.length ? BRAND : HAIR}`, borderRadius: 3,
              }}
            >
              {groupFilters.length ? `${groupFilters.length} selected` : 'Any group'} {groupDdOpen ? '▲' : '▼'}
            </button>
            {groupDdOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 10,
                background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 3,
                padding: 8, minWidth: 240, maxHeight: 320, overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: INK_S, textTransform: 'uppercase', letterSpacing: 0.4 }}>Union · in ANY selected</span>
                  <button
                    onClick={resetGroupFilters}
                    style={{ fontSize: 10, color: BRAND, background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >Reset</button>
                </div>
                {groups.map((g) => {
                  const checked = groupFilters.includes(g.slug);
                  return (
                    <label key={g.id} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
                      fontSize: 12, color: INK, cursor: 'pointer',
                      background: checked ? WARM : 'transparent', borderRadius: 3,
                    }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleGroupFilter(g.slug)} />
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: g.color, display: 'inline-block' }} />
                      <span style={{ flex: 1 }}>{g.name}</span>
                      <span style={{ fontSize: 10, color: INK_S }}>{groupCounts[g.slug] ?? g.member_count ?? 0}</span>
                    </label>
                  );
                })}
                {groups.length === 0 && (
                  <div style={{ fontSize: 11, color: INK_S, padding: 6 }}>No groups defined.</div>
                )}
              </div>
            )}
          </div>
        </FilterGroup>

        {groupFilters.length > 0 && (
          <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
            {groupFilters.map((slug) => {
              const g = groups.find((x) => x.slug === slug);
              return (
                <span key={slug} style={{
                  padding: '3px 8px', background: g?.color ?? INK_S, color: WHITE,
                  borderRadius: 3, fontSize: 10, display: 'inline-flex', gap: 4, alignItems: 'center',
                }}>
                  {g?.name ?? slug}
                  <button onClick={() => toggleGroupFilter(slug)} style={{ background: 'transparent', border: 'none', color: WHITE, cursor: 'pointer', padding: 0, fontSize: 10 }}>✕</button>
                </span>
              );
            })}
          </div>
        )}

        <input
          value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }}
          placeholder="Search email · name · company"
          style={{
            padding: '6px 10px', border: `1px solid ${HAIR}`, borderRadius: 3,
            background: WHITE, color: INK, fontSize: 12, minWidth: 240,
          }}
        />
        <div style={{ marginLeft: 'auto', fontSize: 11, color: INK_S }}>
          {filtered.length.toLocaleString()} rows · page {page + 1} / {totalPages}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
          padding: '8px 12px', background: WARM, border: `1px solid ${HAIR}`, borderRadius: 3,
        }}>
          <span style={{ fontSize: 12, color: INK, fontWeight: 600 }}>
            {selected.size} selected ({selectedSubscriberIds.length} subscribers actionable)
          </span>
          <select
            onChange={(e) => { if (e.target.value) doBulkAssignGroup(e.target.value); e.target.value = ''; }}
            disabled={busy || selectedSubscriberIds.length === 0}
            title={selectedSubscriberIds.length === 0 ? 'Groups on prospects coming soon' : ''}
            style={selectStyle}
          >
            <option value="">Assign to group…</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button
            onClick={doBulkUnsubscribe} disabled={busy || selectedSubscriberIds.length === 0}
            style={btnStyle}
          >Unsubscribe (subs)</button>
          <button onClick={exportCsv} style={btnStyle}>Export CSV</button>
          <button onClick={() => setSelected(new Set())} style={{ ...btnStyle, background: 'transparent', color: INK_S }}>
            Clear
          </button>
        </div>
      )}

      {msg && (
        <div style={{ padding: 8, background: WARM, border: `1px solid ${HAIR}`, borderRadius: 3, fontSize: 12, color: INK }}>
          {msg}
        </div>
      )}

      {/* Table */}
      <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: INK }}>
          <thead>
            <tr style={{ background: WARM }}>
              <th style={thStyle}>
                <input
                  type="checkbox"
                  checked={paged.length > 0 && paged.every((r) => selected.has(r.audience_id))}
                  onChange={toggleAllOnPage}
                />
              </th>
              <SortHeader label="Email"     k="email"       cur={sortKey} dir={sortDir} on={toggleSort} />
              <SortHeader label="Name"      k="name"        cur={sortKey} dir={sortDir} on={toggleSort} />
              <th style={thStyle}>Company</th>
              <SortHeader label="Source"    k="source"      cur={sortKey} dir={sortDir} on={toggleSort} />
              <th style={thStyle}>Lifecycle</th>
              <SortHeader label="Groups"    k="group"       cur={sortKey} dir={sortDir} on={toggleSort} />
              <SortHeader label="Opted in"  k="opted_in_at" cur={sortKey} dir={sortDir} on={toggleSort} />
              <SortHeader label="Created"   k="created_at"  cur={sortKey} dir={sortDir} on={toggleSort} />
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => (
              <tr key={r.audience_id} style={{ borderTop: `1px solid ${HAIR}` }}>
                <td style={tdStyle}>
                  <input type="checkbox" checked={selected.has(r.audience_id)} onChange={() => toggleRow(r.audience_id)} />
                </td>
                <td style={tdStyle}>
                  {r.email}
                  {r.is_pinned && <span style={{ marginLeft: 6, color: BRAND }}>★</span>}
                  {r.source === 'subscriber' && r.bounced_at && <span style={{ marginLeft: 6, color: '#B04A2F', fontSize: 10 }}>bounced</span>}
                </td>
                <td style={tdStyle}>{r.name ?? '—'}</td>
                <td style={tdStyle}>{r.company ?? '—'}</td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '2px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                    background: r.source === 'subscriber' ? '#EEF7F0' : '#F5EEDC',
                    color:      r.source === 'subscriber' ? BRAND : '#8A6A2E',
                  }}>{r.source}</span>
                </td>
                <td style={tdStyle}>{r.lifecycle_stage ?? '—'}</td>
                <td style={tdStyle}>
                  {(r.groups ?? []).length === 0 ? '—' : (r.groups ?? []).map((slug) => {
                    const g = groups.find((x) => x.slug === slug);
                    return (
                      <span key={slug} style={{
                        display: 'inline-block', marginRight: 4, marginBottom: 2,
                        padding: '1px 6px', borderRadius: 3, fontSize: 10,
                        background: g?.color ?? HAIR, color: WHITE,
                      }}>{g?.name ?? slug}</span>
                    );
                  })}
                </td>
                <td style={tdStyle}>{fmtDate(r.opted_in_at)}</td>
                <td style={tdStyle}>{fmtDate(r.created_at)}</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <a href={`/marketing/prospects/sequences?email=${encodeURIComponent(r.email)}`}
                       style={{ fontSize: 11, color: BRAND, textDecoration: 'none' }}>
                      → Sequence
                    </a>
                    {r.source === 'subscriber' && (
                      <button
                        onClick={() => doDeleteRow(r)}
                        disabled={busy}
                        title="Delete + auto-add to blocklist"
                        style={{
                          padding: '2px 8px', background: WHITE, color: RED,
                          border: `1px solid ${RED}`, borderRadius: 3,
                          fontSize: 10, cursor: 'pointer',
                        }}
                      >Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={10} style={{ ...tdStyle, textAlign: 'center', color: INK_S, padding: 24 }}>
                No rows match filters.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
          <button style={btnStyle} disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>← Prev</button>
          <span style={{ fontSize: 11, color: INK_S }}>Page {page + 1} / {totalPages}</span>
          <button style={btnStyle} disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>Next →</button>
        </div>
      )}

      {/* silence unused warnings */}
      <span style={{ display: 'none' }}>{String(tab)}{String(setTab)}</span>
    </div>
  );
}

// ---------- helpers ----------
function fmtDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 4,
  padding: '6px 8px', border: `1px solid ${HAIR}`, borderRadius: 3,
  background: WHITE, color: INK, fontSize: 12,
};
const btnStyle: React.CSSProperties = {
  padding: '6px 12px', background: WHITE, color: INK, border: `1px solid ${HAIR}`,
  borderRadius: 3, fontSize: 12, cursor: 'pointer',
};
const selectStyle: React.CSSProperties = { ...btnStyle, background: WHITE };
const thStyle: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: INK_S, borderBottom: `1px solid ${HAIR}` };
const tdStyle: React.CSSProperties = { padding: '8px 10px', verticalAlign: 'top' };

function SortHeader({ label, k, cur, dir, on }: {
  label: string; k: SortKey; cur: SortKey; dir: SortDir; on: (k: SortKey) => void;
}) {
  const active = cur === k;
  return (
    <th
      onClick={() => on(k)}
      style={{ ...thStyle, cursor: 'pointer', userSelect: 'none', color: active ? INK : INK_S }}
      title={`Sort by ${label}`}
    >
      {label} {active ? (dir === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.35 }}>↕</span>}
    </th>
  );
}

// KpiCell — inline KPI tile matching Namkhan paper-white tokens.
function KpiCell(props: {
  label: string; value: number | string;
  color?: string; onClick?: () => void; active?: boolean; highlight?: boolean;
}) {
  const border = props.active ? BRAND : HAIR;
  return (
    <div
      onClick={props.onClick}
      style={{
        padding: 10, background: WHITE, border: `1px solid ${border}`, borderRadius: 4,
        cursor: props.onClick ? 'pointer' : 'default',
        outline: props.highlight ? `2px solid ${BRAND}` : 'none',
      }}
    >
      <div style={{ fontSize: 10, color: INK_S, textTransform: 'uppercase', letterSpacing: 0.4, display: 'flex', alignItems: 'center', gap: 6 }}>
        {props.color && <span style={{ width: 8, height: 8, borderRadius: 2, background: props.color, display: 'inline-block' }} />}
        {props.label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 600, color: INK, marginTop: 4 }}>
        {typeof props.value === 'number' ? props.value.toLocaleString() : props.value}
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, color: INK_S, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      <div style={{ display: 'flex', gap: 2 }}>{children}</div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', fontSize: 11, cursor: 'pointer',
      background: active ? BRAND : WHITE, color: active ? WHITE : INK,
      border: `1px solid ${active ? BRAND : HAIR}`, borderRadius: 3,
    }}>{children}</button>
  );
}
