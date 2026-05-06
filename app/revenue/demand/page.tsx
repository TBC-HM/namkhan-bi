// app/revenue/demand/page.tsx — REDESIGN 2026-05-05 (recovery)
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
import { getPaceOtb } from '@/lib/data';
import { resolvePeriod } from '@/lib/period';
import DemandGraphs from './_components/DemandGraphs';
import DemandTable, { type DemandRow } from './_components/DemandTableClient';

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

  return (
    <>
      <PageHeader pillar="Revenue" tab="Demand"
        title={<>Find the <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>gap</em> before the calendar gets soft.</>}
        lede={`${period.label} · ${period.rangeLabel} · ${rows.length} months in view · pace vs STLY`} />
      <div style={statusWrap}>
        <div style={statusRow1}>
          <div style={cell}><span className="t-eyebrow" style={{ marginRight: 8 }}>SOURCE</span><StatusPill tone="active">mv_pace_otb</StatusPill></div>
          <div style={cell}><span className="t-eyebrow" style={{ marginRight: 6 }}>WINDOW</span><span style={meta}>{period.label}</span></div>
          <div style={cell}><span className="t-eyebrow" style={{ marginRight: 6 }}>MONTHS</span><span style={metaStrong}>{rows.length}</span></div>
          <span style={{ flex: 1 }} />
        </div>
        <div style={statusRow2}>
          <span className="t-eyebrow" style={{ marginRight: 6 }}>AHEAD</span><StatusPill tone="active">{monthsAhead}</StatusPill>
          <span style={metaDim}>months &gt; STLY</span>
          <span style={{ width: 16 }} />
          <span className="t-eyebrow" style={{ marginRight: 6 }}>BEHIND</span><StatusPill tone={monthsBehind > 0 ? 'expired' : 'inactive'}>{monthsBehind}</StatusPill>
          <span style={metaDim}>months &lt; STLY</span>
          <span style={{ flex: 1 }} />
          {biggest.month && <span style={metaDim}>biggest: {biggest.month} {biggest.delta >= 0 ? '+' : ''}{biggest.delta} RN</span>}
        </div>
      </div>
      <DemandGraphs rows={rows} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 14 }}>
        <KpiBox value={total.otb} unit="count" label="OTB Roomnights" />
        <KpiBox value={total.rev} unit="usd" label="OTB Revenue" />
        <KpiBox value={paceΔ} unit="count" label="Pace Δ Rn" delta={total.stly > 0 ? { value: paceΔPct, unit: 'pct', period: 'vs STLY' } : undefined} />
        <KpiBox value={revΔ} unit="usd" label="Pace Δ Rev" delta={total.stlyRev > 0 ? { value: revΔPct, unit: 'pct', period: 'vs STLY' } : undefined} />
      </div>
      <div style={{ marginTop: 18 }}>
        <SectionHead title="Pace" emphasis="by check-in month" sub={`${rows.length} months · OTB vs STLY · sortable`} source="mv_pace_otb" />
        <DemandTable rows={rows} />
      </div>
    </>
  );
}

function SectionHead({ title, emphasis, sub, source }: { title: string; emphasis?: string; sub?: string; source?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.1 }}>
          {title}
          {emphasis && <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', fontStyle: 'normal', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', color: 'var(--brass)' }}>{emphasis}</span>}
        </div>
        {sub && <div style={{ marginTop: 2, fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>{sub}</div>}
      </div>
      {source && <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{source}</span>}
    </div>
  );
}

const statusWrap: React.CSSProperties = { background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, marginTop: 14, overflow: 'hidden' };
const statusRow1: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 18, padding: '10px 16px', borderBottom: '1px solid var(--paper-deep)', flexWrap: 'wrap' };
const statusRow2: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 'var(--t-xs)', flexWrap: 'wrap' };
const cell: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6 };
const meta: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink)' };
const metaStrong: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink)', fontWeight: 600 };
const metaDim: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', letterSpacing: 'var(--ls-loose)' };
