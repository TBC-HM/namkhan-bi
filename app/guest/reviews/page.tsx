'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

interface ReviewRow {
  review_id?: string | number;
  platform?: string;
  guest_name?: string;
  rating?: number | string;
  review_date?: string;
  review_text?: string;
  sentiment?: string;
  responded?: boolean | string;
  response_date?: string;
  category?: string;
}

export default function GuestReviewsPage() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    void (async () => {
      // Try the canonical view first; fall back to raw table
      const { data: viewData } = await supabase
        .from('v_reviews_recent')
        .select('*')
        .order('review_date', { ascending: false })
        .limit(100);

      if (viewData && viewData.length > 0) {
        setRows(viewData);
        setLoading(false);
        return;
      }

      // Fallback: guest schema reviews table
      const { data: tableData } = await supabase
        .schema('guest')
        .from('reviews')
        .select('*')
        .order('review_date', { ascending: false })
        .limit(100);

      setRows(tableData ?? []);
      setLoading(false);
    })();
  }, []);

  // Derived KPIs
  const total = rows.length;
  const avgRating =
    total > 0
      ? (
          rows.reduce((sum, r) => sum + Number(r.rating ?? 0), 0) / total
        ).toFixed(1)
      : '—';
  const respondedCount = rows.filter(
    (r) => r.responded === true || r.responded === 'true' || r.responded === '1'
  ).length;
  const responseRate =
    total > 0 ? `${Math.round((respondedCount / total) * 100)}%` : '—';
  const negativeCount = rows.filter(
    (r) => Number(r.rating) <= 2
  ).length;

  const columns: { key: keyof ReviewRow | string; header: string }[] = [
    { key: 'review_date', header: 'Date' },
    { key: 'platform', header: 'Platform' },
    { key: 'guest_name', header: 'Guest' },
    { key: 'rating', header: 'Rating' },
    { key: 'category', header: 'Category' },
    { key: 'sentiment', header: 'Sentiment' },
    { key: 'responded', header: 'Responded?' },
    { key: 'review_text', header: 'Excerpt' },
  ];

  const displayRows = rows.map((r) => ({
    ...r,
    review_date: r.review_date
      ? r.review_date.slice(0, 10)
      : '—',
    guest_name: r.guest_name ?? '—',
    platform: r.platform ?? '—',
    rating: r.rating != null ? String(r.rating) : '—',
    category: r.category ?? '—',
    sentiment: r.sentiment ?? '—',
    responded:
      r.responded === true || r.responded === 'true' || r.responded === '1'
        ? 'Yes'
        : 'No',
    review_text: r.review_text
      ? String(r.review_text).slice(0, 120) + (String(r.review_text).length > 120 ? '…' : '')
      : '—',
  }));

  return (
    <main style={{ padding: '24px', fontFamily: 'inherit' }}>
      <PageHeader pillar="Guest" tab="Reviews" title="Guest Reviews" />

      {loading && (
        <p style={{ color: '#888', margin: '16px 0' }}>Loading reviews…</p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          margin: '24px 0',
        }}
      >
        <KpiBox label="Total Reviews" value={String(total)} />
        <KpiBox label="Avg Rating" value={avgRating} />
        <KpiBox label="Response Rate" value={responseRate} />
        <KpiBox label="Negative (≤2★)" value={String(negativeCount)} />
      </div>

      <DataTable
        columns={columns}
        rows={displayRows}
      />
    </main>
  );
}
