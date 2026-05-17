// lib/reports/weekly_pnl.ts
// Last-7-days USALI dept rollup, MoM + YoY + cash position.

import type { RenderFn } from './_shared';
import {
  fmtMoneyDual,
  fmtPct,
  pageShell,
  resolveProperty,
  section,
  table,
  todayISO,
  variance,
  flag,
  paragraph,
} from './_shared';

export const render: RenderFn = async (params, supabase) => {
  const theme = resolveProperty(params.property_id);
  const weekEnd =
    typeof params.week_end === 'string' && params.week_end
      ? params.week_end
      : todayISO(-1);
  const weekEndDate = new Date(weekEnd);
  const weekStartDate = new Date(weekEnd);
  weekStartDate.setUTCDate(weekStartDate.getUTCDate() - 6);
  const weekStart = weekStartDate.toISOString().slice(0, 10);

  // last 7 days rollup
  const { data: thisWk } = await supabase
    .from('v_revenue_usali')
    .select('usali_dept,revenue_gross,payments_received')
    .gte('service_date', weekStart)
    .lte('service_date', weekEnd);

  // prior 7 days
  const prevEnd = new Date(weekStartDate);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - 6);
  const { data: prevWk } = await supabase
    .from('v_revenue_usali')
    .select('usali_dept,revenue_gross')
    .gte('service_date', prevStart.toISOString().slice(0, 10))
    .lte('service_date', prevEnd.toISOString().slice(0, 10));

  // last year same week
  const lyEnd = new Date(weekEndDate);
  lyEnd.setUTCFullYear(lyEnd.getUTCFullYear() - 1);
  const lyStart = new Date(weekStartDate);
  lyStart.setUTCFullYear(lyStart.getUTCFullYear() - 1);
  const { data: lyWk } = await supabase
    .from('v_revenue_usali')
    .select('usali_dept,revenue_gross')
    .gte('service_date', lyStart.toISOString().slice(0, 10))
    .lte('service_date', lyEnd.toISOString().slice(0, 10));

  function rollup(rows: any[]) {
    const m = new Map<string, number>();
    for (const r of rows || []) {
      const d = r.usali_dept || 'OTHER';
      m.set(d, (m.get(d) || 0) + Number(r.revenue_gross || 0));
    }
    return m;
  }
  const cur = rollup(thisWk || []);
  const prev = rollup(prevWk || []);
  const ly = rollup(lyWk || []);

  const depts = Array.from(new Set([...cur.keys(), ...prev.keys(), ...ly.keys()])).sort();
  const rows = depts.map((d) => {
    const c = cur.get(d) || 0;
    const p = prev.get(d) || 0;
    const l = ly.get(d) || 0;
    return {
      dept: d,
      cur: fmtMoneyDual(c, theme),
      prev: fmtMoneyDual(p, theme),
      ly: fmtMoneyDual(l, theme),
      mom: flag(variance(c, p), theme),
      yoy: flag(variance(c, l), theme),
    };
  });

  const totalCur = Array.from(cur.values()).reduce((s, v) => s + v, 0);
  const totalPrev = Array.from(prev.values()).reduce((s, v) => s + v, 0);
  const totalLy = Array.from(ly.values()).reduce((s, v) => s + v, 0);
  rows.push({
    dept: 'TOTAL',
    cur: `<b>${fmtMoneyDual(totalCur, theme)}</b>`,
    prev: fmtMoneyDual(totalPrev, theme),
    ly: fmtMoneyDual(totalLy, theme),
    mom: flag(variance(totalCur, totalPrev), theme),
    yoy: flag(variance(totalCur, totalLy), theme),
  });

  // Cash position (best-effort from v_finance_cash_forecast)
  let cashLine = 'Cash forecast view not queried in this pass.';
  try {
    const { data: cash } = await supabase
      .from('v_finance_cash_forecast')
      .select('*')
      .limit(1);
    if (cash && cash.length > 0) {
      const c = cash[0] as any;
      const usd =
        c.ending_balance_usd ?? c.closing_balance_usd ?? c.balance_usd ?? c.cash_usd ?? null;
      if (usd != null) cashLine = `Cash balance: ${fmtMoneyDual(usd, theme)}`;
    }
  } catch {
    /* view shape may vary — non-fatal */
  }

  // Top movers (dept whose absolute MoM delta is largest)
  const movers = depts
    .map((d) => {
      const c = cur.get(d) || 0;
      const p = prev.get(d) || 0;
      return { dept: d, delta: c - p };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5);

  const summary_text =
    `${theme.property_name} weekly P&L ${weekStart}–${weekEnd}: total ${fmtMoneyDual(totalCur, theme)} ` +
    `(prev wk ${fmtMoneyDual(totalPrev, theme)}, LY ${fmtMoneyDual(totalLy, theme)}). ${cashLine}.`;

  const html = pageShell({
    theme,
    title: 'Weekly P&L Brief',
    subtitle: `${weekStart} → ${weekEnd}`,
    bodyHtml:
      section(
        'USALI dept rollup',
        theme,
        table(
          [
            { key: 'dept', label: 'Dept' },
            { key: 'cur', label: 'This wk', align: 'right' },
            { key: 'prev', label: 'Prev wk', align: 'right' },
            { key: 'ly', label: 'LY wk', align: 'right' },
            { key: 'mom', label: 'MoM', align: 'right' },
            { key: 'yoy', label: 'YoY', align: 'right' },
          ],
          rows,
          theme,
        ),
      ) +
      section(
        'Top movers (MoM, absolute delta)',
        theme,
        table(
          [
            { key: 'dept', label: 'Dept' },
            { key: 'delta', label: 'Delta vs prev wk', align: 'right' },
          ],
          movers.map((m) => ({
            dept: m.dept,
            delta: fmtMoneyDual(m.delta, theme),
          })),
          theme,
        ),
      ) +
      section('Cash position', theme, paragraph(cashLine, theme)),
  });

  return {
    html,
    subject: `${theme.property_name} · Weekly P&L · w/e ${weekEnd}`,
    summary_text,
  };
};
