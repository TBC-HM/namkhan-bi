// lib/reports/daily_revenue.ts
// Yesterday's USALI snapshot from v_kpi_daily + v_revenue_usali.
// Namkhan: LAK base, USD comms. View `v_kpi_daily` is already property-scoped.

import type { RenderFn } from './_shared';
import {
  fmtMoneyDual,
  fmtPct,
  fmtNum,
  fmtDateLong,
  kpiGrid,
  pageShell,
  paragraph,
  resolveProperty,
  section,
  table,
  todayISO,
  variance,
  flag,
  note,
} from './_shared';

export const render: RenderFn = async (params, supabase) => {
  const theme = resolveProperty(params.property_id);
  const date: string =
    typeof params.date === 'string' && params.date ? params.date : todayISO(-1);

  // Daily KPI row
  const { data: kpi, error: kpiErr } = await supabase
    .from('v_kpi_daily')
    .select('*')
    .eq('metric_date', date)
    .maybeSingle();

  // 7-day rolling for context
  const start7 = new Date(date);
  start7.setUTCDate(start7.getUTCDate() - 6);
  const { data: last7 } = await supabase
    .from('v_kpi_daily')
    .select('metric_date,occupancy_pct,adr,revpar,total_revenue')
    .gte('metric_date', start7.toISOString().slice(0, 10))
    .lte('metric_date', date)
    .order('metric_date', { ascending: false });

  // USALI breakdown for the day
  const { data: usali } = await supabase
    .from('v_revenue_usali')
    .select('usali_dept,usali_subdept,revenue_gross,payments_received')
    .eq('service_date', date)
    .order('revenue_gross', { ascending: false });

  const rooms = Number(kpi?.rooms_revenue || 0);
  const fb = Number(kpi?.fb_revenue || 0);
  const other = Number(kpi?.other_revenue || 0);
  const total = Number(kpi?.total_revenue || rooms + fb + other);

  const kpisHtml = kpiGrid(
    [
      { label: 'Occupancy', value: fmtPct(kpi?.occupancy_pct) },
      { label: 'ADR', value: fmtMoneyDual(kpi?.adr, theme) },
      { label: 'RevPAR', value: fmtMoneyDual(kpi?.revpar, theme) },
      {
        label: 'Rooms sold',
        value: fmtNum(kpi?.rooms_sold),
        sub: `of ${fmtNum(kpi?.rooms_available)} avail`,
      },
    ],
    theme,
  );

  const revHtml = kpiGrid(
    [
      { label: 'Rooms', value: fmtMoneyDual(rooms, theme) },
      { label: 'F&B', value: fmtMoneyDual(fb, theme) },
      { label: 'Other Op', value: fmtMoneyDual(other, theme) },
      { label: 'Total', value: fmtMoneyDual(total, theme) },
    ],
    theme,
  );

  const usaliRows = (usali || []).map((u: any) => ({
    dept: u.usali_dept || '—',
    subdept: u.usali_subdept || '—',
    revenue: fmtMoneyDual(u.revenue_gross, theme),
    payments: fmtMoneyDual(u.payments_received, theme),
  }));

  const sevenRows = (last7 || []).map((r: any) => ({
    metric_date: r.metric_date,
    occ: fmtPct(r.occupancy_pct),
    adr: fmtMoneyDual(r.adr, theme),
    revpar: fmtMoneyDual(r.revpar, theme),
    total: fmtMoneyDual(r.total_revenue, theme),
  }));

  // Variance vs 7-day average (proxy for "vs forecast" until forecast view ships)
  const last7Vals = (last7 || []).filter((r: any) => r.metric_date !== date);
  const avgRev =
    last7Vals.length > 0
      ? last7Vals.reduce((s: number, r: any) => s + Number(r.total_revenue || 0), 0) / last7Vals.length
      : 0;
  const totalVsAvg = variance(total, avgRev);
  const varianceLine = `Total revenue vs prior-7-day avg: ${flag(totalVsAvg, theme)}`;

  const summary_text =
    `${theme.property_name} daily revenue ${date}: ` +
    `total ${fmtMoneyDual(total, theme)}, rooms ${fmtMoneyDual(rooms, theme)}, F&B ${fmtMoneyDual(fb, theme)}, ` +
    `occ ${fmtPct(kpi?.occupancy_pct)}, ADR ${fmtMoneyDual(kpi?.adr, theme)}, RevPAR ${fmtMoneyDual(kpi?.revpar, theme)}.`;

  const bodyHtml =
    (kpiErr ? note(`KPI fetch error: ${kpiErr.message}`, theme) : '') +
    section('Headline KPIs', theme, kpisHtml) +
    section('Revenue mix (USALI)', theme, revHtml) +
    section(
      'Variance vs rolling 7-day average',
      theme,
      paragraph(varianceLine.replace(/<[^>]+>/g, ''), theme).replace(
        '—',
        '—',
      ) + `<div style="margin-top:4px;font-size:13px;">${varianceLine}</div>`,
    ) +
    section(
      'USALI sub-departments',
      theme,
      table(
        [
          { key: 'dept', label: 'Dept' },
          { key: 'subdept', label: 'Sub-dept' },
          { key: 'revenue', label: 'Revenue', align: 'right' },
          { key: 'payments', label: 'Payments', align: 'right' },
        ],
        usaliRows,
        theme,
      ),
    ) +
    section(
      'Last 7 days',
      theme,
      table(
        [
          { key: 'metric_date', label: 'Date' },
          { key: 'occ', label: 'Occ', align: 'right' },
          { key: 'adr', label: 'ADR', align: 'right' },
          { key: 'revpar', label: 'RevPAR', align: 'right' },
          { key: 'total', label: 'Total rev', align: 'right' },
        ],
        sevenRows,
        theme,
      ),
    );

  const html = pageShell({
    theme,
    title: 'Daily Revenue Report',
    subtitle: fmtDateLong(date),
    bodyHtml,
  });

  return {
    html,
    subject: `${theme.property_name} · Daily revenue · ${date}`,
    summary_text,
  };
};
