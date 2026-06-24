// app/guest/reviews/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface ReviewRow {
  review_date?: string | null;
  platform?: string | null;
  guest_name?: string | null;
  rating?: number | null;
  title?: string | null;
  review_text?: string | null;
  response_status?: string | null;
  reviewer_nationality?: string | null;
  sentiment?: string | null;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .schema('guest' as never)
    .from('v_reviews_recent')
    .select('*')
    .order('review_date', { ascending: false })
    .limit(50);

  const rows: ReviewRow[] = (data as ReviewRow[] | null) ?? [];

  // Derived KPIs
  const totalReviews = rows.length;
  const rated = rows.filter((r) => r.rating != null);
  const avgRating =
    rated.length > 0
      ? (rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length).toFixed(1)
      : '—';
  const positiveCount = rows.filter(
    (r) => (r.sentiment ?? '').toLowerCase() === 'positive'
  ).length;
  const pendingResponse = rows.filter(
    (r) => (r.response_status ?? '').toLowerCase() === 'pending'
  ).length;

  const columns = [
    { key: 'review_date', header: 'Date' },
    { key: 'platform', header: 'Platform' },
    { key: 'guest_name', header: 'Guest' },
    { key: 'rating', header: 'Rating' },
    { key: 'title', header: 'Title' },
    { key: 'sentiment', header: 'Sentiment' },
    { key: 'response_status', header: 'Response' },
    { key: 'reviewer_nationality', header: 'Nationality' },
  ];

  const tableRows = rows.map((r) => ({
    review_date: r.review_date ?? '—',
    platform: r.platform ?? '—',
    guest_name: r.guest_name ?? '—',
    rating: r.rating != null ? `${r.rating} ★` : '—',
    title: r.title ?? '—',
    sentiment: r.sentiment ?? '—',
    response_status: r.response_status ?? '—',
    reviewer_nationality: r.reviewer_nationality ?? '—',
  }));

  return (
    <main style={{ padding: '24px', fontFamily: 'inherit' }}>
      <PageHeader pillar="Guest" tab="Reviews" title="Guest Reviews" />

      {error && (
        <p style={{ color: '#c0392b', marginBottom: 16, fontSize: 13 }}>
          ⚠ Could not load live data ({error.message}). Showing cached or empty state.
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Reviews (recent)" value={String(totalReviews)} />
        <KpiBox label="Avg Rating" value={String(avgRating)} />
        <KpiBox label="Positive Sentiment" value={String(positiveCount)} />
        <KpiBox label="Pending Response" value={String(pendingResponse)} />
      </div>

      <DataTable columns={columns} rows={tableRows} />
    </main>
  );
}
