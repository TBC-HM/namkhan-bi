// app/revenue-v2/compset/page.tsx
import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import DataTable from '@/components/ui/DataTable';
import KpiBox from '@/components/kpi/KpiBox';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface CompsetRow {
  property_name?: string;
  stars?: number | null;
  rate_usd?: number | null;
  rate_lak?: number | null;
  occupancy_pct?: number | null;
  revpar_usd?: number | null;
  adr_usd?: number | null;
  index_vs_namkhan?: number | null;
  source?: string | null;
  snapshot_date?: string | null;
  [key: string]: unknown;
}

export default async function CompsetPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // v_compset_set_summary is the allowlisted canonical view for compset rows
  const { data, error } = await supabase
    .from('v_compset_set_summary')
    .select('*')
    .limit(50);

  const rows: CompsetRow[] = data ?? [];

  // Derive summary KPIs from the set
  const namkhanRow = rows.find(
    (r) =>
      typeof r.property_name === 'string' &&
      r.property_name.toLowerCase().includes('namkhan')
  );
  const compRows = rows.filter(
    (r) =>
      typeof r.property_name !== 'string' ||
      !r.property_name.toLowerCase().includes('namkhan')
  );

  const avgCompRate =
    compRows.length > 0
      ? compRows.reduce((sum, r) => sum + (Number(r.rate_usd) || 0), 0) /
        compRows.length
      : null;

  const avgCompOcc =
    compRows.length > 0
      ? compRows.reduce((sum, r) => sum + (Number(r.occupancy_pct) || 0), 0) /
        compRows.length
      : null;

  const fmtUsd = (v: number | null | undefined) =>
    v != null ? `$${v.toFixed(0)}` : '—';
  const fmtPct = (v: number | null | undefined) =>
    v != null ? `${v.toFixed(1)}%` : '—';
  const fmtIdx = (v: number | null | undefined) =>
    v != null ? v.toFixed(2) : '—';

  const columns = [
    { key: 'property_name', header: 'Property' },
    { key: 'stars', header: '★' },
    { key: 'rate_usd', header: 'Rate (USD)' },
    { key: 'occupancy_pct', header: 'OCC %' },
    { key: 'adr_usd', header: 'ADR' },
    { key: 'revpar_usd', header: 'RevPAR' },
    { key: 'index_vs_namkhan', header: 'Index vs NK' },
    { key: 'source', header: 'Source' },
    { key: 'snapshot_date', header: 'Snapshot' },
  ];

  const tableRows = rows.map((r) => ({
    ...r,
    rate_usd: fmtUsd(r.rate_usd as number | null),
    occupancy_pct: fmtPct(r.occupancy_pct as number | null),
    adr_usd: fmtUsd(r.adr_usd as number | null),
    revpar_usd: fmtUsd(r.revpar_usd as number | null),
    index_vs_namkhan: fmtIdx(r.index_vs_namkhan as number | null),
    stars: r.stars ?? '—',
    source: r.source ?? '—',
    snapshot_date: r.snapshot_date ?? '—',
  }));

  return (
    <main style={{ padding: '24px' }}>
      <PageHeader pillar="Revenue" tab="Compset" title="Competitive Set" />

      {error && (
        <div
          style={{
            background: '#fee2e2',
            border: '1px solid #ef4444',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 24,
            color: '#991b1b',
            fontSize: 14,
          }}
        >
          ⚠ Data load error: {error.message}
        </div>
      )}

      {/* KPI Summary Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox
          label="NK Rate (USD)"
          value={fmtUsd(namkhanRow?.rate_usd as number | null)}
        />
        <KpiBox
          label="Comp Avg Rate"
          value={fmtUsd(avgCompRate)}
        />
        <KpiBox
          label="NK OCC"
          value={fmtPct(namkhanRow?.occupancy_pct as number | null)}
        />
        <KpiBox
          label="Comp Avg OCC"
          value={fmtPct(avgCompOcc)}
        />
      </div>

      {/* Compset Table */}
      <DataTable columns={columns} rows={tableRows} />

      {rows.length === 0 && !error && (
        <p
          style={{
            textAlign: 'center',
            color: '#6b7280',
            marginTop: 48,
            fontSize: 14,
          }}
        >
          No compset data available yet. Populate via the compset ingestion
          pipeline.
        </p>
      )}
    </main>
  );
}
