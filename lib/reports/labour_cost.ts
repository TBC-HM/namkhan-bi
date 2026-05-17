// lib/reports/labour_cost.ts
// Staff cost per dept per period; overtime; supplements; CPOR.
// Uses v_payroll_dept_monthly (totals in LAK + USD already).

import type { RenderFn } from './_shared';
import {
  fmtMoneyDual,
  fmtNum,
  pageShell,
  resolveProperty,
  section,
  table,
  todayISO,
  paragraph,
  kpiGrid,
} from './_shared';

export const render: RenderFn = async (params, supabase) => {
  const theme = resolveProperty(params.property_id);
  // Default: previous month (anchor on first day of month for the view's bucket)
  const today = new Date();
  const firstOfThisMonth = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
  );
  const firstOfPrev = new Date(firstOfThisMonth);
  firstOfPrev.setUTCMonth(firstOfPrev.getUTCMonth() - 1);
  const monthISO =
    typeof params.month === 'string' && params.month
      ? params.month.slice(0, 10)
      : firstOfPrev.toISOString().slice(0, 10);

  const { data: pay } = await supabase
    .from('v_payroll_dept_monthly')
    .select(
      'period_month,dept_code,dept_name,headcount,total_days_worked,total_base_lak,total_overtime_lak,total_sc_lak,total_allow_lak,total_grand_usd,total_canonical_cost_usd,total_benefits_lak',
    )
    .eq('period_month', monthISO)
    .order('total_canonical_cost_usd', { ascending: false });

  const rows = (pay || []).map((r: any) => ({
    dept: r.dept_name || r.dept_code || '—',
    hc: fmtNum(r.headcount),
    days: fmtNum(r.total_days_worked),
    base: fmtMoneyDual(Number(r.total_base_lak || 0) / 21800, theme),
    ot: fmtMoneyDual(Number(r.total_overtime_lak || 0) / 21800, theme),
    supp: fmtMoneyDual(
      (Number(r.total_sc_lak || 0) + Number(r.total_allow_lak || 0)) / 21800,
      theme,
    ),
    total: fmtMoneyDual(Number(r.total_canonical_cost_usd || r.total_grand_usd || 0), theme),
  }));

  const totalCost = (pay || []).reduce(
    (s: number, r: any) =>
      s + Number(r.total_canonical_cost_usd || r.total_grand_usd || 0),
    0,
  );

  // CPOR — use rooms sold over same calendar month
  const monthStart = monthISO;
  const monthEndDate = new Date(monthISO);
  monthEndDate.setUTCMonth(monthEndDate.getUTCMonth() + 1);
  monthEndDate.setUTCDate(0);
  const monthEnd = monthEndDate.toISOString().slice(0, 10);

  const { data: kpiRows } = await supabase
    .from('v_kpi_daily')
    .select('rooms_sold')
    .gte('metric_date', monthStart)
    .lte('metric_date', monthEnd);
  const roomsSold = (kpiRows || []).reduce(
    (s: number, r: any) => s + Number(r.rooms_sold || 0),
    0,
  );
  const cpor = roomsSold > 0 ? totalCost / roomsSold : 0;

  const summary_text =
    `${theme.property_name} labour ${monthISO}: total ${fmtMoneyDual(totalCost, theme)} ` +
    `across ${rows.length} depts; CPOR ${fmtMoneyDual(cpor, theme)} on ${fmtNum(roomsSold)} occ rooms.`;

  const html = pageShell({
    theme,
    title: 'Labour Cost Report',
    subtitle: `Month ${monthISO}`,
    bodyHtml:
      section(
        'Headline',
        theme,
        kpiGrid(
          [
            { label: 'Total labour', value: fmtMoneyDual(totalCost, theme) },
            { label: 'Rooms sold', value: fmtNum(roomsSold) },
            { label: 'CPOR', value: fmtMoneyDual(cpor, theme) },
          ],
          theme,
        ),
      ) +
      section(
        'By department',
        theme,
        table(
          [
            { key: 'dept', label: 'Dept' },
            { key: 'hc', label: 'HC', align: 'right' },
            { key: 'days', label: 'Days', align: 'right' },
            { key: 'base', label: 'Base', align: 'right' },
            { key: 'ot', label: 'Overtime', align: 'right' },
            { key: 'supp', label: 'Suppl.', align: 'right' },
            { key: 'total', label: 'Total cost', align: 'right' },
          ],
          rows,
          theme,
        ),
      ) +
      (rows.length === 0
        ? paragraph(
            `No payroll rows for period_month=${monthISO}. Check ingest cadence.`,
            theme,
          )
        : ''),
  });

  return {
    html,
    subject: `${theme.property_name} · Labour cost · ${monthISO}`,
    summary_text,
  };
};
