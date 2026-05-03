// app/marketing/reviews/page.tsx
// Marketing · Reviews — full feed across sources.

import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import Insight from '@/components/sections/Insight';
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
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusPill(status: string) {
  const tone =
    status === 'unanswered' ? 'bad' :
    status === 'draft'      ? 'warn' :
    status === 'responded'  ? 'good' : '';
  const label =
    status === 'unanswered' ? 'Unanswered' :
    status === 'draft'      ? 'Draft' :
    status === 'responded'  ? 'Responded' : 'Ignored';
  return <span className={`pill ${tone}`}>{label}</span>;
}

export default async function ReviewsPage() {
  const [summary, stats, latest] = await Promise.all([
    getReviewSummary(30),
    getReviewStatsBySource(90),
    getReviews({ limit: 50 }),
  ]);

  const empty = (summary.total ?? 0) === 0 && stats.length === 0 && latest.length === 0;
  const totalForSourceMix = stats.reduce((a: number, b: any) => a + b.count, 0);

  return (
    <>
      <PanelHero
        eyebrow="Reviews · 30d"
        title="Guest"
        emphasis="reviews"
        sub="All sources · response rate · ratings normalised /5"
        kpis={
          <>
            <KpiCard label="Reviews 30d" value={summary.total ?? 0} hint="across all sources" />
            <KpiCard
              label="Avg Rating"
              value={summary.avg_rating ? Number(summary.avg_rating).toFixed(2) : '—'}
              kind="text"
              tone={
                (summary.avg_rating ?? 0) >= 4.5 ? 'pos' :
                (summary.avg_rating ?? 0) >= 4 ? 'neutral' : 'warn'
              }
              hint="/ 5.00 normalised"
            />
            <KpiCard
              label="Unanswered"
              value={summary.unanswered ?? 0}
              tone={
                (summary.unanswered ?? 0) > 5 ? 'neg' :
                (summary.unanswered ?? 0) > 0 ? 'warn' : 'pos'
              }
              hint="awaiting reply"
            />
            <KpiCard
              label="Response Rate"
              value={(summary.response_rate ?? 0) * 100}
              kind="pct"
              tone={
                (summary.response_rate ?? 0) >= 0.9 ? 'pos' :
                (summary.response_rate ?? 0) >= 0.7 ? 'warn' : 'neg'
              }
              hint="last 30d · SLH target 90%"
            />
          </>
        }
      />

      {empty ? (
        <Card title="No reviews yet" sub="Awaiting email parser pipeline">
          <div className="stub" style={{ padding: 32 }}>
            <h3>No reviews yet</h3>
            <p>
              Reviews will appear here once the email parser pipeline is connected.
              Forward review notification emails to your Supabase webhook to populate this table.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {stats.length > 0 && (
            <Card title="By source" emphasis="· 90 days" sub="Avg rating · count · unanswered" source="marketing.reviews">
              <table className="tbl">
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
                  {stats.map((s: any) => {
                    const pct = totalForSourceMix > 0 ? (s.count / totalForSourceMix) * 100 : 0;
                    return (
                      <tr key={s.source}>
                        <td className="lbl"><strong>{SOURCE_LABEL[s.source] ?? s.source}</strong></td>
                        <td className="num">{s.count}</td>
                        <td className="num">{s.avg_rating ? Number(s.avg_rating).toFixed(2) : '—'}</td>
                        <td className={`num ${s.unanswered > 0 ? 'text-bad' : 'text-mute'}`}>
                          {s.unanswered}
                        </td>
                        <td className="num text-mute">{pct.toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}

          {latest.length > 0 && (
            <Card title="Latest reviews" sub="Most recent first · max 50" source="marketing.reviews" className="mt-22">
              <div className="reviews-feed">
                {latest.map((r: any) => (
                  <div key={r.id} className="review-card">
                    <div className="review-head">
                      <div className="review-source">{SOURCE_LABEL[r.source] ?? r.source}</div>
                      <div className="review-rating">{r.rating_norm ? Number(r.rating_norm).toFixed(1) : '—'}</div>
                      <div className="review-date">{formatDate(r.reviewed_at ?? r.received_at)}</div>
                      {statusPill(r.response_status)}
                    </div>
                    {r.title && (
                      <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: "var(--t-lg)", fontWeight: 500, color: 'var(--ink)' }}>
                        {r.title}
                      </div>
                    )}
                    {r.body && <div className="review-body">{r.body}</div>}
                    <div style={{ fontFamily: 'var(--mono)', fontSize: "var(--t-xs)", color: 'var(--ink-mute)', letterSpacing: '0.04em' }}>
                      {r.reviewer_name && <span>{r.reviewer_name}</span>}
                      {r.reviewer_country && <span> · {r.reviewer_country}</span>}
                      {r.language && r.language !== 'en' && <span> · lang {r.language}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {(summary.unanswered ?? 0) > 0 && (
            <Insight tone={(summary.unanswered ?? 0) > 5 ? 'alert' : 'warn'} eye="Reply queue">
              <strong>{summary.unanswered} unanswered.</strong> Owner action: respond within
              48h to maintain SLH 90% response-rate standard.
            </Insight>
          )}
        </>
      )}
    </>
  );
}
