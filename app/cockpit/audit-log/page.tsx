'use client';

/**
 * /cockpit/audit-log — Virtualized Audit Log
 *
 * Perf fix: instead of dumping every row into the DOM we:
 *   1. Fetch one PAGE_SIZE slice at a time from the server action (cursor-based).
 *   2. Render only the visible window using a lightweight manual virtual-scroll
 *      (no extra npm package — uses a single oversized spacer div + translateY).
 *
 * Row height is fixed at ROW_H px which allows O(1) maths for which rows
 * are "in view", keeping the DOM node count constant at ~30 regardless of
 * how many thousands of rows are loaded.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import StatusPill from '@/components/ui/StatusPill';

// ─── constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 200;   // rows fetched per network request
const ROW_H     = 52;    // px — fixed row height (must match CSS below)
const OVERSCAN  = 5;     // extra rows rendered above/below viewport

// ─── types ────────────────────────────────────────────────────────────────────
interface AuditRow {
  id: number;
  created_at: string;
  agent: string | null;
  action: string | null;
  target: string | null;
  ticket_id: number | null;
  success: boolean | null;
  reasoning: string | null;
  cost_usd_milli: number | null;
}

// ─── supabase browser client (public anon key — RLS governs access) ───────────
function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function AuditLogPage() {
  const [rows, setRows]         = useState<AuditRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [hasMore, setHasMore]   = useState(true);
  const [search, setSearch]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // virtual-scroll state
  const scrollRef   = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH]         = useState(600);

  // ── debounce search ──────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── fetch page ───────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (reset: boolean) => {
    setLoading(true);
    const supabase = getClient();

    let q = supabase
      .from('cockpit_audit_log')
      .select('id,created_at,agent,action,target,ticket_id,success,reasoning,cost_usd_milli')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (!reset && rows.length > 0) {
      // cursor: fetch rows older than our oldest loaded row
      const oldest = rows[rows.length - 1].created_at;
      q = q.lt('created_at', oldest);
    }

    if (debouncedSearch) {
      // ilike on agent + action + target
      q = q.or(
        `agent.ilike.%${debouncedSearch}%,action.ilike.%${debouncedSearch}%,target.ilike.%${debouncedSearch}%`
      );
    }

    const { data, error } = await q;
    if (error) {
      console.error('[audit-log] fetch error', error);
      setLoading(false);
      return;
    }
    const fetched = (data ?? []) as AuditRow[];
    setRows(prev => reset ? fetched : [...prev, ...fetched]);
    setHasMore(fetched.length === PAGE_SIZE);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // reset + refetch when search changes
  useEffect(() => {
    void fetchPage(true);
  }, [fetchPage]);

  // ── measure viewport ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setViewH(entries[0].contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── scroll handler ───────────────────────────────────────────────────────
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);

    // infinite-load trigger: when within 200px of bottom
    if (!loading && hasMore && el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      void fetchPage(false);
    }
  }, [loading, hasMore, fetchPage]);

  // ── virtual window calculation ───────────────────────────────────────────
  const totalH   = rows.length * ROW_H;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endIdx   = Math.min(rows.length, Math.ceil((scrollTop + viewH) / ROW_H) + OVERSCAN);
  const visibleRows = rows.slice(startIdx, endIdx);
  const offsetY  = startIdx * ROW_H;

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a0a', color: '#e8e0d4' }}>
      <PageHeader pillar="Cockpit" tab="Audit Log" title="Audit Log" />

      {/* ── toolbar ── */}
      <div style={{ padding: '12px 24px', display: 'flex', gap: 12, alignItems: 'center', borderBottom: '1px solid #222' }}>
        <input
          type="search"
          placeholder="Filter by agent / action / target…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, maxWidth: 400,
            background: '#111', border: '1px solid #333', borderRadius: 6,
            color: '#e8e0d4', padding: '6px 12px', fontSize: 13,
          }}
        />
        <span style={{ fontSize: 12, color: '#888' }}>
          {rows.length.toLocaleString()} rows loaded
          {hasMore ? ' (scroll for more)' : ' (all loaded)'}
        </span>
        {loading && <span style={{ fontSize: 12, color: '#c79a6b' }}>Loading…</span>}
      </div>

      {/* ── column headers ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '180px 120px 140px 1fr 80px 90px',
        gap: 8, padding: '8px 24px',
        fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
        color: '#888', textTransform: 'uppercase',
        borderBottom: '1px solid #222',
        background: '#0d0d0d',
      }}>
        <span>Timestamp</span>
        <span>Agent</span>
        <span>Action</span>
        <span>Target</span>
        <span>Status</span>
        <span>Cost (m¢)</span>
      </div>

      {/* ── virtual scroll container ── */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
      >
        {/* full-height spacer so scrollbar is correctly sized */}
        <div style={{ height: totalH, position: 'relative' }}>
          {/* translated window of visible rows */}
          <div style={{ transform: `translateY(${offsetY}px)`, willChange: 'transform' }}>
            {visibleRows.map(row => (
              <div
                key={row.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '180px 120px 140px 1fr 80px 90px',
                  gap: 8,
                  height: ROW_H,
                  alignItems: 'center',
                  padding: '0 24px',
                  fontSize: 12,
                  borderBottom: '1px solid #1a1a1a',
                  fontFamily: 'monospace',
                }}
              >
                {/* timestamp */}
                <span style={{ color: '#aaa' }}>
                  {new Date(row.created_at).toISOString().replace('T', ' ').slice(0, 19)}
                </span>

                {/* agent */}
                <span
                  title={row.agent ?? ''}
                  style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: '#c79a6b',
                  }}
                >
                  {row.agent ?? '—'}
                </span>

                {/* action */}
                <span
                  title={row.action ?? ''}
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {row.action ?? '—'}
                </span>

                {/* target */}
                <span
                  title={row.target ?? ''}
                  style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: '#888',
                  }}
                >
                  {row.target ?? '—'}
                </span>

                {/* status pill */}
                <span>
                  <StatusPill value={row.success === true ? 'ok' : row.success === false ? 'error' : 'unknown'} />
                </span>

                {/* cost */}
                <span style={{ color: '#666', textAlign: 'right' }}>
                  {row.cost_usd_milli != null ? row.cost_usd_milli.toFixed(1) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* bottom spinner */}
        {loading && rows.length > 0 && (
          <div style={{ textAlign: 'center', padding: 16, fontSize: 12, color: '#c79a6b' }}>
            Loading more…
          </div>
        )}

        {/* all-done notice */}
        {!hasMore && rows.length > 0 && (
          <div style={{ textAlign: 'center', padding: 16, fontSize: 11, color: '#555' }}>
            ─ end of log ({rows.length.toLocaleString()} rows) ─
          </div>
        )}
      </div>
    </main>
  );
}
