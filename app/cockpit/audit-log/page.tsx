'use client';

/**
 * app/cockpit/audit-log/page.tsx
 * Ticket #229 — Virtualize the audit log list
 *
 * Uses react-window FixedSizeList to render only visible rows,
 * keeping the browser snappy even with thousands of log entries.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import PageHeader from '@/components/layout/PageHeader';
import StatusPill from '@/components/ui/StatusPill';

// ---------- types ----------

interface AuditRow {
  id: number;
  created_at: string;
  agent: string;
  action: string;
  target: string | null;
  ticket_id: number | null;
  success: boolean;
  reasoning: string | null;
  cost_usd_milli: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  duration_ms: number | null;
}

// ---------- constants ----------

const ROW_HEIGHT = 56; // px per virtual row
const PAGE_SIZE = 200; // rows fetched per page

// ---------- helpers ----------

function fmt(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return dateStr;
  }
}

function fmtCost(milli: number | null): string {
  if (milli == null) return '—';
  return `$${(milli / 1000).toFixed(4)}`;
}

function fmtMs(ms: number | null): string {
  if (ms == null) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

// ---------- column config ----------

interface ColDef {
  key: keyof AuditRow | '_cost';
  header: string;
  width: number; // px
  render: (row: AuditRow) => React.ReactNode;
}

const COLUMNS: ColDef[] = [
  {
    key: 'created_at',
    header: 'Time',
    width: 180,
    render: (r) => <span style={{ fontSize: 12 }}>{fmt(r.created_at)}</span>,
  },
  {
    key: 'agent',
    header: 'Agent',
    width: 140,
    render: (r) => <code style={{ fontSize: 12 }}>{r.agent}</code>,
  },
  {
    key: 'action',
    header: 'Action',
    width: 140,
    render: (r) => <code style={{ fontSize: 12 }}>{r.action}</code>,
  },
  {
    key: 'target',
    header: 'Target',
    width: 160,
    render: (r) => <span style={{ fontSize: 12 }}>{r.target ?? '—'}</span>,
  },
  {
    key: 'ticket_id',
    header: 'Ticket',
    width: 72,
    render: (r) =>
      r.ticket_id != null ? (
        <a
          href={`/cockpit/tickets/${r.ticket_id}`}
          style={{ fontSize: 12, color: 'var(--color-brand-primary, #2563eb)' }}
        >
          #{r.ticket_id}
        </a>
      ) : (
        <span style={{ fontSize: 12 }}>—</span>
      ),
  },
  {
    key: 'success',
    header: 'Status',
    width: 88,
    render: (r) => (
      <StatusPill status={r.success ? 'success' : 'error'} label={r.success ? 'OK' : 'FAIL'} />
    ),
  },
  {
    key: '_cost',
    header: 'Cost',
    width: 88,
    render: (r) => <span style={{ fontSize: 12 }}>{fmtCost(r.cost_usd_milli)}</span>,
  },
  {
    key: 'duration_ms',
    header: 'Duration',
    width: 88,
    render: (r) => <span style={{ fontSize: 12 }}>{fmtMs(r.duration_ms)}</span>,
  },
  {
    key: 'reasoning',
    header: 'Reasoning',
    width: 320,
    render: (r) => (
      <span
        style={{
          fontSize: 12,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'block',
          maxWidth: 312,
        }}
        title={r.reasoning ?? ''}
      >
        {r.reasoning ?? '—'}
      </span>
    ),
  },
];

const TOTAL_WIDTH = COLUMNS.reduce((s, c) => s + c.width, 0);

// ---------- row renderer (defined outside component to avoid recreation) ----------

function RowRenderer({
  index,
  style,
  data,
}: ListChildComponentProps<AuditRow[]>) {
  const row = data[index];
  if (!row) return null;
  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--color-border, #e5e7eb)',
        background: index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
        minWidth: TOTAL_WIDTH,
      }}
    >
      {COLUMNS.map((col) => (
        <div
          key={col.key}
          style={{
            width: col.width,
            minWidth: col.width,
            padding: '0 12px',
            overflow: 'hidden',
          }}
        >
          {col.render(row)}
        </div>
      ))}
    </div>
  );
}

// ---------- page component ----------

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchRows = useCallback(
    async (reset = false) => {
      setLoading(true);
      setError(null);
      const offset = reset ? 0 : page * PAGE_SIZE;
      let query = supabase
        .from('cockpit_audit_log')
        .select(
          'id,created_at,agent,action,target,ticket_id,success,reasoning,cost_usd_milli,input_tokens,output_tokens,duration_ms'
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (agentFilter.trim()) query = query.ilike('agent', `%${agentFilter.trim()}%`);
      if (actionFilter.trim()) query = query.ilike('action', `%${actionFilter.trim()}%`);

      const { data, error: dbError } = await query;
      if (dbError) {
        setError(dbError.message);
        setLoading(false);
        return;
      }
      const fetched = (data as AuditRow[]) ?? [];
      setHasMore(fetched.length === PAGE_SIZE);
      setRows((prev) => (reset ? fetched : [...prev, ...fetched]));
      setLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentFilter, actionFilter, page]
  );

  // Initial + filter-change load
  useEffect(() => {
    setPage(0);
    void fetchRows(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentFilter, actionFilter]);

  // Paginate when page bumps
  useEffect(() => {
    if (page === 0) return;
    void fetchRows(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function loadMore() {
    if (!loading && hasMore) setPage((p) => p + 1);
  }

  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <PageHeader pillar="Cockpit" tab="Audit Log" title="Audit Log" />

      {/* ── Filters ── */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border, #e5e7eb)',
          flexShrink: 0,
        }}
      >
        <input
          placeholder="Filter by agent…"
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          style={{
            border: '1px solid var(--color-border, #d1d5db)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 13,
            width: 200,
          }}
        />
        <input
          placeholder="Filter by action…"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{
            border: '1px solid var(--color-border, #d1d5db)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 13,
            width: 200,
          }}
        />
        <span style={{ fontSize: 13, color: '#6b7280', alignSelf: 'center' }}>
          {rows.length} rows loaded
        </span>
      </div>

      {/* ── Header row ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--color-surface-alt, #f9fafb)',
          borderBottom: '2px solid var(--color-border, #e5e7eb)',
          flexShrink: 0,
          overflowX: 'auto',
          minWidth: TOTAL_WIDTH,
        }}
      >
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            style={{
              width: col.width,
              minWidth: col.width,
              padding: '8px 12px',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#6b7280',
            }}
          >
            {col.header}
          </div>
        ))}
      </div>

      {/* ── Error state ── */}
      {error && (
        <div style={{ padding: 16, color: '#dc2626', fontSize: 13 }}>
          Error loading audit log: {error}
        </div>
      )}

      {/* ── Virtualized list ── */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }}>
        <AutoSizer>
          {({ height, width }: { height: number; width: number }) => (
            <FixedSizeList
              height={height}
              width={Math.max(width, TOTAL_WIDTH)}
              itemCount={rows.length}
              itemSize={ROW_HEIGHT}
              itemData={rows}
              overscanCount={8}
              onItemsRendered={({ visibleStopIndex }) => {
                if (visibleStopIndex >= rows.length - 20) {
                  loadMore();
                }
              }}
            >
              {RowRenderer}
            </FixedSizeList>
          )}
        </AutoSizer>
      </div>

      {/* ── Loading indicator ── */}
      {loading && (
        <div
          style={{
            padding: '8px 16px',
            fontSize: 12,
            color: '#6b7280',
            borderTop: '1px solid var(--color-border, #e5e7eb)',
            flexShrink: 0,
          }}
        >
          Loading…
        </div>
      )}

      {!loading && !hasMore && rows.length > 0 && (
        <div
          style={{
            padding: '8px 16px',
            fontSize: 12,
            color: '#9ca3af',
            borderTop: '1px solid var(--color-border, #e5e7eb)',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          All {rows.length} records loaded
        </div>
      )}
    </main>
  );
}
