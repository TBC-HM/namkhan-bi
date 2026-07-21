'use client';
// app/marketing/audience/_components/AudienceUnifiedClient.tsx
// PBS 2026-07-21 · Phase 2 unified audience directory.
// One table for subscribers + prospects · KPI headline strip · scrape embed ·
// filters (source / status / MX / group) · search · bulk group assign (subscribers only).
// Design: paper white #FFFFFF, hairline #E6DFCC — no var(--paper-warm).

import { useCallback, useMemo, useState, useTransition } from 'react';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_S  = '#5A5A5A';
const BRAND  = '#084838';
const WARM   = '#F5F0E1';

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

// Authoritative tile counts from public.v_marketing_audience_tiles.
// Independent of the 3000-row rows[] sample so the headline strip never looks stale.
export interface AudienceTiles {
  total_subs: number;
  mailable: number;
  guests: number;
  returning_guests: number;
  dmc: number;
  responders: number;
  prospects: number;
}

type SourceFilter = 'all' | 'subscribers' | 'prospects';
type StatusFilter = 'any' | 'active' | 'pending' | 'unsub' | 'bounced';
type MxFilter = 'any' | 'valid' | 'invalid';
type TabKey = 'table' | 'scrape';

const PAGE_SIZE = 50;

interface Props {
  initialRows: AudienceRow[];
  initialGroups: GroupRow[];
  initialSource: SourceFilter;
  initialTab: TabKey;
  initialTiles: AudienceTiles;
}

export default function AudienceUnifiedClient({
  initialRows, initialGroups, initialSource, initialTab, initialTiles,
}: Props) {
  const [rows] = useState<AudienceRow[]>(initialRows);
  const [groups, setGroups] = useState<GroupRow[]>(initialGroups);
  const [tab, setTab] = useState<TabKey>(initialTab);

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(initialSource);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('any');
  const [mxFilter, setMxFilter]         = useState<MxFilter>('any');
  const [groupFilter, setGroupFilter]   = useState<string | null>(null);
  const [query, setQuery]               = useState('');
  const [page, setPage]                 = useState(0);
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [msg, setMsg]                   = useState<string | null>(null);
  const [busy, startTransition]         = useTransition();

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
    return rows.filter((r) => {
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
      if (groupFilter && !(r.groups ?? []).includes(groupFilter)) return false;
      if (q) {
        const hay = (r.email + ' ' + (r.name ?? '') + ' ' + (r.company ?? '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, sourceFilter, statusFilter, mxFilter, groupFilter, query]);

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

  const resetFilters = () => {
    setSourceFilter('all'); setStatusFilter('any'); setMxFilter('any');
    setGroupFilter(null); setQuery(''); setPage(0);
  };
  const setGroupOnly = (slug: string) => {
    setSourceFilter('all'); setStatusFilter('any'); setMxFilter('any');
    setGroupFilter(slug); setPage(0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Authoritative headline tiles — DB-sourced, always fresh */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
        <TileCompact label="Total"           value={initialTiles.total_subs}       onClick={resetFilters} />
        <TileCompact label="Mailable"        value={initialTiles.mailable}         onClick={resetFilters} />
        <TileCompact label="Guests"          value={initialTiles.guests}           onClick={() => setGroupOnly('guests')}           active={groupFilter === 'guests'} />
        <TileCompact label="Returning Guests" value={initialTiles.returning_guests} onClick={() => setGroupOnly('returning-guests')} active={groupFilter === 'returning-guests'} />
        <TileCompact label="DMC Contracted" value={initialTiles.dmc}               onClick={() => setGroupOnly('dmc-contracted')}   active={groupFilter === 'dmc-contracted'} />
        <TileCompact label="Prospects"       value={initialTiles.prospects}        onClick={() => { setSourceFilter('prospects'); setPage(0); }} active={sourceFilter === 'prospects'} />
        <TileCompact label="Responders"      value={initialTiles.responders}       onClick={() => setGroupOnly('responders')}       active={groupFilter === 'responders'} />
      </div>

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
            onClick={() => { setGroupFilter((cur) => (cur === g.slug ? null : g.slug)); setPage(0); }}
            active={groupFilter === g.slug}
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
        {groupFilter && (
          <FilterChip active onClick={() => setGroupFilter(null)}>
            Group: {groupFilter} ✕
          </FilterChip>
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
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Company</th>
              <th style={thStyle}>Source</th>
              <th style={thStyle}>Lifecycle</th>
              <th style={thStyle}>Groups</th>
              <th style={thStyle}>Opted in</th>
              <th style={thStyle}>Created</th>
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
                  <a href={`/marketing/prospects/sequences?email=${encodeURIComponent(r.email)}`}
                     style={{ fontSize: 11, color: BRAND, textDecoration: 'none' }}>
                    → Sequence
                  </a>
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

// TileCompact — small headline tile (22px number, 10px uppercase label).
// Renders authoritative DB counts above the derived KpiCell strip.
function TileCompact(props: {
  label: string; value: number; onClick?: () => void; active?: boolean;
}) {
  const border = props.active ? BRAND : HAIR;
  return (
    <div
      onClick={props.onClick}
      style={{
        padding: '10px 12px', background: WHITE, border: `1px solid ${border}`, borderRadius: 4,
        cursor: props.onClick ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}
    >
      <div style={{ fontSize: 10, color: INK_S, textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {props.label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: INK, lineHeight: 1 }}>
        {props.value.toLocaleString()}
      </div>
    </div>
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