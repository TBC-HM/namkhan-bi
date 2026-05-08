'use client';

// app/operations/inventory/page.tsx
// Marathon #195 — Operations · Inventory
// Data source: inv.v_stock_summary (queried client-side via /api/inventory/stock-summary)
// Fallback: em-dash placeholders when view is unreachable.

import { useEffect, useState } from 'react';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockRow {
  category:         string;
  item_name:        string;
  unit:             string;
  qty_on_hand:      number | null;
  reorder_level:    number | null;
  days_remaining:   number | null;
  last_updated:     string | null;
  status:           string | null;
}

interface SummaryKpis {
  total_items:      number;
  low_stock_items:  number;
  out_of_stock:     number;
  categories:       number;
}

// ─── Columns ──────────────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'category',       header: 'Category'       },
  { key: 'item_name',      header: 'Item'           },
  { key: 'unit',           header: 'Unit'           },
  { key: 'qty_on_hand',    header: 'Qty On Hand'    },
  { key: 'reorder_level',  header: 'Reorder Level'  },
  { key: 'days_remaining', header: 'Days Remaining' },
  { key: 'last_updated',   header: 'Last Updated'   },
  { key: 'status',         header: 'Status'         },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, suffix = ''): string {
  if (v == null) return '—';
  return `${v}${suffix}`;
}

function deriveKpis(rows: StockRow[]): SummaryKpis {
  const categories = new Set(rows.map((r) => r.category)).size;
  const lowStock   = rows.filter((r) => (r.status ?? '').toLowerCase() === 'low').length;
  const outOfStock = rows.filter((r) => (r.status ?? '').toLowerCase() === 'out').length;
  return {
    total_items:     rows.length,
    low_stock_items: lowStock,
    out_of_stock:    outOfStock,
    categories,
  };
}

function normaliseRows(rows: StockRow[]): Record<string, string>[] {
  return rows.map((r) => ({
    category:       r.category       ?? '—',
    item_name:      r.item_name      ?? '—',
    unit:           r.unit           ?? '—',
    qty_on_hand:    fmt(r.qty_on_hand),
    reorder_level:  fmt(r.reorder_level),
    days_remaining: fmt(r.days_remaining, ' d'),
    last_updated:   r.last_updated   ?? '—',
    status:         r.status         ?? '—',
  }));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [rows, setRows]       = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/inventory/stock-summary');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data: StockRow[] };
        setRows(json.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const kpis = deriveKpis(rows);

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'var(--font-sans, sans-serif)' }}>
      <PageHeader pillar="Operations" tab="Inventory" title="Inventory" />

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiBox
          label="Total Items"
          value={loading ? '…' : fmt(kpis.total_items)}
        />
        <KpiBox
          label="Categories"
          value={loading ? '…' : fmt(kpis.categories)}
        />
        <KpiBox
          label="Low Stock"
          value={loading ? '…' : fmt(kpis.low_stock_items)}
          variant={kpis.low_stock_items > 0 ? 'warning' : 'default'}
        />
        <KpiBox
          label="Out of Stock"
          value={loading ? '…' : fmt(kpis.out_of_stock)}
          variant={kpis.out_of_stock > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {error && (
        <div
          role="alert"
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
            color: '#991b1b',
            fontSize: 14,
          }}
        >
          ⚠️ Could not load inventory data: {error}. Showing empty state.
        </div>
      )}

      {/* ── Data table ────────────────────────────────────────────────────── */}
      <DataTable
        columns={COLUMNS}
        rows={loading ? [] : normaliseRows(rows)}
      />

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!loading && rows.length === 0 && !error && (
        <p style={{ textAlign: 'center', color: '#6b7280', marginTop: 40 }}>
          No inventory records found in <code>inv.v_stock_summary</code>.
        </p>
      )}
    </main>
  );
}
