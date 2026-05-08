// app/marketing/reviews/page.tsx
import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function ReviewsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch reviews data — falls back to empty array if view not yet created
  const { data: reviews } = await supabase
    .from('v_marketing_reviews')
    .select('*')
    .order('review_date', { ascending: false })
    .limit(100);

  const rows = reviews ?? [];

  // Aggregate KPIs
  const total = rows.length;
  const avgScore =
    total > 0
      ? (
          rows.reduce((sum: number, r: Record<string, unknown>) => sum + (Number(r.score) || 0), 0) /
          total
        ).toFixed(1)
      : '—';
  const unanswered = rows.filter((r: Record<string, unknown>) => !r.response_date).length;
  const positive = rows.filter((r: Record<string, unknown>) => Number(r.score) >= 4).length;
  const positiveRate =
    total > 0 ? `${Math.round((positive / total) * 100)}%` : '—';

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        padding: '24px',
        fontFamily: 'var(--font-sans, sans-serif)',
      }}
    >
      <PageHeader pillar="Marketing" tab="Reviews" title="Guest Reviews" />

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Total Reviews" value={total > 0 ? String(total) : '—'} />
        <KpiBox label="Avg Score" value={avgScore} />
        <KpiBox label="Positive Rate (≥4)" value={positiveRate} />
        <KpiBox label="Unanswered" value={unanswered > 0 ? String(unanswered) : '—'} />
      </div>

      {/* Reviews table */}
      <DataTable
        columns={[
          { key: 'review_date', header: 'Date' },
          { key: 'platform', header: 'Platform' },
          { key: 'guest_name', header: 'Guest' },
          { key: 'score', header: 'Score' },
          { key: 'title', header: 'Title' },
          { key: 'comment', header: 'Comment' },
          { key: 'status', header: 'Status' },
          { key: 'response_date', header: 'Responded' },
        ]}
        rows={rows.map((r: Record<string, unknown>) => ({
          ...r,
          review_date: r.review_date
            ? String(r.review_date).slice(0, 10)
            : '—',
          response_date: r.response_date
            ? String(r.response_date).slice(0, 10)
            : '—',
          guest_name: r.guest_name ?? '—',
          platform: r.platform ?? '—',
          score: r.score != null ? String(r.score) : '—',
          title: r.title ?? '—',
          comment: r.comment ?? '—',
          status: r.status ?? '—',
        }))}
      />

      {rows.length === 0 && (
        <p
          style={{
            marginTop: 48,
            textAlign: 'center',
            color: '#666',
            fontSize: 14,
          }}
        >
          No review data available — view <code>v_marketing_reviews</code> not yet populated.
        </p>
      )}
    </main>
  );
}
