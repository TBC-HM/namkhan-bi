'use client';
// app/marketing/audience/_components/AudienceUnifiedClient.tsx
// PBS 2026-07-21 · Phase 2 unified audience directory.
// One table for subscribers + prospects · KPI headline strip · scrape embed ·
// filters (source / status / MX / group multi-select) · search · bulk group assign (subscribers only).
// Design: paper white #FFFFFF, hairline #E6DFCC — no var(--paper-warm).
//
// 2026-07-21 pm · Restore group multi-select dropdown regression (Bug 1). Keeps the
// authoritative TileCompact headline strip introduced by 97d2d6f2, but brings back
// the top group multi-select filter with UNASSIGNED sentinel and dismissible chips.
// Also extends AudienceTiles with purged_bounced + purged_unsubscribed so the tile
// row shows the auto-purge status alongside the mailable universe.
//
// 2026-07-22 · Newsletter Module §12 backlog items 8 + 1 (course-corrected).
//   Item 8 (real bug): dropdown counts + group-filter membership both worked
//     off the 1000-row initial payload (PostgREST db-max-rows cap). Screenshot
//     showed Guests=1000 (capped), Returning=59, OTA Traveller=2, and picking
//     DMC Contracted (13 real members, all past row 1000) returned zero rows.
//     Fix (a) dropdown labels + tile-adjacent counts now prefer
//     v_subscriber_groups.member_count (DB truth) over the client-derived
//     groupCounts fallback; (b) selecting a real group triggers a scoped
//     browser-anon fetch against v_marketing_audience with groups=cs.{slug}
//     so DMC members that live past row 1000 are pulled into the view.
//     Server pagination stays as-is — no 4,384-row client load.
//   Item 1: per-row Newsletter + Sequence action buttons. Each opens a small
//     Drawer picker for scheduled campaigns / active funnels. Enrollment wires
//     to public RPCs fn_campaign_recipient_add_one (p_campaign_id uuid,
//     p_audience_id text) and fn_funnel_enroll_one (p_funnel_key text,
//     p_audience_id text) — both resolve subscriber:{id} internally.

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Drawer } from '@/app/(cockpit)/_design';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_S  = '#5A5A5A';
const BRAND  = '#084838';
const WARM   = '#F5F0E1';

// Sentinel slug for the "Unassigned (no group)" pseudo-option. Rows are treated
// as unassigned when (groups ?? []).length === 0. Mutually exclusive: picking it
// clears every real group selection, and picking any real group clears it.
const UNASSIGNED_SLUG = '__unassigned__';

