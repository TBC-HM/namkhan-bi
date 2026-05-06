// app/guest/page.tsx — REDESIGN 2026-05-05 (recovery)
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
import { getReviewSummary, getReviewStatsBySource, getSocialAccounts } from '@/lib/marketing';
import { resolvePeriod } from '@/lib/period';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import {
  GuestStatusHeader, StatusCell, SectionHead,
  metaSm, metaStrong, metaDim,
} from './_components/GuestShell';
import AgentTopRow from './_components/AgentTopRow';
import Reachable, { countReachable } from './_components/Reachable';

export const revalidate = 300;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function GuestSnapshotPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);
  const [summary, stats, socials, profilesR] = await Promise.all([
    getReviewSummary(period.days),
    getReviewStatsBySource(Math.max(period.days, 90)),
    getSocialAccounts(),
    supabase
      .schema('guest')
      .from('mv_guest_profile')
      .select('email, phone, country, lifetime_revenue, stays_count')
      .eq('property_id', PROPERTY_ID)
      .limit(10000),
  ]);

  const profiles = (profilesR.data ?? []) as { email: string | null; phone: string | null; country: string | null; lifetime_revenue: number; stays_count: number }[];
  const reach = countReachable(profiles);
  const totalGuests = profiles.length;
  const repeatGuests = profiles.filter((p) => p.stays_count >= 2).length;
  const totalFollowers = socials.reduce((s: number, a: any) => s + (a.followers ?? 0), 0);
  const unanswered = summary.unanswered ?? 0;
  const responseRate = summary.response_rate ?? 0;
  const avgRating = Number(summary.avg_rating ?? 0);
  const totalReviews = summary.total ?? 0;

  return (
    <>
      <PageHeader pillar="Guest" tab="Snapshot"
        title={<>The voice <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>of the house</em> — and who's reachable.</>}
        lede={`${totalGuests} guests · ${repeatGuests} repeat · ${totalReviews} reviews ${period.label} · ${(responseRate * 100).toFixed(0)}% response`} />
      <GuestStatusHeader
        top={<>
          <AgentTopRow code="review_agent" fallbackName="Review Agent" />
          <span style={{ flex: 1 }} />
          <StatusCell label="SOURCE"><StatusPill tone="active">guest.mv_guest_profile</StatusPill><span style={metaDim}>· marketing.reviews</span></StatusCell>
        </>}
        bottom={<>
          <StatusCell label="WINDOW"><span style={metaSm}>{period.label}</span></StatusCell>
          <StatusCell label="REPLY QUEUE">
            <StatusPill tone={unanswered > 5 ? 'expired' : unanswered > 0 ? 'pending' : 'active'}>{unanswered}</StatusPill>
            <span style={metaDim}>{(responseRate * 100).toFixed(0)}% rate</span>
          </StatusCell>
          <StatusCell label="SOCIAL"><span style={metaSm}>{totalFollowers.toLocaleString()}</span><span style={metaDim}>· {socials.length} channels</span></StatusCell>
          <span style={{ flex: 1 }} />
        </>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginTop: 14 }}>
        <Reachable total={reach.total} withEmail={reach.withEmail} withPhone={reach.withPhone} withWhatsapp={reach.withWhatsapp} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 14 }}>
        <KpiBox value={totalGuests} unit="count" label="Guest profiles" />
        <KpiBox value={repeatGuests} unit="count" label="Repeat guests" />
        <KpiBox value={totalReviews} unit="count" label={`Reviews · ${period.label}`} />
        <KpiBox value={avgRating} unit="nights" dp={2} label="Avg rating /5" />
        <KpiBox value={(responseRate * 100)} unit="pct" label="Response rate" />
        <KpiBox value={totalFollowers} unit="count" label="Social followers" />
      </div>
    </>
  );
}
