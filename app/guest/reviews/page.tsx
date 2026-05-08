'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ReviewRow {
  id?: string | number;
  review_date?: string;
  platform?: string;
  guest_name?: string;
  rating?: number;
  category?: string;
  review_text?: string;
  responded_at?: string;
  sentiment?: string;
}

const pillColor = (sentiment?: string) => {
  if (!sentiment) return '#555';
  const s = sentiment.toLowerCase();
  if (s === 'positive') return '#22c55e';
  if (s === 'negative') return '#ef4444';
  return '#f59e0b';
};

const starRating = (n?: number) => {
  if (!n) return '—';
  return '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
};

export default function GuestReviewsPage() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('v_guest_reviews')
        .select('*')
        .order('review_date', { ascending: false })
        .limit(100);
      setRows(data ?? []);
      setLoading(false);
    };
    void load();
  }, []);

  const platforms = Array.from(new Set(rows.map((r) => r.platform ?? '').filter(Boolean)));

  const filtered = filter
    ? rows.filter((r) => (r.platform ?? '') === filter)
    : rows;

  const avg =
    rows.length > 0
      ? (rows.reduce((s, r) => s + (r.rating ?? 0), 0) / rows.length).toFixed(2)
      : '—';

  const positive = rows.filter((r) => r.sentiment?.toLowerCase() === 'positive').length;
  const negative = rows.filter((r) => r.sentiment?.toLowerCase() === 'negative').length;
  const neutral = rows.filter(
    (r) =>
      !r.sentiment ||
      (r.sentiment.toLowerCase() !== 'positive' && r.sentiment.toLowerCase() !== 'negative')
  ).length;

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
        padding: '32px 24px',
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontSize: 12,
            color: '#666',
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: 4,
          }}
        >
          Guest
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Reviews</h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        {[
          { label: 'Total Reviews', value: loading ? '…' : String(rows.length) },
          { label: 'Avg Rating', value: loading ? '…' : avg },
          { label: 'Positive', value: loading ? '…' : String(positive) },
          { label: 'Negative', value: loading ? '…' : String(negative) },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: '#111',
              border: '1px solid #222',
              borderRadius: 8,
              padding: '20px 24px',
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: '#888',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {k.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilter('')}
          style={{
            background: filter === '' ? '#fff' : '#111',
            color: filter === '' ? '#000' : '#aaa',
            border: '1px solid #333',
            borderRadius: 20,
            padding: '6px 16px',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          All
        </button>
        {platforms.map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            style={{
              background: filter === p ? '#fff' : '#111',
              color: filter === p ? '#000' : '#aaa',
              border: '1px solid #333',
              borderRadius: 20,
              padding: '6px 16px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #222' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#111', textAlign: 'left' }}>
              {['Date', 'Platform', 'Guest', 'Rating', 'Category', 'Sentiment', 'Review', 'Responded'].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: '12px 16px',
                      color: '#888',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      fontSize: 11,
                      letterSpacing: 1,
                      borderBottom: '1px solid #222',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#555' }}>
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#555' }}>
                  No reviews found.
                </td>
              </tr>
            ) : (
              filtered.map((r, i) => (
                <tr
                  key={r.id ?? i}
                  style={{
                    borderBottom: '1px solid #1a1a1a',
                    background: i % 2 === 0 ? '#000' : '#0a0a0a',
                  }}
                >
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: '#aaa' }}>
                    {r.review_date ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    {r.platform ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    {r.guest_name ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: '#f59e0b' }}>
                    {starRating(r.rating)}
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: '#aaa' }}>
                    {r.category ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        background: pillColor(r.sentiment),
                        color: '#000',
                        borderRadius: 12,
                        padding: '2px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}
                    >
                      {r.sentiment ?? '—'}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      maxWidth: 320,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: '#ccc',
                    }}
                  >
                    {r.review_text ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: '#aaa' }}>
                    {r.responded_at ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: '#444' }}>
        {filtered.length} review{filtered.length !== 1 ? 's' : ''} shown
        {filter ? ` · filtered by ${filter}` : ''} · Neutral: {neutral}
      </div>
    </main>
  );
}
