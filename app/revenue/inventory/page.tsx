// app/revenue/inventory/page.tsx — REDESIGN 2026-05-05 (recovery)
import Page from '@/components/page/Page';
import PeriodSelectorRow from '@/components/page/PeriodSelectorRow';
import { REVENUE_SUBPAGES } from '../_subpages';
import KpiBox from '@/components/kpi/KpiBox';
import StatusPill from '@/components/ui/StatusPill';
import { getRateInventoryCalendar } from '@/lib/data';
import { resolvePeriod } from '@/lib/period';
import { fmtIsoDate } from '@/lib/format';
import InventoryGraphs from './_components/InventoryGraphs';
import InventoryTable, { type DayRow } from './_components/InventoryTableClient';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props { searchParams: Record<string, string | string[] | undefined>; }

export default async function InventoryPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);
  const cal = await getRateInventoryCalendar(period).catch(() => []);
  const byDate: Record<string, DayRow> = {};
  cal.forEach((r: any) => {
    const d = String(r.inventory_date);
    if (!byDate[d]) byDate[d] = { date: d, total_avail: 0, min_rate: Infinity, max_rate: -Infinity };
    if (r.available_rooms != null) byDate[d].total_avail += Number(r.available_rooms);
    if (r.bar_rate != null && Number(r.bar_rate) > 0) {
      byDate[d].min_rate = Math.min(byDate[d].min_rate, Number(r.bar_rate));
      byDate[d].max_rate = Math.max(byDate[d].max_rate, Number(r.bar_rate));
    }
  });
  const days = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  const tightDays = days.filter((d) => d.total_avail > 0 && d.total_avail <= 3).length;
  const sellouts = days.filter((d) => d.total_avail === 0).length;
  const avgAvail = days.length ? days.reduce((s, d) => s + d.total_avail, 0) / days.length : 0;
  const lastShop = days.length ? days[days.length - 1].date : null;

  return (
    <Page eyebrow="Revenue · Inventory" title={<>Sell what you <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>have</em>, push rate where it's tight.</>} subPages={REVENUE_SUBPAGES}>
      <div style={statusWrap}>
        <div style={statusRow1}>
          <div style={cell}><span className="t-eyebrow" style={{ marginRight: 8 }}>SOURCE</span><StatusPill tone="active">mv_rate_inventory_calendar</StatusPill></div>
          <div style={cell}><span className="t-eyebrow" style={{ marginRight: 6 }}>WINDOW</span><span style={meta}>{period.label}</span><span style={metaDim}>· {period.rangeLabel}</span></div>
          <div style={cell}><span className="t-eyebrow" style={{ marginRight: 6 }}>LAST DATE</span><span style={meta}>{fmtIsoDate(lastShop)}</span></div>
          <span style={{ flex: 1 }} />
        </div>
        <div style={statusRow2}>
          <span className="t-eyebrow" style={{ marginRight: 6 }}>SELLOUTS</span>
          <StatusPill tone={sellouts > 0 ? 'expired' : 'active'}>{sellouts}</StatusPill>
          <span style={metaDim}>· 0 rooms</span>
          <span style={{ width: 16 }} />
          <span className="t-eyebrow" style={{ marginRight: 6 }}>TIGHT</span>
          <StatusPill tone={tightDays > 5 ? 'pending' : 'inactive'}>{tightDays}</StatusPill>
          <span style={metaDim}>· 1–3 rooms · push rate</span>
          <span style={{ flex: 1 }} />
          <span style={metaDim}>{days.length} days · avg {avgAvail.toFixed(1)} avail</span>
        </div>
      </div>
      <InventoryGraphs rows={days} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 14 }}>
        <KpiBox value={days.length} unit="count" label="Days in window" tooltip="Distinct inventory_date values in the window. Source: rate_inventory." />
        <KpiBox value={avgAvail}    unit="nights" label="Avg available" tooltip="Mean available_rooms across all room types per day in the window." />
        <KpiBox value={tightDays}   unit="count" label="Tight days (≤3)" tooltip="Days where availability ≤ 3 rooms — push rate / close-to-arrival opportunity." />
        <KpiBox value={sellouts}    unit="count" label="Sellouts"        tooltip="Days where availability = 0. Confirm against pickup before celebrating." />
      </div>

      {/* Canonical period chooser — under the KPI tile row. */}
      <PeriodSelectorRow
        basePath="/revenue/inventory"
        win={period.win}
        cmp={period.cmp}
        includeForward
        preserve={{ seg: period.seg }}
      />

      <div style={{ marginTop: 18 }}>
        <SectionHead title="Inventory" emphasis="per date" sub={`${days.length} days · sellable inventory + rate spread`} source="mv_rate_inventory_calendar" />
        <InventoryTable rows={days} />
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
const metaDim: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', letterSpacing: 'var(--ls-loose)' };
