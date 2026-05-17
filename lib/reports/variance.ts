// lib/reports/variance.ts
// Actual vs budget vs LY on every USALI line, period-scoped.
// Budget pulled from v_finance_budget_vs_actual when shape permits; otherwise
// "—" with an explanatory note.

import type { RenderFn } from './_shared';
import {
  fmtMoneyDual,
  pageShell,
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
  const to = typeof params.to === 'string' ? params.to : todayISO(-1);
  const from = typeof params.from === 'string' ? params.from : todayISO(-30);

  // Actuals by USALI line
  const { data: actuals } = await supabase
    .from('v_revenue_usali')
    .select('usali_dept,usali_subdept,revenue_gross')
    .gte('service_date', from)
    .lte('service_date', to);

  // LY same period
  const lyFrom = new Date(from);
  lyFrom.setUTCFullYear(lyFrom.getUTCFullYear() - 1);
  const lyTo = new Date(to);
  lyTo.setUTCFullYear(lyTo.getUTCFullYear() - 1);
  const { data: lyActuals } = await supabase
    .from('v_revenue_usali')
    .select('usali_dept,usali_subdept,revenue_gross')
    .gte('service_date', lyFrom.toISOString().slice(0, 10))
    .lte('service_date', lyTo.toISOString().slice(0, 10));

  function rollup(rows: any[]) {
    const m = new Map<string, number>();
    for (const r of rows || []) {
      const k = `${r.usali_dept || 'OTHER'} / ${r.usali_subdept || '—'}`;
      m.set(k, (m.get(k) || 0) + Number(r.revenue_gross || 0));
    }
    return m;
  }
  const aMap = rollup(actuals || []);
  const lyMap = rollup(lyActuals || []);

  // Budget rollup (best-effort)
  let bMap = new Map<string, number>();
  let budgetWarn = false;
  try {
    const { data: budget } = await supabase
      .from('v_finance_budget_vs_actual')
      .select('*')
      .limit(2000);
    if (budget && budget.length > 0) {
      for (const r of budget as any[]) {
        const dept = r.usali_dept || r.dept || r.usali_subcategory || 'OTHER';
        const sub = r.usali_subdept || r.usali_line_label || r.line_label || '—';
        const k = `${dept} / ${sub}`;
        const v = Number(r.budget_amount ?? r.budget_usd ?? r.budget ?? 0);
        bMap.set(k, (bMap.get(k) || 0) + v);
      }
    } else {
      budgetWarn = true;
    }
  } catch {
    budgetWarn = true;
  }

  const keys = Array.from(
    new Set([...aMap.keys(), ...bMap.keys(), ...lyMap.keys()]),
  ).sort();

  const rows = keys.map((k) => {
    const a = aMap.get(k) || 0;
    const b = bMap.get(k) || 0;
    const l = lyMap.get(k) || 0;
    return {
      line: k,
      actual: fmtMoneyDual(a, theme),
      budget: b === 0 ? '—' : fmtMoneyDual(b, theme),
      ly: fmtMoneyDual(l, theme),
      bvar: b === 0 ? '—' : flag(variance(a, b), theme),
      yvar: l === 0 ? '—' : flag(variance(a, l), theme),
    };
  });

  const tot = (m: Map<string, number>) =>
    Array.from(m.values()).reduce((s, v) => s + v, 0);
  rows.push({
    line: 'TOTAL',
    actual: `<b>${fmtMoneyDual(tot(aMap), theme)}</b>`,
    budget: tot(bMap) === 0 ? '—' : fmtMoneyDual(tot(bMap), theme),
    ly: fmtMoneyDual(tot(lyMap), theme),
    bvar: tot(bMap) === 0 ? '—' : flag(variance(tot(aMap), tot(bMap)), theme),
    yvar: tot(lyMap) === 0 ? '—' : flag(variance(tot(aMap), tot(lyMap)), theme),
  });

  const summary_text =
    `${theme.property_name} variance ${from}→${to}: actual ${fmtMoneyDual(tot(aMap), theme)}, ` +
    `LY ${fmtMoneyDual(tot(lyMap), theme)}, budget ${tot(bMap) === 0 ? 'n/a' : fmtMoneyDual(tot(bMap), theme)}.`;

  const html = pageShell({
    theme,
    title: 'Variance Report',
    subtitle: `${from} → ${to}`,
    bodyHtml:
      (budgetWarn
        ? note(
            'Budget data not available from v_finance_budget_vs_actual — variance vs LY only. Wire budget upstream to enable budget column.',
            theme,
          )
        : '') +
      section(
        'USALI lines · actual vs budget vs LY',
        theme,
        table(
          [
            { key: 'line', label: 'USALI line' },
            { key: 'actual', label: 'Actual', align: 'right' },
            { key: 'budget', label: 'Budget', align: 'right' },
            { key: 'ly', label: 'LY', align: 'right' },
            { key: 'bvar', label: 'vs Budget', align: 'right' },
            { key: 'yvar', label: 'vs LY', align: 'right' },
          ],
          rows,
          theme,
        ),
      ),
  });

  return {
    html,
    subject: `${theme.property_name} · Variance report · ${from}–${to}`,
    summary_text,
  };
};
