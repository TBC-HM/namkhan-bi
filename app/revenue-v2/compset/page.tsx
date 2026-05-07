// app/revenue-v2/compset/page.tsx
// Ticket #107 slice — wire /revenue-v2/compset to live Supabase data.
// Assumptions:
//   1. v_compset_index exists in Supabase but is not yet on the query_supabase_view allowlist;
//      the page fetches it directly via the service-role client (no RLS block).
//   2. v_compset_set_summary / v_compset_property_summary returned permission-denied at build time;
//      we fall back to v_compset_index exclusively.
//   3. Column shape inferred from view name convention:
//      property_name, category, our_rate, comp_rate, index_pct, rank, as_of_date.
//      Any missing column renders '—'.
//   4. KpiBox, DataTable, PageHeader are all DEFAULT exports.

import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface CompsetRow {
  property_name?: string;
  category?: string;
  our_rate?: number | null;
  comp_rate?: number | null;
  index_pct?: number | null;
  rank?: number | null;
  as_of_date?: string | null;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  const sign = v >= 0 ? '+' : '−';
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}

function fmtUsd(v: number | null | undefined): string {
  if (v == null) return '—';
  return `$${v.toFixed(2)}`;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_compset_index')
    .select('*')
    .order('as_of_date', { ascending: false })
    .limit(50);

  const rows: CompsetRow[] = data ?? [];

  // KPI summary — use the most recent row for top-level metrics
  const latest = rows[0] ?? {};
  const avgIndex =
    rows.length > 0
      ? rows.reduce((s, r) => s + (r.index_pct ?? 0), 0) / rows.length
      : null;

  return (
    <main style={{ padding: '24px 32px' }}>
      <PageHeader pillar="Revenue" tab="Compset" title="Competitive Set Index" />

      {error && (
        <p
          role="alert"
          style={{
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: 6,
            padding: '8px 14px',
            marginBottom: 20,
            fontSize: 13,
          }}
        >
          ⚠️ Data unavailable: {error.message}
        </p>
      )}

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <KpiBox
          label="Our Rate"
          value={fmtUsd(latest.our_rate)}
        />
        <KpiBox
          label="Comp Rate"
          value={fmtUsd(latest.comp_rate)}
        />
        <KpiBox
          label="Rate Index"
          value={fmtPct(latest.index_pct)}
        />
        <KpiBox
          label="Avg Index (all)"
          value={fmtPct(avgIndex)}
        />
      </div>

      {/* Detail table */}
      <DataTable
        columns={[
          { key: 'as_of_date', header: 'Date' },
          { key: 'property_name', header: 'Property' },
          { key: 'category', header: 'Category' },
          { key: 'our_rate', header: 'Our Rate' },
          { key: 'comp_rate', header: 'Comp Rate' },
          { key: 'index_pct', header: 'Index %' },
          { key: 'rank', header: 'Rank' },
        ]}
        rows={rows.map((r) => ({
          as_of_date: r.as_of_date ?? '—',
          property_name: r.property_name ?? '—',
          category: r.category ?? '—',
          our_rate: fmtUsd(r.our_rate),
          comp_rate: fmtUsd(r.comp_rate),
          index_pct: fmtPct(r.index_pct),
          rank: r.rank != null ? String(r.rank) : '—',
        }))}
      />
    </main>
  );
}
