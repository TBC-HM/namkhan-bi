// app/guest/page.tsx
// Guest · Snapshot — reviews + reputation + inline ActionCards.

import PanelHero from '@/components/sections/PanelHero';
import KpiCard from '@/components/kpi/KpiCard';
import ActionCard, { ActionStack } from '@/components/sections/ActionCard';
import {
  getReviewSummary, getReviewStatsBySource, getSocialAccounts,
} from '@/lib/marketing';

export const revalidate = 300;
export const dynamic = 'force-dynamic';

export default async function GuestSnapshotPage() {
  const [summary, stats, socials] = await Promise.all([
    getReviewSummary(30),
    getReviewStatsBySource(90),
    getSocialAccounts(),
  ]);

  const totalFollowers = socials.reduce((s: number, a: any) => s + (a.followers ?? 0), 0);
  const unanswered = summary.unanswered ?? 0;
  const responseRate = summary.response_rate ?? 0;
  const avgRating = Number(summary.avg_rating ?? 0);

  // Action cards
  const cards: any[] = [];

  // Card 1: Unanswered reviews (priority depends on count)
  if (unanswered > 0) {
    cards.push({
      pillar: 'guest' as const,
      pillarLabel: 'Guest · Reviews',
      agentLabel: '· Review Agent',
      priority: unanswered > 5 ? 'high' as const : 'med' as const,
      priorityLabel: unanswered > 5 ? 'High · SLA breach risk' : 'Medium · 48h aged',
      headline: <>{unanswered} {unanswered === 1 ? 'review' : 'reviews'} <em>awaiting reply</em>.<br />Response rate at {(responseRate * 100).toFixed(0)}%.</>,
      conclusion: <>
        SLH standard is <strong>90% response within 48h</strong>. Currently at{' '}
        <strong>{(responseRate * 100).toFixed(0)}%</strong>. Manual reply required until
        Vertex draft agent ships in Phase 4. Owner should respond personally to any review
        below 4.0.
      </>,
      verdict: [
        { label: `Avg · ${avgRating.toFixed(2)}`, tone: avgRating >= 4.5 ? 'good' as const : 'warn' as const },
        { label: `SLA · ${unanswered > 5 ? 'breached' : 'at risk'}`, tone: unanswered > 5 ? 'bad' as const : 'warn' as const },
        { label: 'Effort · 15min/reply' },
      ],
      primaryAction: 'Open queue',
      secondaryAction: 'Auto-draft',
      tertiaryAction: 'Defer',
      impact: '+0.1 pt',
      impactSub: 'est. score lift',
    });
  }

  // Card 2: Booking.com low rating?
  const bookingStat = stats.find((s: any) => s.source === 'booking');
  if (bookingStat && bookingStat.avg_rating && Number(bookingStat.avg_rating) < 8.5) {
    cards.push({
      pillar: 'guest' as const,
      pillarLabel: 'Guest · Reputation',
      agentLabel: '· Reputation Agent',
      priority: 'med' as const,
      priorityLabel: 'Medium · trend down',
      headline: <>Booking.com score at <em>{Number(bookingStat.avg_rating).toFixed(1)}</em>.<br />Below 8.5 visibility threshold.</>,
      conclusion: <>
        Properties below 8.5 on Booking.com lose preferred-listing placement. Investigate
        recent low scorers, identify recurring complaint themes (room cleanliness? wifi?
        breakfast?), and brief the team. Consider a 30-day reputation push.
      </>,
      verdict: [
        { label: `Score · ${Number(bookingStat.avg_rating).toFixed(1)}`, tone: 'warn' as const },
        { label: 'Threshold · 8.5' },
        { label: '90d window' },
      ],
      primaryAction: 'See drilldown',
      secondaryAction: 'Brief team',
      tertiaryAction: 'Defer',
      impact: 'Visibility',
      impactSub: 'preferred listing risk',
    });
  }

  return (
    <>
      <PanelHero
        eyebrow="Guest · Snapshot"
        title="The voice"
        emphasis="of the house"
        sub="Reviews · reputation · social presence"
        kpis={
          <>
            <KpiCard label="Reviews 30d" value={summary.total ?? 0} hint={`${unanswered} unanswered`} />
            <KpiCard
              label="Avg Rating"
              value={avgRating ? avgRating.toFixed(2) : '—'}
              kind="text"
              tone={avgRating >= 4.5 ? 'pos' : avgRating >= 4 ? 'neutral' : 'warn'}
            />
            <KpiCard
              label="Response Rate"
              value={responseRate * 100}
              kind="pct"
              tone={responseRate >= 0.9 ? 'pos' : responseRate >= 0.7 ? 'warn' : 'neg'}
              hint="last 30d · SLH 90%"
            />
            <KpiCard label="Social Followers" value={totalFollowers} hint={`${socials.length} channels`} />
          </>
        }
      />

      {cards.length > 0 && (
        <ActionStack
          title={<><em>The replies</em><br />arriving.</>}
          count={cards.length}
          meta={`${cards.length} awaiting · guest pillar`}
        >
          {cards.map((c, i) => (
            <ActionCard key={i} num={i + 1} {...c} />
          ))}
        </ActionStack>
      )}
    </>
  );
}
