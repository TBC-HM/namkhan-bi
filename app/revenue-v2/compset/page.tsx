// app/revenue-v2/compset/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface CompsetRow {
  report_date?: string | null;
  competitor_name?: string | null;
  room_type?: string | null;
  our_rate?: number | null;
  comp_rate?: number | null;
  rate_diff?: number | null;
  rate_diff_pct?: number | null;
  our_occ_pct?: number | null;
  comp_occ_pct?: number | null;
  our_revpar?: number | null;
  comp_revpar?: number | null;
  revpar_index?: number | null;
  data_source?: string | null;
}

function fmtUSD(v: number | null | undefined): string {
  if (v == null) return '—';
  return `$${v.toFixed(2)}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}

function fmtIndex(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toFixed(2);
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_compset_index')
    .select('*')
    .order('report_date', { ascending: false })
    .limit(100);

  const rows: CompsetRow[] = data ?? [];

  // Compute summary KPIs from most-recent report date
  const latestDate = rows[0]?.report_date ?? null;
  const latestRows = latestDate
    ? rows.filter((r) => r.report_date === latestDate)
    : rows.slice(0, 10);

  const avgOurRevpar =
    latestRows.length > 0
      ? latestRows.reduce((s, r) => s + (r.our_revpar ?? 0), 0) / latestRows.length
      : null;
  const avgCompRevpar =
    latestRows.length > 0
      ? latestRows.reduce((s, r) => s + (r.comp_revpar ?? 0), 0) / latestRows.length
      : null;
  const avgIndex =
    latestRows.length > 0
      ? latestRows.reduce((s, r) => s + (r.revpar_index ?? 0), 0) / latestRows.length
      : null;
  const avgRateDiffPct =
    latestRows.length > 0
      ? latestRows.reduce((s, r) => s + (r.rate_diff_pct ?? 0), 0) / latestRows.length
      : null;

  const columns = [
    { key: 'report_date', header: 'Date' },
    { key: 'competitor_name', header: 'Competitor' },
    { key: 'room_type', header: 'Room Type' },
    { key: 'our_rate', header: 'Our Rate' },
    { key: 'comp_rate', header: 'Comp Rate' },
    { key: 'rate_diff', header: 'Diff ($)' },
    { key: 'rate_diff_pct', header: 'Diff (%)' },
    { key: 'our_revpar', header: 'Our RevPAR' },
    { key: 'comp_revpar', header: 'Comp RevPAR' },
    { key: 'revpar_index', header: 'RevPAR Index' },
  ];

  const tableRows = rows.map((r) => ({
    report_date: r.report_date ?? '—',
    competitor_name: r.competitor_name ?? '—',
    room_type: r.room_type ?? '—',
    our_rate: fmtUSD(r.our_rate),
    comp_rate: fmtUSD(r.comp_rate),
    rate_diff: r.rate_diff != null
      ? (r.rate_diff > 0
          ? `+$${r.rate_diff.toFixed(2)}`
          : r.rate_diff < 0
          ? `−$${Math.abs(r.rate_diff).toFixed(2)}`
          : '$0.00')
      : '—',
    rate_diff_pct: fmtPct(r.rate_diff_pct),
    our_revpar: fmtUSD(r.our_revpar),
    comp_revpar: fmtUSD(r.comp_revpar),
    revpar_index: fmtIndex(r.revpar_index),
  }));

  return (
    <main style={{ padding: '24px', fontFamily: 'sans-serif' }}>
      <PageHeader pillar="Revenue" tab="Compset" title="Competitive Set Index" />

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: '8px 12px',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: 4,
            fontSize: 13,
          }}
        >
          ⚠️ Data unavailable — showing placeholder. Backend error: {error.message}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiBox label="Our RevPAR" value={avgOurRevpar != null ? fmtUSD(avgOurRevpar) : '—'} />
        <KpiBox label="Comp RevPAR" value={avgCompRevpar != null ? fmtUSD(avgCompRevpar) : '—'} />
        <KpiBox label="RevPAR Index" value={avgIndex != null ? fmtIndex(avgIndex) : '—'} />
        <KpiBox label="Avg Rate Diff" value={avgRateDiffPct != null ? fmtPct(avgRateDiffPct) : '—'} />
      </div>

      {tableRows.length === 0 ? (
        <p style={{ color: '#6c757d', fontStyle: 'italic' }}>
          No compset data available yet. Backend view <code>v_compset_index</code> returned 0 rows.
        </p>
      ) : (
        <DataTable columns={columns} rows={tableRows} />
      )}
    </main>
  );
}
