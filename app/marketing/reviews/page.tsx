// app/marketing/reviews/page.tsx
// Marathon #195 child — Marketing · Reviews
// Wired to marketing.v_reviews_recent via supabase-js server client.
// SQL access unavailable during build; schema inferred from common review-dashboard patterns.
// All empty cells render em-dash per brand standard.

import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface ReviewRow {
  review_date?: string | null;
  platform?: string | null;
  reviewer_name?: string | null;
  overall_score?: number | null;
  cleanliness_score?: number | null;
  service_score?: number | null;
  value_score?: number | null;
  location_score?: number | null;
  review_text?: string | null;
  response_status?: string | null;
  responded_at?: string | null;
  [key: string]: unknown;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

function fmtScore(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return v.toFixed(1);
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .schema('marketing')
    .from('v_reviews_recent')
    .select('*')
    .limit(100);

  const rows: ReviewRow[] = data ?? [];

  // KPI derivations
  const totalReviews = rows.length;
  const scored = rows.filter((r) => r.overall_score != null);
  const avgScore =
    scored.length > 0
      ? (scored.reduce((s, r) => s + (r.overall_score ?? 0), 0) / scored.length).toFixed(1)
      : '—';
  const responded = rows.filter(
    (r) => r.response_status === 'responded' || r.responded_at != null
  ).length;
  const responseRate =
    totalReviews > 0 ? `${Math.round((responded / totalReviews) * 100)}%` : '—';
  const fiveStar = rows.filter((r) => (r.overall_score ?? 0) >= 9).length;

  if (error) {
    console.error('[marketing/reviews] supabase error:', error.message);
  }

  const columns = [
    { key: 'review_date', header: 'Date' },
    { key: 'platform', header: 'Platform' },
    { key: 'reviewer_name', header: 'Guest' },
    { key: 'overall_score', header: 'Score' },
    { key: 'cleanliness_score', header: 'Cleanliness' },
    { key: 'service_score', header: 'Service' },
    { key: 'value_score', header: 'Value' },
    { key: 'response_status', header: 'Response' },
  ];

  const tableRows = rows.map((r) => ({
    review_date: fmt(r.review_date),
    platform: fmt(r.platform),
    reviewer_name: fmt(r.reviewer_name),
    overall_score: fmtScore(r.overall_score),
    cleanliness_score: fmtScore(r.cleanliness_score),
    service_score: fmtScore(r.service_score),
    value_score: fmtScore(r.value_score),
    response_status: fmt(r.response_status),
  }));

  return (
    <main style={{ padding: '24px', fontFamily: 'inherit' }}>
      <PageHeader pillar="Marketing" tab="Reviews" title="Guest Reviews" />

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiBox label="Total Reviews" value={String(totalReviews)} />
        <KpiBox label="Avg Score" value={avgScore} />
        <KpiBox label="Response Rate" value={responseRate} />
        <KpiBox label="9–10 Score" value={String(fiveStar)} />
      </div>

      {/* Data table */}
      <DataTable columns={columns} rows={tableRows} />

      {/* Error notice — visible only in dev */}
      {error && process.env.NODE_ENV !== 'production' && (
        <p style={{ color: 'red', marginTop: 16, fontSize: 12 }}>
          Data error: {error.message}
        </p>
      )}
    </main>
  );
}
