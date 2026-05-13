// app/revenue/demand/page.tsx — REDESIGN 2026-05-05 (recovery)
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import ArtifactActions from '@/components/page/ArtifactActions';
import PeriodSelectorRow from '@/components/page/PeriodSelectorRow';
import KpiBox from '@/components/kpi/KpiBox';
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

  const ctx = (kind: 'panel' | 'kpi' | 'brief' | 'table', title: string, signal?: string) => ({ kind, title, signal, dept: 'revenue' as const });

  return (
    <Page
      eyebrow={`Revenue · Demand · ${period.label}`}
      title={<>Find the <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>gap</em> before the calendar gets soft.</>}
      subPages={REVENUE_SUBPAGES}
    >
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

      <Panel title="Demand graphs" eyebrow="hero" actions={<ArtifactActions context={ctx('panel', 'Demand graphs')} />}>
        <DemandGraphs rows={rows} />
      </Panel>

      <div style={{ height: 14 }} />

      <Panel title={`Pace by check-in month · ${rows.length} months`} eyebrow="mv_pace_otb · OTB vs STLY · sortable" actions={<ArtifactActions context={ctx('table', 'Pace by check-in month')} />}>
        <DemandTable rows={rows} />
      </Panel>
    </Page>
  );
}