export interface AudienceRow {
  audience_id: string;              // 'subscriber:123' | 'prospect:<uuid>'
  source: 'subscriber' | 'prospect';
  email: string;
  name: string | null;
  company: string | null;
  country: string | null;
  phone: string | null;
  icp_score: number | null;
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
  // Optional: some upstream views (v_marketing_audience) expose a finer-grain
  // origin label. Used as a fallback for the SOURCE column when ingest_source
  // is null. Prospect rows from gmail_contacts_extracted that haven't been
  // promoted typically have both null → we show "prospect" then.
  source_detail?: string | null;
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
// purged_bounced + purged_unsubscribed count marketing.subscriber_blocklist entries
// added by the auto-purge triggers.
export interface AudienceTiles {
  total_subs: number;
  mailable: number;
  guests_sea: number;
  guests_int: number;
  returning_guests: number;
  dmc: number;
  responders: number;
  prospects: number;
  purged_bounced: number;
  purged_unsubscribed: number;
}

// 2026-07-22 · SourceFilter is now the ORIGIN of the row (`ingest_source`
// value, normalized so gmail_extract → gmail; prospect: rows without an
// ingest_source render as 'prospect'), not the ROW TYPE. Options are computed
// dynamically from rows[] plus a leading 'any' sentinel. Kept as a plain
// string so future custom source names Just Work.
type SourceFilter = string;
// Legacy row-type filter values still arrive from the URL (?source=prospects
// tile-click, ?source=subscribers, ?source=all). See normalizeInitialSource.
type LegacySourceFilter = 'all' | 'subscribers' | 'prospects';
type StatusFilter = 'any' | 'active' | 'pending' | 'unsub' | 'bounced';
type MxFilter = 'any' | 'valid' | 'invalid';
type TabKey = 'table' | 'scrape';

const PAGE_SIZE = 50;

interface Props {
  initialRows: AudienceRow[];
  initialGroups: GroupRow[];
  // Server still passes the legacy row-type token from ?source=… on the URL.
  // We normalize it into the new origin-scoped SourceFilter at mount below.
  initialSource: LegacySourceFilter;
  initialTab: TabKey;
  initialTiles: AudienceTiles;
}

// Map the legacy ?source=… URL token onto the new origin-scoped SourceFilter.
// 'prospects' → 'prospect' (single origin bucket); 'subscribers' → 'any'
// (subscribers are the union of pms/gmail/dmc/manual/…, no single value);
// 'all' or unknown → 'any'.
function normalizeInitialSource(legacy: LegacySourceFilter): SourceFilter {
  if (legacy === 'prospects') return 'prospect';
  return 'any';
}

export default function AudienceUnifiedClient({
  initialRows, initialGroups, initialSource, initialTab, initialTiles,
}: Props) {
  const [rows, setRows] = useState<AudienceRow[]>(initialRows);
  const [hydrating, setHydrating] = useState<boolean>(false);
  const [hydrateNote, setHydrateNote] = useState<string | null>(null);

  // Row-action drawer state (Item 1)
  const [pickerOpen, setPickerOpen] = useState<null | { kind: 'newsletter' | 'sequence'; row: AudienceRow }>(null);
  const [campaigns, setCampaigns] = useState<Array<{ campaign_id: string; name: string; subject: string | null; scheduled_at: string | null; status: string }>>([]);
  const [funnels, setFunnels]     = useState<Array<{ funnel_id: string; funnel_key: string; name: string; status: string }>>([]);
  const [pickerLoading, setPickerLoading] = useState<boolean>(false);
  const [pickerError, setPickerError]     = useState<string | null>(null);
  const [groups, setGroups] = useState<GroupRow[]>(initialGroups);
  const [tab, setTab] = useState<TabKey>(initialTab);

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(() => normalizeInitialSource(initialSource));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('any');
  const [mxFilter, setMxFilter]         = useState<MxFilter>('any');
  // 2026-07-22 · Source/Status/MX converted from segmented button rows to
  // single-select dropdowns to match the GROUPS filter shape (chevron trigger
  // + popover list). State + filter logic unchanged; JSX only.
  const [sourceDdOpen, setSourceDdOpen] = useState(false);
  const [statusDdOpen, setStatusDdOpen] = useState(false);
  const [mxDdOpen,     setMxDdOpen]     = useState(false);
  // Multi-select group filter (UNION semantics; UNASSIGNED_SLUG sentinel exclusive)
  const [groupFilters, setGroupFilters] = useState<string[]>([]);
  const [groupDdOpen, setGroupDdOpen]   = useState(false);
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

  // ---- Item 8 course-correct (2026-07-22): server-scoped group-filter refetch.
  // The old client-only architecture computes group counts + filter membership
  // off the 1000-row initial payload (PostgREST db-max-rows). Client counts
  // like Guests=1000, Returning=59, OTA=2 are coincidental slices of the
  // capped 1000 rows — the real values (v_subscriber_groups.member_count) are
  // 3154 / 299 / 59. DMC-contracted has 13 real members, none in the first
  // 1000 rows, so the client filter shows zero.
  //
  // Fix: dropdown labels now read g.member_count (DB truth) first — see line
  // where groupCounts lookup happens. When any real group filter is applied,
  // fire a scoped PostgREST query (groups=cs.{...}) so rows that live past
  // row 1000 come back. Loading state renders inline next to the counter.
  useEffect(() => {
    const realSlugs = groupFilters.filter((s) => s !== UNASSIGNED_SLUG);
    // No real group selected → show the initial 1000-row sample.
    if (realSlugs.length === 0) {
      setRows(initialRows);
      setHydrateNote(null);
      return;
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return;
    let cancelled = false;
    (async () => {
      setHydrating(true);
      setHydrateNote(null);
      try {
        // PostgREST array-contains-any = or=(groups.cs.{slug1},groups.cs.{slug2}, ...)
        // For a single slug, groups=cs.{slug} is enough. Multi-slug = UNION via OR.
        const or = realSlugs.map((s) => `groups.cs.{${s}}`).join(',');
        const qs = realSlugs.length === 1
          ? `groups=cs.{${realSlugs[0]}}`
          : `or=(${or})`;
        const r = await fetch(
          `${url}/rest/v1/v_marketing_audience?select=*&${qs}&order=is_pinned.desc,created_at.desc.nullslast&limit=5000`,
          { headers: { apikey: anon, Authorization: `Bearer ${anon}`, Prefer: 'count=none' } },
        );
        if (!r.ok) { setHydrateNote(`Group fetch failed (${r.status}).`); return; }
        const chunk: AudienceRow[] = await r.json().catch(() => [] as AudienceRow[]);
        if (cancelled) return;
        if (Array.isArray(chunk)) {
          // Merge scoped rows with initialRows so other filters (source/status/mx/query)
          // still work over the full picture. De-dupe by audience_id.
          const seen = new Set<string>();
          const merged: AudienceRow[] = [];
          for (const row of [...chunk, ...initialRows]) {
            if (seen.has(row.audience_id)) continue;
            seen.add(row.audience_id);
            merged.push(row);
          }
          setRows(merged);
          setHydrateNote(`Loaded ${chunk.length.toLocaleString()} group-scoped rows.`);
        }
      } catch (e) {
        if (!cancelled) setHydrateNote(`Group fetch error: ${(e as Error).message}`);
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [groupFilters, initialRows]);

  const totalCount = rows.length;
  const subCount   = useMemo(() => rows.filter(r => r.source === 'subscriber').length, [rows]);
  const proCount   = useMemo(() => rows.filter(r => r.source === 'prospect').length, [rows]);

  // Per-group counts across the loaded rows[]. FALLBACK ONLY — the dropdown
  // and tiles now prefer v_subscriber_groups.member_count (DB truth) because
  // the loaded rows[] is capped by PostgREST db-max-rows at 1000 and would
  // undercount Guests (3154), Returning Guests (299), OTA Traveller (59).
  const groupCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) for (const g of r.groups ?? []) m[g] = (m[g] ?? 0) + 1;
    return m;
  }, [rows]);

  // Count of unassigned subscriber rows across the whole dataset.
  const unassignedCount = useMemo(
    () => rows.filter(r => r.source === 'subscriber' && (r.groups ?? []).length === 0).length,
    [rows],
  );

  // 2026-07-22 · Dynamically compute the SOURCE dropdown options from the
  // rows currently loaded — no hardcoded list. gmail_extract collapses to
  // 'gmail'; prospect: rows without an ingest_source contribute 'prospect'.
  // Any new custom source uploaded in future will just appear.
  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const norm = r.ingest_source === 'gmail_extract' ? 'gmail' : r.ingest_source;
      const eff  = norm ?? (r.audience_id.startsWith('prospect:') ? 'prospect' : null);
      if (eff) set.add(eff);
    }
    return ['any', ...Array.from(set).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const wantUnassigned = groupFilters.includes(UNASSIGNED_SLUG);
    const realGroupSet   = new Set(groupFilters.filter(s => s !== UNASSIGNED_SLUG));
    return rows.filter((r) => {
      // 2026-07-22 · SOURCE filter now matches by origin (ingest_source),
      // normalized so gmail_extract → gmail, and prospect: rows without an
      // ingest_source render/count as 'prospect'.
      const normalizedIngest = r.ingest_source === 'gmail_extract' ? 'gmail' : r.ingest_source;
      const effectiveSource = normalizedIngest ?? (r.audience_id.startsWith('prospect:') ? 'prospect' : null);
      if (sourceFilter !== 'any' && effectiveSource !== sourceFilter) return false;
      if (r.source === 'subscriber') {
        if (statusFilter === 'active'  && !(r.opted_in_at && !r.unsubscribed_at)) return false;
        if (statusFilter === 'pending' && !(!r.opted_in_at && !r.unsubscribed_at)) return false;
        if (statusFilter === 'unsub'   && !r.unsubscribed_at) return false;
        if (statusFilter === 'bounced' && !r.bounced_at) return false;
      } else {
        // Status filter is subscribers-only. When active on prospect view, hide prospects.
        if (statusFilter !== 'any' && sourceFilter !== 'prospect') return false;
      }
      if (r.source === 'prospect') {
        if (mxFilter === 'valid' && r.mx_valid !== true) return false;
        if (mxFilter === 'invalid' && r.mx_valid !== false) return false;
      } else {
        // MX filter is prospect-only. When active on non-prospect origin, hide non-prospects.
        if (mxFilter !== 'any' && sourceFilter === 'any') return false;
      }
      // Group filter — Unassigned sentinel is EXCLUSIVE.
      if (wantUnassigned) {
        if ((r.groups ?? []).length !== 0) return false;
      } else if (realGroupSet.size > 0) {
        const rg = r.groups ?? [];
        let hit = false;
        for (const g of rg) { if (realGroupSet.has(g)) { hit = true; break; } }
        if (!hit) return false;
      }
      if (q) {
        const hay = (r.email + ' ' + (r.name ?? '') + ' ' + (r.company ?? '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, sourceFilter, statusFilter, mxFilter, groupFilters, query]);

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

  // 2026-07-22 · Audience-id-string counterpart. Used by optimistic-patch code
  // paths (bulk delete + assign + unsub) that need to match against
  // row.audience_id which is the full "subscriber:{n}" string, not the raw
  // integer id. Kept as a separate memo so the RPC/API payload dependency
  // above stays untouched.
  const selectedSubscriberAudienceIds = useMemo(
    () => Array.from(selected).filter((id) => id.startsWith('subscriber:')),
    [selected],
  );

  const refreshGroups = useCallback(async () => {
    const r = await fetch('/api/marketing/subscribers/groups', { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (j.ok && Array.isArray(j.groups)) setGroups(j.groups as GroupRow[]);
  }, []);

  const doBulkAssignGroup = useCallback((groupId: string) => {
    const ids     = selectedSubscriberIds;
    const audIds  = selectedSubscriberAudienceIds;
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
      // 2026-07-22 · Optimistic row patch. The API call succeeds (rows land in
      // marketing.subscriber_group_members) but nothing in initialRows or
      // refreshGroups() re-hydrates the row-level `groups` array, so PBS saw
      // no visual feedback. Patch here so the Groups column chip appears
      // immediately for every selected subscriber row.
      const audSet = new Set(audIds);
      setRows((prev) => prev.map((row) =>
        audSet.has(row.audience_id)
          ? { ...row, groups: Array.from(new Set([...(row.groups ?? []), g.slug])) }
          : row,
      ));
      setMsg(`Assigned ${j.affected ?? ids.length} subscribers to ${g.name}.`);
      refreshGroups();
    });
  }, [selectedSubscriberIds, selectedSubscriberAudienceIds, groups, refreshGroups]);

  // 2026-07-22 · Bulk delete for subscriber rows only. Prospects are excluded.
  // Calls SECURITY DEFINER RPC public.fn_bulk_delete_subscribers(p_audience_ids text[])
  // which parses the "subscriber:{id}" prefix, deletes from
  // marketing.newsletter_subscribers by id, and lets the auto-blocklist trigger
  // populate marketing.newsletter_blocklist so future imports can't re-add them.
  // If the RPC doesn't exist yet (PBS creates it out-of-band), fall back to a
  // friendly alert() rather than crashing the page.
  const doBulkDelete = useCallback(() => {
    const audIds = selectedSubscriberAudienceIds;
    if (audIds.length === 0) return;
    if (!confirm(`Delete ${audIds.length} addresses from newsletter subscribers? They will be auto-added to the blocklist so future imports cannot re-add them.`)) return;
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) { alert('Delete failed: Supabase env not available in browser.'); return; }
    startTransition(async () => {
      try {
        const r = await fetch(`${url}/rest/v1/rpc/fn_bulk_delete_subscribers`, {
          method: 'POST',
          headers: {
            apikey: anon,
            Authorization: `Bearer ${anon}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_audience_ids: audIds }),
        });
        if (r.status === 404) {
          alert('Delete RPC (fn_bulk_delete_subscribers) not deployed yet.');
          return;
        }
        const j = await r.json().catch(() => null);
        if (!r.ok) {
          setMsg(`Delete failed: ${(j && (j.message || j.error)) ?? r.statusText}`);
          return;
        }
        // RPC returns TABLE(deleted int, blocklisted int) or scalar; be flexible.
        const deleted = Array.isArray(j) ? (j[0]?.deleted ?? audIds.length) : (j?.deleted ?? audIds.length);
        setMsg(`Deleted ${deleted} subscribers. Refresh to see updated counts.`);
        // Remove deleted rows from local view + clear selection so the UI doesn't
        // show phantom "N selected" against rows that no longer exist.
        const audSet = new Set(audIds);
        setRows((prev) => prev.filter((row) => !audSet.has(row.audience_id)));
        setSelected(new Set());
      } catch (e) {
        setMsg(`Delete failed: ${(e as Error).message}`);
      }
    });
  }, [selectedSubscriberAudienceIds]);

  const doBulkUnsubscribe = useCallback(() => {
    const ids    = selectedSubscriberIds;
    const audIds = selectedSubscriberAudienceIds;
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
      // 2026-07-22 · Optimistic row patch. Same invisibility bug as the assign
      // path: server-side unsubscribed_at is set, but the row-level flag stays
      // null in state so filters like STATUS=unsub still miss it. Stamp the
      // client rows immediately.
      const nowIso = new Date().toISOString();
      const audSet = new Set(audIds);
      setRows((prev) => prev.map((row) =>
        audSet.has(row.audience_id) && !row.unsubscribed_at
          ? { ...row, unsubscribed_at: nowIso }
          : row,
      ));
      setMsg(`Unsubscribed ${j.affected ?? ids.length}.`);
    });
  }, [selectedSubscriberIds, selectedSubscriberAudienceIds]);

  const exportCsv = () => {
    const target = selected.size ? filtered.filter(r => selected.has(r.audience_id)) : filtered;
    const header = ['audience_id','source','email','name','company','country','phone','icp_score','lifecycle_stage','opted_in_at','unsubscribed_at','bounced_at','mx_valid','booking_count','groups','tags','ingest_source','created_at'];
    const lines = [header.join(',')];
    for (const r of target) {
      const row = [
        r.audience_id, r.source, r.email, r.name ?? '', r.company ?? '', r.country ?? '',
        r.phone ?? '',
        r.icp_score == null ? '' : String(r.icp_score),
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

  // Group filter toggles. Unassigned sentinel is mutually exclusive with real groups.
  const toggleGroupFilter = (slug: string) => {
    setGroupFilters((prev) => {
      const isUnassigned = slug === UNASSIGNED_SLUG;
      const has = prev.includes(slug);
      if (has) return prev.filter((s) => s !== slug);
      if (isUnassigned) return [UNASSIGNED_SLUG];             // exclusive
      // Picking any real group clears the unassigned sentinel.
      return [...prev.filter((s) => s !== UNASSIGNED_SLUG), slug];
    });
    setPage(0);
  };
  const resetGroupFilters = () => { setGroupFilters([]); setPage(0); };

  // ---- Item 1: row-action picker (Newsletter + Sequence) ----
  const openPicker = useCallback((kind: 'newsletter' | 'sequence', row: AudienceRow) => {
    setPickerOpen({ kind, row });
    setPickerError(null);
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) { setPickerError('Supabase env not available in browser.'); return; }
    setPickerLoading(true);
    (async () => {
      try {
        if (kind === 'newsletter') {
          // v_guest_campaigns filtered to scheduled / draft broadcasts.
          const r = await fetch(
            `${url}/rest/v1/v_guest_campaigns?select=campaign_id,name,subject,scheduled_at,status,campaign_kind&or=(status.eq.scheduled,status.eq.draft)&order=scheduled_at.desc.nullslast&limit=20`,
            { headers: { apikey: anon, Authorization: `Bearer ${anon}` } },
          );
          const j = await r.json().catch(() => []);
          if (!Array.isArray(j)) { setPickerError('Failed to load campaigns.'); return; }
          setCampaigns(j);
        } else {
          // v_marketing_funnels — active only.
          const r = await fetch(
            `${url}/rest/v1/v_marketing_funnels?select=funnel_id,funnel_key,name,status&status=eq.active&order=name.asc&limit=50`,
            { headers: { apikey: anon, Authorization: `Bearer ${anon}` } },
          );
          const j = await r.json().catch(() => []);
          if (!Array.isArray(j)) { setPickerError('Failed to load funnels.'); return; }
          setFunnels(j);
        }
      } catch (e) {
        setPickerError((e as Error).message);
      } finally {
        setPickerLoading(false);
      }
    })();
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(null);
    setPickerError(null);
    setCampaigns([]);
    setFunnels([]);
  }, []);

  // Enroll a single audience row into a campaign draft or funnel via the
  // public RPCs `fn_campaign_recipient_add_one(p_campaign_id uuid, p_audience_id text)`
  // and `fn_funnel_enroll_one(p_funnel_key text, p_audience_id text)`. Both
  // resolve the audience_id (`subscriber:{bigint}`) internally against
  // marketing.newsletter_subscribers.id and return TABLE(ok, ..., note).
  const enrollRow = useCallback(async (kind: 'newsletter' | 'sequence', row: AudienceRow, targetId: string, targetLabel: string) => {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) { alert('Enroll failed: Supabase env not available in browser.'); return; }
    const fn   = kind === 'newsletter' ? 'fn_campaign_recipient_add_one' : 'fn_funnel_enroll_one';
    const body = kind === 'newsletter'
      ? { p_campaign_id: targetId, p_audience_id: row.audience_id }
      : { p_funnel_key: targetId,  p_audience_id: row.audience_id };
    try {
      const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: {
          apikey: anon,
          Authorization: `Bearer ${anon}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        alert(`Enroll failed: ${r.status} ${txt || r.statusText}`);
        return;
      }
      const data = await r.json().catch(() => null);
      const res  = Array.isArray(data) ? data[0] : data;
      if (!res?.ok) { alert(`Not enrolled: ${res?.note ?? 'unknown'}`); return; }
      const who = res.email ?? row.email;
      setMsg(kind === 'newsletter'
        ? `Added ${who} to campaign · ${res.note ?? targetLabel}`
        : `Enrolled ${who} in ${targetLabel} · ${res.note ?? 'ok'}`);
      closePicker();
    } catch (e) {
      alert(`Enroll failed: ${(e as Error).message}`);
    }
  }, [closePicker]);

  const resetFilters = () => {
    setSourceFilter('any'); setStatusFilter('any'); setMxFilter('any');
    setGroupFilters([]); setQuery(''); setPage(0);
  };
  const setGroupOnly = (slug: string) => {
    setSourceFilter('any'); setStatusFilter('any'); setMxFilter('any');
    setGroupFilters([slug]); setPage(0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Authoritative headline tiles — DB-sourced, always fresh */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))', gap: 8 }}>
        <TileCompact label="Total"           value={initialTiles.total_subs}       onClick={resetFilters} />
        <TileCompact label="Mailable"        value={initialTiles.mailable}         onClick={resetFilters} />
        <TileCompact label="Guests SEA"      value={initialTiles.guests_sea}       onClick={() => setGroupOnly('guests-sea')}       active={groupFilters.length === 1 && groupFilters[0] === 'guests-sea'} />
        <TileCompact label="Guests Int."     value={initialTiles.guests_int}       onClick={() => setGroupOnly('guests-int')}       active={groupFilters.length === 1 && groupFilters[0] === 'guests-int'} />
        <TileCompact label="Returning Guests" value={initialTiles.returning_guests} onClick={() => setGroupOnly('returning-guests')} active={groupFilters.length === 1 && groupFilters[0] === 'returning-guests'} />
        <TileCompact label="DMC Contracted" value={initialTiles.dmc}               onClick={() => setGroupOnly('dmc-contracted')}   active={groupFilters.length === 1 && groupFilters[0] === 'dmc-contracted'} />
        <TileCompact label="Prospects"       value={initialTiles.prospects}        onClick={() => { setSourceFilter('prospect'); setPage(0); }} active={sourceFilter === 'prospect'} />
        <TileCompact label="Responders"      value={initialTiles.responders}       onClick={() => setGroupOnly('responders')}       active={groupFilters.length === 1 && groupFilters[0] === 'responders'} />
        <TileCompact label="Bounced (purged)"      value={initialTiles.purged_bounced}      />
        <TileCompact label="Unsubscribed (purged)" value={initialTiles.purged_unsubscribed} />
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
          <SingleSelectDropdown
            open={sourceDdOpen}
            setOpen={setSourceDdOpen}
            value={sourceFilter}
            defaultValue="any"
            options={sourceOptions}
            onSelect={(k) => { setSourceFilter(k); setPage(0); setSourceDdOpen(false); }}
          />
        </FilterGroup>
        <FilterGroup label="Status (subs)">
          <SingleSelectDropdown
            open={statusDdOpen}
            setOpen={setStatusDdOpen}
            value={statusFilter}
            defaultValue="any"
            options={['any','active','pending','unsub','bounced'] as StatusFilter[]}
            onSelect={(k) => { setStatusFilter(k); setPage(0); setStatusDdOpen(false); }}
          />
        </FilterGroup>
        <FilterGroup label="MX (prospects)">
          <SingleSelectDropdown
            open={mxDdOpen}
            setOpen={setMxDdOpen}
            value={mxFilter}
            defaultValue="any"
            options={['any','valid','invalid'] as MxFilter[]}
            onSelect={(k) => { setMxFilter(k); setPage(0); setMxDdOpen(false); }}
          />
        </FilterGroup>

        {/* Group multi-select dropdown (RESTORED) */}
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
                padding: 8, minWidth: 260, maxHeight: 320, overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: INK_S, textTransform: 'uppercase', letterSpacing: 0.4 }}>Union · in ANY selected</span>
                  <button
                    onClick={resetGroupFilters}
                    style={{ fontSize: 10, color: BRAND, background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >Reset</button>
                </div>

                {/* Unassigned (no group) - first option, exclusive */}
                {(() => {
                  const checked = groupFilters.includes(UNASSIGNED_SLUG);
                  return (
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
                      fontSize: 12, color: INK, cursor: 'pointer',
                      background: checked ? WARM : 'transparent', borderRadius: 3,
                      borderBottom: `1px dashed ${HAIR}`, marginBottom: 4,
                    }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleGroupFilter(UNASSIGNED_SLUG)} />
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: INK_S, display: 'inline-block' }} />
                      <span style={{ flex: 1, fontStyle: 'italic' }}>&mdash; Unassigned (no group)</span>
                      <span style={{ fontSize: 10, color: INK_S }}>{unassignedCount}</span>
                    </label>
                  );
                })()}

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
                      <span style={{ fontSize: 10, color: INK_S }}>{g.member_count ?? groupCounts[g.slug] ?? 0}</span>
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
              if (slug === UNASSIGNED_SLUG) {
                return (
                  <span key={slug} style={{
                    padding: '3px 8px', background: INK_S, color: WHITE,
                    borderRadius: 3, fontSize: 10, display: 'inline-flex', gap: 4, alignItems: 'center',
                  }}>
                    Unassigned
                    <button onClick={() => toggleGroupFilter(slug)} style={{ background: 'transparent', border: 'none', color: WHITE, cursor: 'pointer', padding: 0, fontSize: 10 }}>&times;</button>
                  </span>
                );
              }
              const g = groups.find((x) => x.slug === slug);
              return (
                <span key={slug} style={{
                  padding: '3px 8px', background: g?.color ?? INK_S, color: WHITE,
                  borderRadius: 3, fontSize: 10, display: 'inline-flex', gap: 4, alignItems: 'center',
                }}>
                  {g?.name ?? slug}
                  <button onClick={() => toggleGroupFilter(slug)} style={{ background: 'transparent', border: 'none', color: WHITE, cursor: 'pointer', padding: 0, fontSize: 10 }}>x</button>
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
        <div style={{ marginLeft: 'auto', fontSize: 11, color: INK_S, display: 'flex', gap: 8, alignItems: 'center' }}>
          {hydrating && <span style={{ color: BRAND }}>Loading group members&hellip;</span>}
          {hydrateNote && !hydrating && <span title={hydrateNote} style={{ color: INK_S }}>&#10003; {hydrateNote}</span>}
          <span>{filtered.length.toLocaleString()} rows &middot; page {page + 1} / {totalPages}</span>
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
          {/* 2026-07-22 · Destructive bulk delete. Subscriber rows only; prospects
              are counted separately and excluded from the RPC payload. */}
          <button
            onClick={doBulkDelete}
            disabled={busy || selectedSubscriberIds.length === 0}
            title={selectedSubscriberIds.length === 0 ? 'Prospect rows cannot be deleted here' : `Delete ${selectedSubscriberIds.length} subscribers (auto-blocklist)`}
            style={{
              ...btnStyle,
              background: WHITE,
              color: '#B04A2F',
              border: '1px solid #B04A2F',
            }}
          >Delete ({selectedSubscriberIds.length})</button>
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
              <th style={thStyle}>Phone</th>
              <th style={thStyle}>Country</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>ICP</th>
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
                  {/* 2026-07-22 · SOURCE column now shows origin (ingest_source),
                      not the row-type ("subscriber"/"prospect") which was
                      redundant with the top SOURCE filter. gmail_extract shortened
                      to "gmail" for readability. Fallback: source_detail → "prospect". */}
                  {(() => {
                    const raw = r.ingest_source ?? r.source_detail ?? (r.source === 'prospect' ? 'prospect' : null);
                    const display = raw === 'gmail_extract' ? 'gmail' : (raw ?? '—');
                    return (
                      <span style={{
                        padding: '2px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                        background: r.source === 'subscriber' ? '#EEF7F0' : '#F5EEDC',
                        color:      r.source === 'subscriber' ? BRAND : '#8A6A2E',
                      }}>{display}</span>
                    );
                  })()}
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
                <td style={{ ...tdStyle, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>
                  {r.phone ?? '—'}
                </td>
                <td style={tdStyle}>
                  {r.country ? <span style={{ textTransform: 'uppercase' }}>{r.country}</span> : '—'}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', color: r.icp_score == null ? INK_S : INK }}>
                  {r.icp_score ?? '—'}
                </td>
                <td style={tdStyle}>{fmtDate(r.opted_in_at)}</td>
                <td style={tdStyle}>{fmtDate(r.created_at)}</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => openPicker('newsletter', r)}
                      title="Enroll into a scheduled newsletter draft"
                      style={rowBtnStyle}
                    >&#9993; Newsletter</button>
                    <button
                      type="button"
                      onClick={() => openPicker('sequence', r)}
                      title="Enroll into an active sequence funnel"
                      style={rowBtnStyle}
                    >&#9863; Sequence</button>
                    <a href={`/marketing/prospects/sequences?email=${encodeURIComponent(r.email)}`}
                       style={{ fontSize: 11, color: BRAND, textDecoration: 'none' }}>
                      &rarr;
                    </a>
                  </div>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={13} style={{ ...tdStyle, textAlign: 'center', color: INK_S, padding: 24 }}>
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

      {/* Row-action pickers (Item 1) */}
      <Drawer
        open={pickerOpen?.kind === 'newsletter'}
        onClose={closePicker}
        title="Add to newsletter"
        subtitle={pickerOpen ? `${pickerOpen.row.email} · pick a scheduled or draft campaign` : undefined}
        width="sm"
      >
        {pickerLoading && <p style={{ fontSize: 12, color: INK_S }}>Loading campaigns&hellip;</p>}
        {pickerError && <p style={{ fontSize: 12, color: '#B04A2F' }}>{pickerError}</p>}
        {!pickerLoading && !pickerError && campaigns.length === 0 && (
          <p style={{ fontSize: 12, color: INK_S }}>No draft or scheduled campaigns found.</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {campaigns.map((c) => (
            <button
              key={c.campaign_id}
              type="button"
              onClick={() => pickerOpen && enrollRow('newsletter', pickerOpen.row, c.campaign_id, c.name || c.subject || c.campaign_id)}
              style={pickerRowStyle}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: INK }}>{c.name || '(untitled)'}</div>
              <div style={{ fontSize: 11, color: INK_S }}>
                {c.subject || '(no subject)'} &middot; {c.status}
                {c.scheduled_at ? ` · ${new Date(c.scheduled_at).toISOString().slice(0,10)}` : ''}
              </div>
            </button>
          ))}
        </div>
      </Drawer>

      <Drawer
        open={pickerOpen?.kind === 'sequence'}
        onClose={closePicker}
        title="Enroll in sequence"
        subtitle={pickerOpen ? `${pickerOpen.row.email} · pick an active funnel` : undefined}
        width="sm"
      >
        {pickerLoading && <p style={{ fontSize: 12, color: INK_S }}>Loading funnels&hellip;</p>}
        {pickerError && <p style={{ fontSize: 12, color: '#B04A2F' }}>{pickerError}</p>}
        {!pickerLoading && !pickerError && funnels.length === 0 && (
          <p style={{ fontSize: 12, color: INK_S }}>No active funnels found.</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {funnels.map((f) => (
            <button
              key={f.funnel_id}
              type="button"
              onClick={() => pickerOpen && enrollRow('sequence', pickerOpen.row, f.funnel_key, f.name || f.funnel_key)}
              style={pickerRowStyle}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: INK }}>{f.name || f.funnel_key}</div>
              <div style={{ fontSize: 11, color: INK_S }}>{f.funnel_key} &middot; {f.status}</div>
            </button>
          ))}
        </div>
      </Drawer>

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
// Row-action buttons (Item 1) — compact so Actions column still fits.
const rowBtnStyle: React.CSSProperties = {
  padding: '3px 6px', fontSize: 10, cursor: 'pointer',
  background: WHITE, color: INK, border: `1px solid ${HAIR}`, borderRadius: 3,
  whiteSpace: 'nowrap',
};
// Picker row inside the Drawer — full-width clickable card.
const pickerRowStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '8px 10px', background: WHITE, color: INK,
  border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer',
};

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

// 2026-07-22 · Chevron-anchored single-select popover, mirroring the visual
// grammar of the multi-select Groups dropdown (BRAND fill when non-default,
// paper white + hairline when default). Used for SOURCE / STATUS (SUBS) /
// MX (PROSPECTS) filters. Kept generic over the string-literal filter types.
function SingleSelectDropdown<T extends string>({
  open, setOpen, value, defaultValue, options, onSelect,
}: {
  open: boolean;
  setOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  value: T;
  defaultValue: T;
  options: readonly T[];
  onSelect: (v: T) => void;
}) {
  const isNonDefault = value !== defaultValue;
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '4px 10px', fontSize: 11, cursor: 'pointer',
          background: isNonDefault ? BRAND : WHITE,
          color: isNonDefault ? WHITE : INK,
          border: `1px solid ${isNonDefault ? BRAND : HAIR}`, borderRadius: 3,
          minWidth: 96, textAlign: 'left',
        }}
      >
        {value} {open ? '▴' : '▾'}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 10,
          background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 3,
          padding: 4, minWidth: 140, maxHeight: 320, overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}>
          {options.map((k) => {
            const checked = value === k;
            return (
              <button
                key={k}
                onClick={() => onSelect(k)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
                  width: '100%', fontSize: 12, color: INK, cursor: 'pointer',
                  background: checked ? WARM : 'transparent', borderRadius: 3,
                  border: 'none', textAlign: 'left',
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: 2,
                  background: checked ? BRAND : HAIR, display: 'inline-block',
                }} />
                <span style={{ flex: 1 }}>{k}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
