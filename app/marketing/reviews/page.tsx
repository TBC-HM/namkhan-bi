// app/marketing/reviews/page.tsx

import { getReviews, getReviewStatsBySource, getReviewSummary } from '@/lib/marketing';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

const SOURCE_LABEL: Record<string, string> = {
  google: 'Google',
  tripadvisor: 'TripAdvisor',
  booking: 'Booking.com',
  expedia: 'Expedia',
  agoda: 'Agoda',
  slh: 'SLH',
  direct: 'Direct',
};

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function statusBadge(status: string) {
  const cls =
    status === 'unanswered' ? 'badge badge-alert' :
    status === 'draft'      ? 'badge badge-warn' :
    status === 'responded'  ? 'badge badge-good' :
                              'badge badge-muted';
  const label =
    status === 'unanswered' ? 'Unanswered' :
    status === 'draft'      ? 'Draft' :
    status === 'responded'  ? 'Responded' :
                              'Ignored';
  return <span className={cls}>{label}</span>;
}

export default async function ReviewsPage() {
  const [summary, stats, latest] = await Promise.all([
    getReviewSummary(30),
    getReviewStatsBySource(90),
    getReviews({ limit: 50 }),
  ]);

  const empty = summary.total === 0 && stats.length === 0 && latest.length === 0;

  return (
    <>
      {/* KPI strip */}
      <div className="kpi-strip cols-4">
        <div className="kpi-tile">
          <div className="kpi-label">Reviews 30d</div>
          <div className="kpi-value">{summary.total}</div>
          <div className="kpi-deltas">across all sources</div>
        </div>
        <div className={`kpi-tile ${summary.avg_rating >= 4.5 ? 'good' : summary.avg_rating >= 4 ? '' : 'warn'}`}>
          <div className="kpi-label">Avg Rating</div>
          <div className="kpi-value">{summary.avg_rating ? summary.avg_rating.toFixed(2) : '—'}</div>
          <div className="kpi-deltas">/ 5.00 normalised</div>
        </div>
        <div className={`kpi-tile ${summary.unanswered > 5 ? 'alert' : summary.unanswered > 0 ? 'warn' : 'good'}`}>
          <div className="kpi-label">Unanswered</div>
          <div className="kpi-value">{summary.unanswered}</div>
          <div className="kpi-deltas">awaiting reply</div>
        </div>
        <div className={`kpi-tile ${summary.response_rate >= 0.9 ? 'good' : summary.response_rate >= 0.7 ? 'warn' : 'alert'}`}>
          <div className="kpi-label">Response Rate</div>
          <div className="kpi-value">{(summary.response_rate * 100).toFixed(0)}%</div>
          <div className="kpi-deltas">last 30d</div>
        </div>
      </div>

      {empty && (
        <div className="empty-state">
          <div className="empty-title">No reviews yet</div>
          <div className="empty-body">
            Reviews will appear here once the email parser pipeline is connected.
            Forward review notification emails to your Supabase webhook to populate this table.
          </div>
        </div>
      )}

      {/* Source breakdown */}
      {stats.length > 0 && (
        <div className="section">
          <div className="section-head">
            <div className="section-title">By Source · 90 days</div>
            <div className="section-tag">avg rating · count · unanswered</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th className="num">Reviews</th>
                <th className="num">Avg Rating</th>
                <th className="num">Unanswered</th>
                <th className="num">% of total</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => {
                const total = stats.reduce((a, b) => a + b.count, 0);
                const pct = total > 0 ? (s.count / total) * 100 : 0;
                return (
                  <tr key={s.source}>
                    <td className="label">{SOURCE_LABEL[s.source] ?? s.source}</td>
                    <td className="num">{s.count}</td>
                    <td className="num">{s.avg_rating ? s.avg_rating.toFixed(2) : '—'}</td>
                    <td className={`num ${s.unanswered > 0 ? 'alert' : 'muted'}`}>{s.unanswered}</td>
                    <td className="num muted">{pct.toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Latest feed */}
      {latest.length > 0 && (
        <div className="section">
          <div className="section-head">
            <div className="section-title">Latest Reviews</div>
            <div className="section-tag">most recent first · 50 max</div>
          </div>
          <div className="reviews-feed">
            {latest.map((r) => (
              <div key={r.id} className="review-card">
                <div className="review-head">
                  <div className="review-source">{SOURCE_LABEL[r.source] ?? r.source}</div>
                  <div className="review-rating serif">{r.rating_norm ? r.rating_norm.toFixed(1) : '—'}</div>
                  <div className="review-date">{formatDate(r.reviewed_at ?? r.received_at)}</div>
                  {statusBadge(r.response_status)}
                </div>
                {r.title && <div className="review-title">{r.title}</div>}
                {r.body && <div className="review-body">{r.body}</div>}
                <div className="review-meta">
                  {r.reviewer_name ? <span>{r.reviewer_name}</span> : null}
                  {r.reviewer_country ? <span> · {r.reviewer_country}</span> : null}
                  {r.language && r.language !== 'en' ? <span> · lang {r.language}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
