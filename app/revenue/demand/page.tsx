// app/revenue/demand/page.tsx — REDESIGN 2026-05-05 (recovery)
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import Brief from '@/components/page/Brief';
import ArtifactActions from '@/components/page/ArtifactActions';
import PeriodSelectorRow from '@/components/page/PeriodSelectorRow';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
import { getPaceOtb } from '@/lib/data';
import { resolvePeriod } from '@/lib/period';
import DemandGraphs from './_components/DemandGraphs';
import DemandTable, { type DemandRow } from './_components/DemandTableClient';
import { REVENUE_SUBPAGES } from '../_subpages';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function DemandPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);
  const pace = await getPaceOtb(period).catch(() => []);
  const rows: DemandRow[] = (pace as any[]).map((r) => ({
    ci_month: String(r.ci_month),
    otb_roomnights: Number(r.otb_roomnights || 0),
    stly_roomnights: Number(r.stly_roomnights || 0),
    roomnights_delta: Number(r.roomnights_delta || 0),
    otb_revenue: Number(r.otb_revenue || 0),
    stly_revenue: Number(r.stly_revenue || 0),
    revenue_delta: Number(r.revenue_delta || 0),
  }));
  const total = rows.reduce((a, r) => ({
    otb: a.otb + r.otb_roomnights, rev: a.rev + r.otb_revenue,
    stly: a.stly + r.stly_roomnights, stlyRev: a.stlyRev + r.stly_revenue,
  }), { otb: 0, rev: 0, stly: 0, stlyRev: 0 });
  const paceΔ = total.otb - total.stly;
  const paceΔPct = total.stly ? (paceΔ / total.stly) * 100 : 0;
  const revΔ = total.rev - total.stlyRev;
  const revΔPct = total.stlyRev ? (revΔ / total.stlyRev) * 100 : 0;
  let biggest = { month: '', delta: 0 };
  rows.forEach((r) => { if (Math.abs(r.roomnights_delta) > Math.abs(biggest.delta)) biggest = { month: r.ci_month.slice(0, 7), delta: r.roomnights_delta }; });
  const monthsAhead = rows.filter((r) => r.roomnights_delta > 0).length;
  const monthsBehind = rows.filter((r) => r.roomnights_delta < 0).length;

  // Brief — narrative read of demand for this window.
  const briefSignal = `${period.label} · ${rows.length} months · ${monthsAhead} ahead / ${monthsBehind} behind STLY · pace Δ ${paceΔ >= 0 ? '+' : ''}${paceΔ} RN`;
  const briefBody = `OTB ${total.otb.toLocaleString()} RN ($${(total.rev / 1000).toFixed(1)}k). STLY ${total.stly.toLocaleString()} RN ($${(total.stlyRev / 1000).toFixed(1)}k). Revenue Δ ${revΔ >= 0 ? '+' : ''}$${(revΔ / 1000).toFixed(1)}k (${revΔPct.toFixed(1)}%).`;
  const good: string[] = [];
  const bad:  string[] = [];
  if (paceΔPct >= 5)            good.push(`Pace ${paceΔPct.toFixed(1)}% ahead of STLY — protect rate.`);
  if (paceΔPct <= -5)           bad.push(`Pace ${paceΔPct.toFixed(1)}% behind STLY — open BAR floor or push direct.`);
  if (monthsBehind > monthsAhead) bad.push(`${monthsBehind} months behind STLY (vs ${monthsAhead} ahead).`);
  if (biggest.month && Math.abs(biggest.delta) > 50) {
    if (biggest.delta > 0) good.push(`${biggest.month} pace +${biggest.delta} RN — strongest month.`);
    else                    bad.push(`${biggest.month} pace ${biggest.delta} RN — softest month, intervene.`);
  }
  if (good.length === 0) good.push('No standout strengths flagged for this window.');
  if (bad.length === 0)  bad.push('No leakage signals flagged for this window.');

  const ctx = (kind: 'panel' | 'kpi' | 'brief' | 'table', title: string, signal?: string) => ({ kind, title, signal, dept: 'revenue' as const });

  return (
    <Page
      eyebrow={`Revenue · Demand · ${period.label}`}
      title={<>Find the <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>gap</em> before the calendar gets soft.</>}
      subPages={REVENUE_SUBPAGES}
    >
      <Brief
        brief={{ signal: briefSignal, body: briefBody, good, bad }}
        actions={<ArtifactActions context={ctx('brief', `Demand · ${period.label}`, briefSignal)} />}
      />

      <Panel title="Demand status" eyebrow="evidence" actions={<ArtifactActions context={ctx('panel', 'Demand status')} />}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 8 }}>
          <span><span className="t-eyebrow" style={{ marginRight: 8 }}>SOURCE</span><StatusPill tone="active">mv_pace_otb</StatusPill></span>
          <span><span className="t-eyebrow" style={{ marginRight: 6 }}>WINDOW</span><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)' }}>{period.label}</span></span>
          <span><span className="t-eyebrow" style={{ marginRight: 6 }}>MONTHS</span><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', fontWeight: 600 }}>{rows.length}</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 'var(--t-xs)' }}>
          <span className="t-eyebrow" style={{ marginRight: 6 }}>AHEAD</span><StatusPill tone="active">{monthsAhead}</StatusPill>
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>months &gt; STLY</span>
          <span style={{ width: 16 }} />
          <span className="t-eyebrow" style={{ marginRight: 6 }}>BEHIND</span><StatusPill tone={monthsBehind > 0 ? 'expired' : 'inactive'}>{monthsBehind}</StatusPill>
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>months &lt; STLY</span>
          {biggest.month && <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>biggest: {biggest.month} {biggest.delta >= 0 ? '+' : ''}{biggest.delta} RN</span>}
        </div>
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title="Demand graphs" eyebrow="hero" actions={<ArtifactActions context={ctx('panel', 'Demand graphs', briefSignal)} />}>
        <DemandGraphs rows={rows} />
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 14 }}>
        <KpiBox value={total.otb} unit="count" label="OTB Roomnights" tooltip="On-the-books room nights for the forward window. Source: pace_otb." />
        <KpiBox value={total.rev} unit="usd"   label="OTB Revenue"    tooltip="OTB revenue (USD) for the forward window." />
        <KpiBox value={paceΔ} unit="count"     label="Pace Δ Rn"      delta={total.stly > 0 ? { value: paceΔPct, unit: 'pct', period: 'vs STLY' } : undefined} tooltip="OTB room-nights vs same time last year. Positive = ahead of pace." />
        <KpiBox value={revΔ}  unit="usd"       label="Pace Δ Rev"     delta={total.stlyRev > 0 ? { value: revΔPct, unit: 'pct', period: 'vs STLY' } : undefined} tooltip="OTB revenue vs same time last year. Positive = ahead of pace." />
      </div>

      {/* Canonical period chooser — under the KPI tile row. */}
      <PeriodSelectorRow
        basePath="/revenue/demand"
        win={period.win}
        cmp={period.cmp}
        includeForward
        preserve={{ seg: period.seg }}
      />


      <div style={{ height: 14 }} />

      <Panel title={`Pace by check-in month · ${rows.length} months`} eyebrow="mv_pace_otb · OTB vs STLY · sortable" actions={<ArtifactActions context={ctx('table', 'Pace by check-in month')} />}>
        <DemandTable rows={rows} />
      </Panel>
    </Page>
  );
}
