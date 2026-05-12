// app/revenue/rates/page.tsx — REDESIGN 2026-05-05 (recovery)
import Page from '@/components/page/Page';
import PeriodSelectorRow from '@/components/page/PeriodSelectorRow';
import { REVENUE_SUBPAGES } from '../_subpages';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
import { getRateInventoryCalendar } from '@/lib/data';
import { resolvePeriod } from '@/lib/period';
import RatesGraphs from './_components/RatesGraphs';
import RatesTable, { type RoomTypeRow } from './_components/RatesTableClient';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function RatesPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);
  const cal = await getRateInventoryCalendar(period).catch(() => []);
  const byTypeMap: Record<string, RoomTypeRow> = {};
  cal.forEach((r: any) => {
    const k = String(r.room_type_id);
    if (!byTypeMap[k]) byTypeMap[k] = { name: r.room_type_name || 'Unknown', rates: [], min: Infinity, max: -Infinity };
    if (r.bar_rate) {
      const v = Number(r.bar_rate);
      byTypeMap[k].rates.push(v);
      byTypeMap[k].min = Math.min(byTypeMap[k].min, v);
      byTypeMap[k].max = Math.max(byTypeMap[k].max, v);
    }
  });
  const byType = Object.values(byTypeMap);
  const allRates = cal.filter((r: any) => r.bar_rate).map((r: any) => Number(r.bar_rate));
  const overallMin = allRates.length ? Math.min(...allRates) : 0;
  const overallMax = allRates.length ? Math.max(...allRates) : 0;
  const overallAvg = allRates.length ? allRates.reduce((a: number, b: number) => a + b, 0) / allRates.length : 0;
  let cta = 0, ctd = 0, stop = 0, minStay = 0, open = 0;
  cal.forEach((r: any) => {
    let restricted = false;
    if (r.closed_to_arrival) { cta++; restricted = true; }
    if (r.closed_to_departure) { ctd++; restricted = true; }
    if (r.stop_sell) { stop++; restricted = true; }
    if (r.minimum_stay && Number(r.minimum_stay) > 1) { minStay++; restricted = true; }
    if (!restricted) open++;
  });
  const restrictionTotal = cta + ctd + stop + minStay;

  return (
    <Page eyebrow="Revenue · Rates" title={<>BAR ladder, <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>spread</em>, and the levers around it.</>} subPages={REVENUE_SUBPAGES}>
      <div style={statusWrap}>
        <div style={statusRow1}>
          <div style={cell}><span className="t-eyebrow" style={{ marginRight: 8 }}>SOURCE</span><StatusPill tone="active">mv_rate_inventory_calendar</StatusPill></div>
          <div style={cell}><span className="t-eyebrow" style={{ marginRight: 6 }}>WINDOW</span><span style={meta}>{period.label}</span><span style={metaDim}>· {period.rangeLabel}</span></div>
          <div style={cell}><span className="t-eyebrow" style={{ marginRight: 6 }}>ROOM TYPES</span><span style={metaStrong}>{byType.length}</span></div>
          <span style={{ flex: 1 }} />
        </div>
        <div style={statusRow2}>
          <span className="t-eyebrow" style={{ marginRight: 6 }}>RESTRICTIONS</span>
          <StatusPill tone={restrictionTotal > 30 ? 'pending' : 'inactive'}>{restrictionTotal}</StatusPill>
          <span style={metaDim}>CTA · CTD · stop-sell · min-stay</span>
          <span style={{ flex: 1 }} />
          <span style={metaDim}>BAR range ${Math.round(overallMin).toLocaleString()} — ${Math.round(overallMax).toLocaleString()}</span>
        </div>
      </div>
      <RatesGraphs byType={byType} allRates={allRates} restrictions={{ cta, ctd, stop, minStay, open }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 14 }}>
        <KpiBox value={overallMin} unit="usd"   label="Min BAR"             tooltip="Lowest Best-Available-Rate observed in the window. Floor of the rate ladder." />
        <KpiBox value={overallAvg} unit="usd"   label="Avg BAR"             tooltip="Mean BAR across room types and days." />
        <KpiBox value={overallMax} unit="usd"   label="Max BAR"             tooltip="Ceiling BAR observed in the window — typically peak / high-demand days." />
        <KpiBox value={restrictionTotal} unit="count" label="Active restrictions" tooltip="Stop-sell + closed-to-arrival + closed-to-departure + min-stay rules in effect." />
      </div>

      {/* Canonical period chooser — under the KPI tile row. */}
      <PeriodSelectorRow
        basePath="/revenue/rates"
        win={period.win}
        cmp={period.cmp}
        includeForward
        preserve={{ seg: period.seg }}
      />

      <div style={{ marginTop: 18 }}>
        <SectionHead title="BAR" emphasis="per room type" sub={`Min · avg · max · ${period.label}`} source="mv_rate_inventory_calendar" />
        <RatesTable rows={byType} />
      </div>
    </Page>
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
