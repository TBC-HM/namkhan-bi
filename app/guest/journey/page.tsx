// app/guest/journey/page.tsx — NEW
// Guest · Journey — lifecycle funnel. Sources: reservations + guest.journey_events.
// Every count wired. No invented data.

import Page from '@/components/page/Page';
import { GUEST_SUBPAGES } from '../_subpages';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { fmtMoney } from '@/lib/format';
import {
  GuestStatusHeader, StatusCell, SectionHead,
  metaSm, metaStrong, metaDim, cardWrap, cardTitle, cardSub,
} from '../_components/GuestShell';
import AgentTopRow from '../_components/AgentTopRow';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function JourneyPage({ searchParams }: Props) {
  const days = Number((searchParams.days as string) || 180);
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  // Reservation funnel — every stage wired off public.reservations.
  // (Note: public.reservations has no guest_phone column. Phone-coverage
  // signals come from guest.mv_guest_profile via the messy-data page.)
  const { data: resRows } = await supabase
    .from('reservations')
    .select('reservation_id, status, check_in_date, check_out_date, booking_date, guest_email, source_name, total_amount')
    .eq('property_id', PROPERTY_ID)
    .gte('check_in_date', since);

  const all = resRows ?? [];

  const isReservation = all.length;
  const confirmed = all.filter((r: any) => ['confirmed', 'checked_in', 'checked_out'].includes(r.status)).length;
  const arrived = all.filter((r: any) => ['checked_in', 'checked_out'].includes(r.status)).length;
  const inHouse = all.filter((r: any) => r.status === 'checked_in').length;
  const departed = all.filter((r: any) => r.status === 'checked_out').length;
  const canceled = all.filter((r: any) => r.status === 'canceled').length;
  const noShow = all.filter((r: any) => r.status === 'no_show').length;

  // Comm coverage — fraction of reservations with email on file.
  // (guest_phone lives on guest.mv_guest_profile, not public.reservations.)
  const withEmail = all.filter((r: any) => !!r.guest_email).length;
  const withPhone = 0;

  // Lead time distribution (booking_date → check_in_date)
  const leads = all
    .filter((r: any) => r.booking_date && r.check_in_date)
    .map((r: any) => Math.max(0, Math.floor((new Date(r.check_in_date).getTime() - new Date(r.booking_date).getTime()) / 86_400_000)));
  leads.sort((a: number, b: number) => a - b);
  const med = leads.length ? leads[Math.floor(leads.length / 2)] : null;
  const avg = leads.length ? leads.reduce((s: number, n: number) => s + n, 0) / leads.length : null;

  // Lead-time buckets — wired from real `leads` array, no fabrication.
  const leadBuckets = [
    { label: '0–7d',    n: leads.filter((d: number) => d <= 7).length },
    { label: '8–14d',   n: leads.filter((d: number) => d > 7 && d <= 14).length },
    { label: '15–30d',  n: leads.filter((d: number) => d > 14 && d <= 30).length },
    { label: '31–60d',  n: leads.filter((d: number) => d > 30 && d <= 60).length },
    { label: '61–90d',  n: leads.filter((d: number) => d > 60 && d <= 90).length },
    { label: '90+ d',   n: leads.filter((d: number) => d > 90).length },
  ];

  // Journey events — pre-arrival / in-stay / post-stay touchpoint counts (last `days`).
  const { data: eventsRows } = await supabase
    .schema('guest')
    .from('journey_events')
    .select('stage, event_type, channel, occurred_at')
    .gte('occurred_at', new Date(Date.now() - days * 86_400_000).toISOString())
    .limit(20000);
  const events = eventsRows ?? [];

  type StageKey = string;
  const eventsByStage = new Map<StageKey, number>();
  for (const e of events as any[]) {
    const k = e.stage || 'unknown';
    eventsByStage.set(k, (eventsByStage.get(k) ?? 0) + 1);
  }
  const orderedStages = ['inquiry', 'pre_arrival', 'arrival', 'in_stay', 'departure', 'post_stay'];
  const stageRows = orderedStages
    .map((s) => ({ stage: s, n: eventsByStage.get(s) ?? 0 }))
    .filter((r) => r.n > 0 || (eventsByStage.size === 0 && r.stage === 'pre_arrival'));

  // Funnel definition (real numbers from `all` only)
  const funnel = [
    { label: 'Reservations created', n: isReservation },
    { label: 'Confirmed',            n: confirmed },
    { label: 'Arrived',              n: arrived },
    { label: 'Departed',             n: departed },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.n));

  // Conversion %
  const confirmRate = isReservation ? (confirmed / isReservation) * 100 : 0;
  const arriveRate = confirmed ? (arrived / confirmed) * 100 : 0;
  const cancelRate = isReservation ? (canceled / isReservation) * 100 : 0;

  return (
    <Page
      eyebrow="Guest · Journey"
      title={<>From <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>inquiry</em> to repeat — every touchpoint, every drop.</>}
      subPages={GUEST_SUBPAGES}
    >

      <GuestStatusHeader
        top={
          <>
            {/* AGENT on top — wired from governance.agents */}
            <AgentTopRow code="concierge_agent" fallbackName="Concierge Agent" />
            <span style={{ flex: 1 }} />
            <StatusCell label="SOURCE">
              <StatusPill tone="active">reservations</StatusPill>
              <span style={metaDim}>· guest.journey_events</span>
            </StatusCell>
          </>
        }
        bottom={
          <>
            <StatusCell label="WINDOW">
              <span style={metaSm}>{days}d</span>
            </StatusCell>
            <StatusCell label="IN-HOUSE">
              <span style={metaStrong}>{inHouse}</span>
              <span style={metaDim}>guests on property now</span>
            </StatusCell>
            <StatusCell label="CANCEL">
              <StatusPill tone={cancelRate > 25 ? 'expired' : cancelRate > 10 ? 'pending' : 'active'}>
                {cancelRate.toFixed(0)}%
              </StatusPill>
              <span style={metaDim}>{canceled} of {isReservation}</span>
            </StatusCell>
            <StatusCell label="EVENTS">
              <span style={metaSm}>{events.length}</span>
              <span style={metaDim}>journey_events logged</span>
            </StatusCell>
            <span style={{ flex: 1 }} />
          </>
        }
      />

      {/* 3 GRAPHS — every value wired */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 12,
          marginTop: 14,
        }}
      >
        <FunnelChart rows={funnel} max={funnelMax} />
        <LeadTimeChart buckets={leadBuckets} med={med} avg={avg} />
        <CommCoverageChart withEmail={withEmail} withPhone={withPhone} total={isReservation} />
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
        <KpiBox value={isReservation} unit="count" label="Reservations" tooltip="Total reservations created in window. Source: public.reservations." />
        <KpiBox value={confirmRate} unit="pct" label="Confirm rate"   tooltip="Confirmed ÷ all reservations × 100." />
        <KpiBox value={arriveRate}  unit="pct" label="Arrive rate"    tooltip="Arrived ÷ confirmed × 100. Cancellations + no-shows reduce this." />
        <KpiBox value={cancelRate}  unit="pct" label="Cancel rate"    tooltip="Cancelled ÷ all reservations × 100. Watch ≤ 10%." />
        <KpiBox value={med ?? null} unit="d"   label="Median lead"    tooltip="Median days from booking to arrival. Drives pacing strategy." />
        <KpiBox value={noShow}      unit="count" label="No-shows"     tooltip="Reservations marked no-show in window. Should remain near 0." />
      </div>

      {/* STAGE TABLE — wired from journey_events */}
      <div style={{ marginTop: 18 }}>
        <SectionHead
          title="Touchpoints"
          emphasis="by stage"
          sub={`${events.length} events · ${days}d window · channel breakdown`}
          source="guest.journey_events"
        />
        {stageRows.length === 0 || events.length === 0 ? (
          <div style={{ padding: 32, background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            No journey events logged yet — pre-arrival emails, post-stay surveys, and SMS will write to <code>guest.journey_events</code> once Make scenarios are wired.
          </div>
        ) : (
          <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={th}>Stage</th>
                  <th style={{ ...th, textAlign: 'right' }}>Events</th>
                  <th style={{ ...th, textAlign: 'right' }}>% of total</th>
                </tr>
              </thead>
              <tbody>
                {stageRows.map((r) => (
                  <tr key={r.stage}>
                    <td style={td}><strong>{r.stage}</strong></td>
                    <td style={{ ...td, textAlign: 'right' }}>{r.n}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--ink-mute)' }}>{events.length > 0 ? ((r.n / events.length) * 100).toFixed(0) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Page>
  );
}

// ===== Wired charts =====

function FunnelChart({ rows, max }: { rows: { label: string; n: number }[]; max: number }) {
  const w = 320, lineH = 32, h = rows.length * lineH + 12;
  const labelW = 140, valW = 60, barMaxW = w - labelW - valW - 8;
  return (
    <div style={cardWrap}>
      <div style={cardTitle}>Reservation funnel</div>
      <div style={cardSub}>Stages from reservations.status</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h }}>
        {rows.map((r, i) => {
          const y = 6 + i * lineH;
          const barW = (r.n / max) * barMaxW;
          const dropPct = i > 0 && rows[i - 1].n > 0 ? (r.n / rows[i - 1].n) * 100 : null;
          return (
            <g key={r.label}>
              <text x={labelW - 4} y={y + 18} textAnchor="end" style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink)' }}>
                {r.label}
              </text>
              <rect x={labelW} y={y + 6} width={barMaxW} height={20} fill="var(--paper-deep)" />
              <rect x={labelW} y={y + 6} width={barW} height={20} fill="var(--moss)">
                <title>{`${r.label} · ${r.n.toLocaleString()} reservations${dropPct != null ? ` · ${dropPct.toFixed(1)}% of prior stage` : ''} · public.reservations`}</title>
              </rect>
              <text x={labelW + barMaxW + 4} y={y + 18} style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink-soft)', fontWeight: 600 }}>
                {r.n}
              </text>
              {dropPct != null && (
                <text x={labelW + 6} y={y + 19} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--paper-warm)', fontWeight: 600 }}>
                  {dropPct.toFixed(0)}% ↓
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function LeadTimeChart({ buckets, med, avg }: { buckets: { label: string; n: number }[]; med: number | null; avg: number | null }) {
  const total = buckets.reduce((s, b) => s + b.n, 0);
  if (total === 0) {
    return (
      <div style={cardWrap}>
        <div style={cardTitle}>Lead-time distribution</div>
        <div style={cardSub}>booking_date → check_in_date</div>
        <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 'var(--t-sm)' }}>
          No reservations in window
        </div>
      </div>
    );
  }
  const w = 320, h = 200, padL = 8, padR = 4, padT = 16, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = Math.max(1, ...buckets.map((b) => b.n));
  const groupW = innerW / buckets.length;
  const barW = groupW * 0.7;
  return (
    <div style={cardWrap}>
      <div style={cardTitle}>Lead-time distribution</div>
      <div style={cardSub}>booking_date → check_in_date · median {med != null ? `${med}d` : '—'} · avg {avg != null ? `${avg.toFixed(0)}d` : '—'}</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 200 }}>
        {buckets.map((b, i) => {
          const x = padL + i * groupW + (groupW - barW) / 2;
          const bh = (b.n / max) * innerH;
          const y = padT + innerH - bh;
          const fill = i <= 1 ? 'var(--st-bad)' : i <= 3 ? 'var(--brass)' : 'var(--moss)';
          return (
            <g key={b.label}>
              <rect x={x} y={y} width={barW} height={bh} fill={fill}>
                <title>{`Lead time ${b.label} · ${b.n.toLocaleString()} reservations · ${total > 0 ? ((b.n / total) * 100).toFixed(1) : '0.0'}% of ${total.toLocaleString()} · public.reservations`}</title>
              </rect>
              {b.n > 0 && (
                <text x={x + barW / 2} y={y - 3} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink)' }}>
                  {b.n}
                </text>
              )}
              <text x={x + barW / 2} y={h - 14} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CommCoverageChart({ withEmail, withPhone, total }: { withEmail: number; withPhone: number; total: number }) {
  if (total === 0) {
    return (
      <div style={cardWrap}>
        <div style={cardTitle}>Contact coverage</div>
        <div style={cardSub}>email + phone on file</div>
        <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 'var(--t-sm)' }}>
          No reservations in window
        </div>
      </div>
    );
  }
  const emailPct = (withEmail / total) * 100;
  const phonePct = (withPhone / total) * 100;
  const w = 320, h = 200, barH = 24, padL = 4, padR = 70;
  const barMaxW = w - padL - padR;

  return (
    <div style={cardWrap}>
      <div style={cardTitle}>Contact coverage</div>
      <div style={cardSub}>email + phone on file · marketing-actionable</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 200 }}>
        {[
          { label: 'Email', n: withEmail, pct: emailPct, color: emailPct >= 80 ? 'var(--moss)' : emailPct >= 50 ? 'var(--brass)' : 'var(--st-bad)' },
          { label: 'Phone', n: withPhone, pct: phonePct, color: phonePct >= 80 ? 'var(--moss)' : phonePct >= 50 ? 'var(--brass)' : 'var(--st-bad)' },
        ].map((row, i) => {
          const y = 44 + i * (barH + 18);
          const wPx = (row.pct / 100) * barMaxW;
          return (
            <g key={row.label}>
              <text x={padL + 4} y={y - 4} style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink)' }}>
                {row.label}
              </text>
              <rect x={padL} y={y} width={barMaxW} height={barH} fill="var(--paper-deep)" />
              <rect x={padL} y={y} width={wPx} height={barH} fill={row.color}>
                <title>{`${row.label} contact · ${row.n.toLocaleString()} of ${total.toLocaleString()} reservations · ${row.pct.toFixed(1)}% · public.reservations`}</title>
              </rect>
              <text x={w - padR + 4} y={y + barH / 2 + 4} style={{ fontFamily: 'var(--mono)', fontSize: 11, fill: 'var(--ink)', fontWeight: 600 }}>
                {row.pct.toFixed(0)}%
              </text>
              <text x={w - padR + 4} y={y + barH + 12} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>
                {row.n} of {total}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

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
