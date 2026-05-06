// app/finance/page.tsx — REDESIGN 2026-05-05 (recovery)
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
import ActionCard, { ActionStack } from '@/components/sections/ActionCard';
import { getAgedAr } from '@/lib/data';
import { resolvePeriod } from '@/lib/period';
import { fmtMoney } from '@/lib/format';
import { getPlSectionsAll, getUsaliHouse, getUsaliDept, currentPeriod, pickPeriod } from './_data';
import { priorPeriod } from '@/lib/supabase-gl';
import {
  FinanceStatusHeader, StatusCell, SectionHead,
  metaSm, metaStrong, metaDim,
} from './_components/FinanceShell';
import FinanceTrendChart from './_components/FinanceTrendChart';
import AgedArChart from './_components/AgedArChart';
import DeptMixChart from './_components/DeptMixChart';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function FinanceSnapshotPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);
  const [plAll, aged] = await Promise.all([getPlSectionsAll(), getAgedAr().catch(() => [])]);

  const incomeByPeriod = new Map<string, number>();
  const netByPeriod = new Map<string, number>();
  for (const r of plAll) {
    if (r.section === 'income') incomeByPeriod.set(r.period_yyyymm, Number(r.amount_usd || 0));
    if (r.section === 'net_earnings') netByPeriod.set(r.period_yyyymm, Number(r.amount_usd || 0));
  }
  const calCur = currentPeriod();
  const periodsWithRev = Array.from(incomeByPeriod.entries())
    .filter(([k, v]) => v >= 1000 && k !== calCur)
    .map(([k]) => k).sort().reverse();
  const cur = periodsWithRev[0] || calCur;
  const prior = periodsWithRev[1] || priorPeriod(cur);

  const [houseRows, deptCur, deptPrior] = await Promise.all([
    getUsaliHouse([cur, prior]),
    getUsaliDept([cur]),
    getUsaliDept([prior]),
  ]);

  // MoM dept profit waterfall
  const profMap = (rows: any[], p: string) => new Map(
    rows.filter((r: any) => r.period_yyyymm === p)
        .map((r: any) => [r.usali_department, Number(r.departmental_profit ?? 0)]),
  );
  const curProf = profMap(deptCur as any[], cur);
  const priorProf = profMap(deptPrior as any[], prior);
  const variances = Array.from(new Set([...curProf.keys(), ...priorProf.keys()]))
    .map(d => ({ dept: d, delta: (curProf.get(d) ?? 0) - (priorProf.get(d) ?? 0) }))
    .filter(v => Math.abs(v.delta) > 1)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 6);
  const maxAbsVar = Math.max(...variances.map(v => Math.abs(v.delta)), 1);
  const totalRev = incomeByPeriod.get(cur) ?? 0;
  const priorTotal = incomeByPeriod.get(prior) ?? 0;
  const monthDeltaPct = priorTotal ? ((totalRev - priorTotal) / priorTotal) * 100 : null;
  const netEarnings = netByPeriod.get(cur);
  const houseCur = pickPeriod(houseRows, cur);
  const gop = houseCur?.gop ?? null;
  const totalAr = aged.reduce((s: number, r: any) => s + Number(r.open_balance || 0), 0);
  const ar90Plus = aged.filter((r: any) => r.bucket === '90_plus').reduce((s: number, r: any) => s + Number(r.open_balance || 0), 0);
  const ar6190 = aged.filter((r: any) => r.bucket === '61_90').reduce((s: number, r: any) => s + Number(r.open_balance || 0), 0);

  const periods = Array.from(new Set([...incomeByPeriod.keys(), ...netByPeriod.keys()])).sort();
  const trendRows = periods.map((p) => ({
    period: p,
    income: incomeByPeriod.get(p) ?? 0,
    net: netByPeriod.has(p) ? Number(netByPeriod.get(p)) : null,
    gop: null as number | null,
  }));

  const closedMonths = periodsWithRev.length;
  const arHealth = ar90Plus > 0 ? 'expired' : ar6190 > 0 ? 'pending' : 'active';

  const cards: any[] = [];
  if (ar90Plus > 0) {
    cards.push({
      pillar: 'fin' as const, pillarLabel: 'Finance · AR', agentLabel: '· Collections',
      priority: 'high' as const, priorityLabel: 'High · cash',
      headline: <>{fmtMoney(ar90Plus, 'USD')} stuck <em>past 90 days</em>.</>,
      conclusion: <>Reservations with open balance over 90 days have ~50% recovery rate. Review each line.</>,
      verdict: [{ label: `90+ · ${fmtMoney(ar90Plus, 'USD')}`, tone: 'bad' as const }, { label: `Total · ${fmtMoney(totalAr, 'USD')}` }],
      primaryAction: 'Review aging', secondaryAction: 'Send letters', tertiaryAction: 'Defer',
      impact: 'Cash', impactSub: 'AR cleanup',
    });
  }
  // Budget · Variance Agent — surface only when no budget data exists
  cards.push({
    pillar: 'fin' as const, pillarLabel: 'Finance · Budget', agentLabel: '· Variance Agent',
    priority: 'med' as const, priorityLabel: 'Medium · setup',
    headline: <>Budget data not yet provided.<br /><em>Variance tracking blocked.</em></>,
    conclusion: <>Without an annual budget by USALI line, GOP / variance / pace-to-target cannot render. Owner action: provide CSV with monthly figures by USALI dept.</>,
    verdict: [{ label: 'Effort · 1-2h' }, { label: 'Unblocks · 4 KPIs' }, { label: 'One-time' }],
    primaryAction: 'Get template', secondaryAction: 'Schedule', tertiaryAction: 'Defer',
    impact: '4 KPIs', impactSub: 'unlocked',
  });
  if (ar6190 > 1000) {
    cards.push({
      pillar: 'fin' as const, pillarLabel: 'Finance · AR', agentLabel: '· Collections',
      priority: 'med' as const, priorityLabel: 'Medium · escalating',
      headline: <>{fmtMoney(ar6190, 'USD')} in <em>61-90 day bucket</em>.</>,
      conclusion: <>At risk of escalating to 90+. Send second reminder.</>,
      verdict: [{ label: `61-90 · ${fmtMoney(ar6190, 'USD')}`, tone: 'warn' as const }],
      primaryAction: 'Send reminders', secondaryAction: 'Review', tertiaryAction: 'Defer',
      impact: 'Prevention', impactSub: 'before 90+',
    });
  }

  return (
    <>
      <PageHeader pillar="Finance" tab="Snapshot"
        title={<>Where the money <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>is</em> — and where it's stuck.</>}
        lede={`Latest closed: ${cur} · ${closedMonths} closed period${closedMonths === 1 ? '' : 's'}`} />
      <FinanceStatusHeader
        top={<>
          <StatusCell label="SOURCE">
            <StatusPill tone="active">gl.pl_section_monthly</StatusPill>
            <span style={metaDim}>· v_usali_house_summary · mv_aged_ar</span>
          </StatusCell>
          <StatusCell label="LATEST"><span style={metaSm}>{cur}</span><span style={metaDim}>· prior {prior}</span></StatusCell>
          <StatusCell label="MONTHS"><span style={metaStrong}>{closedMonths}</span><span style={metaDim}>closed</span></StatusCell>
          <span style={{ flex: 1 }} />
          {monthDeltaPct != null && <span style={metaDim}>MoM {monthDeltaPct >= 0 ? '+' : ''}{monthDeltaPct.toFixed(1)}%</span>}
        </>}
        bottom={<>
          <StatusCell label="AR HEALTH">
            <StatusPill tone={arHealth as any}>{ar90Plus > 0 ? 'OVERDUE' : ar6190 > 0 ? 'WATCH' : 'CLEAN'}</StatusPill>
            <span style={metaDim}>{fmtMoney(totalAr, 'USD')} open</span>
          </StatusCell>
          <span style={{ flex: 1 }} />
          <span style={metaDim}>GOP {gop != null ? fmtMoney(gop, 'USD') : '—'} · NET {netEarnings != null ? fmtMoney(netEarnings, 'USD') : '—'}</span>
        </>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginTop: 14 }}>
        <FinanceTrendChart rows={trendRows} title="Income & net earnings" sub="Every closed period · gl.pl_section_monthly" />
        <DeptMixChart rows={deptCur as any} title={`Department mix · ${cur}`} sub="USALI dept revenue + profit" />
        <AgedArChart rows={aged as any} title="AR aging" sub="Open balance by bucket · mv_aged_ar" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 14 }}>
        <KpiBox value={totalRev} unit="usd" label={`Revenue · ${cur}`} delta={priorTotal && monthDeltaPct != null ? { value: monthDeltaPct, unit: 'pct', period: 'MoM' } : undefined} />
        <KpiBox value={gop} unit="usd" label={`GOP · ${cur}`} state={gop == null ? 'data-needed' : 'live'} needs={gop == null ? 'awaiting gl_entries close' : undefined} />
        <KpiBox value={netEarnings ?? null} unit="usd" label={`Net · ${cur}`} state={netEarnings == null ? 'data-needed' : 'live'} />
        <KpiBox value={ar90Plus} unit="usd" label="AR 90+" />
      </div>
      {variances.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <SectionHead title="Top variances" emphasis="MoM dept profit" sub={`${cur} vs ${prior} · departmental_profit per v_usali_dept_summary`} source="gl.v_usali_dept_summary" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, background: 'var(--paper-pure)', border: '1px solid var(--line-soft)', borderRadius: 4 }}>
            {variances.map(v => {
              const pct = (Math.abs(v.delta) / maxAbsVar) * 100;
              const pos = v.delta >= 0;
              return (
                <div key={v.dept} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 100px', gap: 12, alignItems: 'center', fontSize: 13 }}>
                  <div style={{ color: 'var(--ink)' }}>{v.dept}</div>
                  <div style={{ height: 8, background: 'var(--surf-2)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct.toFixed(0)}%`, height: '100%', background: pos ? 'var(--st-good)' : 'var(--st-bad)' }} />
                  </div>
                  <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: pos ? 'var(--st-good)' : 'var(--st-bad)' }}>
                    {pos ? '+' : '−'}${(Math.abs(v.delta) / 1000).toFixed(1)}k
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {cards.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <SectionHead title="Reconciliations" emphasis="awaiting attention" sub={`${cards.length} card${cards.length === 1 ? '' : 's'}`} />
          <ActionStack title={<></>} count={cards.length} meta={`${cards.length} awaiting`}>
            {cards.map((c, i) => <ActionCard key={i} num={i + 1} {...c} />)}
          </ActionStack>
        </div>
      )}
    </>
  );
}
