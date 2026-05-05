// app/guest/reputation/page.tsx — NEW canonical reviews/reputation page.
// Replaces /guest/reviews + /marketing/reviews (both redirect here).
// compset-pattern: PageHeader + status header + 3 wired graphs + canonical KpiBox + review feed.

import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
import { getReviews, getReviewStatsBySource, getReviewSummary } from '@/lib/marketing';
import {
  GuestStatusHeader, StatusCell, SectionHead,
  metaSm, metaStrong, metaDim, cardWrap, cardTitle, cardSub,
} from '../_components/GuestShell';
import AgentTopRow from '../_components/AgentTopRow';

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

function statusToTone(status: string): 'active' | 'pending' | 'expired' | 'inactive' {
  if (status === 'responded') return 'active';
  if (status === 'draft') return 'pending';
  if (status === 'unanswered') return 'expired';
  return 'inactive';
}

export default async function ReputationPage() {
  const [summary, stats, latest] = await Promise.all([
    getReviewSummary(30),
    getReviewStatsBySource(90),
    getReviews({ limit: 50 }),
  ]);

  const total = summary.total ?? 0;
  const avgRating = summary.avg_rating != null ? Number(summary.avg_rating) : null;
  const unanswered = summary.unanswered ?? 0;
  const responseRate = (summary.response_rate ?? 0) * 100;
  const totalForSourceMix = stats.reduce((a: number, b: any) => a + b.count, 0);

  // Sentiment over 90d — bucket by week from `latest` (real reviews timestamps).
  const weekly = new Map<string, { sum: number; n: number }>();
  for (const r of latest) {
    const ts = (r as any).reviewed_at ?? (r as any).received_at;
    if (!ts) continue;
    const d = new Date(ts);
    const w = new Date(d);
    w.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const k = w.toISOString().slice(0, 10);
    const rating = (r as any).rating_norm != null ? Number((r as any).rating_norm) : null;
    if (rating == null) continue;
    if (!weekly.has(k)) weekly.set(k, { sum: 0, n: 0 });
    const slot = weekly.get(k)!;
    slot.sum += rating;
    slot.n += 1;
  }
  const sentimentSeries = Array.from(weekly.entries())
    .map(([w, v]) => ({ week: w, avg: v.n > 0 ? v.sum / v.n : 0, n: v.n }))
    .sort((a, b) => a.week.localeCompare(b.week));

  return (
    <>
      <PageHeader
        pillar="Guest"
        tab="Reputation"
        title={
          <>
            What guests{' '}
            <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>say</em>{' '}
            — every channel, every reply.
          </>
        }
        lede={`${total} reviews 30d · ${avgRating != null ? avgRating.toFixed(2) : '—'}/5 avg · ${unanswered} unanswered · ${responseRate.toFixed(0)}% response rate`}
      />

      <GuestStatusHeader
        top={
          <>
            {/* AGENT on top — wired from governance.agents */}
            <AgentTopRow code="review_agent" fallbackName="Review Agent" />
            <span style={{ flex: 1 }} />
            <StatusCell label="SOURCE">
              <StatusPill tone="active">marketing.reviews</StatusPill>
              <span style={metaDim}>· guest.review_replies · review_themes</span>
            </StatusCell>
          </>
        }
        bottom={
          <>
            <StatusCell label="WINDOW">
              <span style={metaSm}>30 days</span>
            </StatusCell>
            <StatusCell label="SOURCES">
              <span style={metaStrong}>{stats.length}</span>
              <span style={metaDim}>OTAs · direct · SLH</span>
            </StatusCell>
            <StatusCell label="REPLY QUEUE">
              <StatusPill tone={unanswered > 5 ? 'expired' : unanswered > 0 ? 'pending' : 'active'}>{unanswered}</StatusPill>
              <span style={metaDim}>unanswered · 48h SLA</span>
            </StatusCell>
            <StatusCell label="RESPONSE">
              <span style={metaSm}>{responseRate.toFixed(0)}%</span>
              <span style={metaDim}>SLH target 90%</span>
            </StatusCell>
            <span style={{ flex: 1 }} />
          </>
        }
      />

      {/* 3 GRAPHS — all wired */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 12,
          marginTop: 14,
        }}
      >
        <SourceMixChart rows={stats} totalForSourceMix={totalForSourceMix} />
        <SentimentTrendChart rows={sentimentSeries} />
        <ResponseQueueChart unanswered={unanswered} answered={Math.max(0, total - unanswered)} />
      </div>

      {/* KPI ROW */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginTop: 14,
        }}
      >
        <KpiBox value={total} unit="count" label="Reviews 30d" tooltip="Across every source" />
        <KpiBox
          value={avgRating}
          unit="nights"
          dp={2}
          label="Avg rating /5"
        />
        <KpiBox
          value={unanswered}
          unit="count"
          label="Unanswered"
          tooltip="Awaiting reply · 48h SLA"
        />
        <KpiBox
          value={responseRate}
          unit="pct"
          label="Response rate"
          tooltip="last 30d · SLH target 90%"
        />
      </div>

      {/* SOURCE TABLE */}
      {stats.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <SectionHead
            title="By source"
            emphasis="90 days"
            sub="Avg rating · count · unanswered"
            source="marketing.reviews"
          />
          <div style={{ overflowX: 'auto', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={th}>Source</th>
                  <th style={{ ...th, textAlign: 'right' }}>Reviews</th>
                  <th style={{ ...th, textAlign: 'right' }}>Avg /5</th>
                  <th style={{ ...th, textAlign: 'right' }}>Unanswered</th>
                  <th style={{ ...th, textAlign: 'right' }}>% of total</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s: any) => {
                  const pct = totalForSourceMix > 0 ? (s.count / totalForSourceMix) * 100 : 0;
                  return (
                    <tr key={s.source}>
                      <td style={td}><strong>{SOURCE_LABEL[s.source] ?? s.source}</strong></td>
                      <td style={{ ...td, textAlign: 'right' }}>{s.count}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{s.avg_rating ? Number(s.avg_rating).toFixed(2) : '—'}</td>
                      <td style={{ ...td, textAlign: 'right', color: s.unanswered > 0 ? 'var(--st-bad)' : 'var(--ink-mute)' }}>{s.unanswered}</td>
                      <td style={{ ...td, textAlign: 'right', color: 'var(--ink-mute)' }}>{pct.toFixed(0)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REVIEW FEED */}
      {latest.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <SectionHead
            title="Latest reviews"
            emphasis={`${latest.length} most recent`}
            sub="Newest first · max 50"
            source="marketing.reviews"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {latest.map((r: any) => (
              <div key={r.id} style={reviewCard}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)', fontWeight: 600 }}>
                    {SOURCE_LABEL[r.source] ?? r.source}
                  </span>
                  <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 600 }}>
                    {r.rating_norm ? Number(r.rating_norm).toFixed(1) : '—'} / 5
                  </span>
                  <span style={{ ...metaDim }}>{formatDate(r.reviewed_at ?? r.received_at)}</span>
                  <StatusPill tone={statusToTone(r.response_status)}>
                    {r.response_status === 'unanswered' ? 'UNANSWERED'
                      : r.response_status === 'draft' ? 'DRAFT'
                      : r.response_status === 'responded' ? 'RESPONDED' : 'IGNORED'}
                  </StatusPill>
                </div>
                {r.title && (
                  <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-lg)', fontWeight: 500, color: 'var(--ink)' }}>
                    {r.title}
                  </div>
                )}
                {r.body && <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)', marginTop: 2 }}>{r.body}</div>}
                <div style={{ ...metaDim, marginTop: 4 }}>
                  {r.reviewer_name && <span>{r.reviewer_name}</span>}
                  {r.reviewer_country && <span> · {r.reviewer_country}</span>}
                  {r.language && r.language !== 'en' && <span> · lang {r.language}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {total === 0 && stats.length === 0 && (
        <div style={{ padding: 32, marginTop: 18, background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
          No reviews yet. Forward review notification emails to your Supabase webhook to populate <code>marketing.reviews</code>.
        </div>
      )}
    </>
  );
}

// ===== Wired charts =====

function SourceMixChart({ rows, totalForSourceMix }: { rows: any[]; totalForSourceMix: number }) {
  if (rows.length === 0) {
    return <Empty title="Reviews by source" sub="90d · count + avg rating" msg="No source data yet" />;
  }
  const sorted = [...rows].sort((a, b) => b.count - a.count).slice(0, 7);
  const max = Math.max(1, ...sorted.map((r) => r.count));
  const w = 320, lineH = 24, h = Math.max(180, sorted.length * lineH + 16);
  const labelW = 100, valW = 80, barMaxW = w - labelW - valW - 8;

  return (
    <div style={cardWrap}>
      <div style={cardTitle}>Reviews by source</div>
      <div style={cardSub}>90d · count + avg /5</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
        {sorted.map((r: any, i) => {
          const y = 6 + i * lineH;
          const barW = (r.count / max) * barMaxW;
          const pct = totalForSourceMix > 0 ? (r.count / totalForSourceMix) * 100 : 0;
          const fill =
            r.unanswered > 0 ? 'var(--brass)' : (r.avg_rating ?? 0) >= 4.5 ? 'var(--moss)' : 'var(--brass-soft)';
          return (
            <g key={r.source}>
              <text x={labelW - 4} y={y + 14} textAnchor="end" style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink)' }}>
                {SOURCE_LABEL[r.source] ?? r.source}
              </text>
              <rect x={labelW} y={y + 4} width={barMaxW} height={14} fill="var(--paper-deep)" />
              <rect x={labelW} y={y + 4} width={barW} height={14} fill={fill}>
                <title>{`${SOURCE_LABEL[r.source] ?? r.source} · ${r.count} reviews · ${r.avg_rating ? Number(r.avg_rating).toFixed(2) : '—'}/5 · ${r.unanswered} unanswered`}</title>
              </rect>
              <text x={labelW + barMaxW + 4} y={y + 14} style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink-soft)' }}>
                {r.count} · {pct.toFixed(0)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SentimentTrendChart({ rows }: { rows: { week: string; avg: number; n: number }[] }) {
  if (rows.length === 0) {
    return <Empty title="Sentiment trend" sub="weekly avg · /5" msg="No timestamped reviews yet" />;
  }
  const w = 320, h = 200, padL = 28, padR = 6, padT = 16, padB = 24;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const min = 1, max = 5;
  const xAt = (i: number) => padL + (i / Math.max(1, rows.length - 1)) * innerW;
  const yAt = (v: number) => padT + innerH - ((v - min) / (max - min)) * innerH;

  const path = rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(r.avg).toFixed(1)}`).join(' ');

  return (
    <div style={cardWrap}>
      <div style={cardTitle}>Sentiment trend</div>
      <div style={cardSub}>Weekly avg rating /5 · last 90d</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 200 }}>
        {[1, 2, 3, 4, 5].map((y) => (
          <line key={y} x1={padL} x2={w - padR} y1={yAt(y)} y2={yAt(y)} stroke="var(--paper-deep)" strokeDasharray={y === 4.5 ? '4 3' : ''} />
        ))}
        <text x={4} y={yAt(5) + 3} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>5</text>
        <text x={4} y={yAt(4.5) + 3} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--brass)' }}>4.5</text>
        <text x={4} y={yAt(1) + 3} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>1</text>
        <path d={path} fill="none" stroke="var(--moss)" strokeWidth={2} />
        {rows.map((r, i) => (
          <circle key={r.week} cx={xAt(i)} cy={yAt(r.avg)} r={3} fill="var(--moss)">
            <title>{`${r.week} · avg ${r.avg.toFixed(2)}/5 · ${r.n} review${r.n === 1 ? '' : 's'}`}</title>
          </circle>
        ))}
        {rows.length > 0 && (
          <>
            <text x={padL} y={h - 6} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>{rows[0].week.slice(5)}</text>
            <text x={w - padR - 30} y={h - 6} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>{rows[rows.length - 1].week.slice(5)}</text>
          </>
        )}
      </svg>
    </div>
  );
}

function ResponseQueueChart({ unanswered, answered }: { unanswered: number; answered: number }) {
  const total = unanswered + answered;
  if (total === 0) {
    return <Empty title="Reply queue" sub="answered vs unanswered · 30d" msg="No reviews in window" />;
  }
  const responseRate = total > 0 ? (answered / total) * 100 : 0;
  return (
    <div style={cardWrap}>
      <div style={cardTitle}>Reply queue</div>
      <div style={cardSub}>Answered vs unanswered · 30d</div>
      <svg viewBox="0 0 320 200" style={{ width: '100%', height: 200 }}>
        <rect x={16} y={70} width={288} height={28} fill="var(--paper-deep)" />
        <rect x={16} y={70} width={(answered / total) * 288} height={28} fill="var(--moss)">
          <title>{`Answered · ${answered} · ${responseRate.toFixed(0)}%`}</title>
        </rect>
        <rect x={16 + (answered / total) * 288} y={70} width={(unanswered / total) * 288} height={28} fill="var(--st-bad)">
          <title>{`Unanswered · ${unanswered}`}</title>
        </rect>
        <text x={20} y={86} style={{ fontFamily: 'var(--mono)', fontSize: 11, fill: 'var(--paper-warm)', fontWeight: 600 }}>
          {answered} answered · {responseRate.toFixed(0)}%
        </text>
        {unanswered > 0 && (
          <text x={304} y={86} textAnchor="end" style={{ fontFamily: 'var(--mono)', fontSize: 11, fill: 'var(--paper-warm)', fontWeight: 600 }}>
            {unanswered} open
          </text>
        )}
        <text x={16} y={130} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>
          target 90% — every overdue line is a TripAdvisor / BDC ranking risk
        </text>
        <line x1={16 + (90 / 100) * 288} y1={66} x2={16 + (90 / 100) * 288} y2={104} stroke="var(--brass)" strokeDasharray="3 2" />
        <text x={16 + (90 / 100) * 288} y={62} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--brass)' }}>
          90%
        </text>
      </svg>
    </div>
  );
}

function Empty({ title, sub, msg }: { title: string; sub: string; msg: string }) {
  return (
    <div style={cardWrap}>
      <div style={cardTitle}>{title}</div>
      <div style={cardSub}>{sub}</div>
      <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 'var(--t-sm)' }}>
        {msg}
      </div>
    </div>
  );
}

const reviewCard: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 6,
  padding: '10px 14px',
};
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  background: 'var(--paper-deep)',
  borderBottom: '1px solid var(--paper-deep)',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  color: 'var(--brass)',
  fontWeight: 600,
};
const td: React.CSSProperties = {
  padding: '6px 12px',
  borderBottom: '1px solid var(--paper-deep)',
  fontFamily: 'var(--mono)',
  fontSize: 12,
  color: 'var(--ink)',
};
