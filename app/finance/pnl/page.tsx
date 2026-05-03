// app/finance/pnl/page.tsx
// Finance · USALI P&L — full IA layout per proposal 2026-04-30.
// Branded skin (cream / forest-green / tan) sampled from /revenue/pulse.
// Wired tiles use Supabase data; unwired tiles render with "Data needed" badges
// referencing the schema gap (1–8) blocking them. See deploy-doc-schema-finance-pnl-2026-04-30.md.

import { getKpiDaily, aggregateDaily } from '@/lib/data';
import { resolvePeriod } from '@/lib/period';
import {
  getPlSections, getUsaliHouse, getUsaliDept, getUsaliPlBySubcat,
  getDqUnmappedCount, getPendingDecisions, periodsForWindow, currentPeriod, pickSection, pickPeriod,
} from '../_data';
import { priorPeriod, type PeriodWindow } from '@/lib/supabase-gl';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

function fmtK(n: number | null | undefined, dp = 1): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  const v = n / 1000;
  return `$${v.toFixed(dp)}k`;
}

function fmtPp(n: number | null | undefined, dp = 1): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(dp)} pp`;
}

function fmtPctV(n: number | null | undefined, dp = 1): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return `${n.toFixed(dp)}%`;
}

export default async function PnLPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);

  // Window selector (TODAY/7D/30D/90D/YTD) → period_yyyymm filter on gl.* tables.
  // Always pull a 12-month look-back so we can locate the latest CLOSED month
  // even when the calendar-current month has zero data (audit fix 2026-05-03).
  const win = ((searchParams.win as string) || '30D').toUpperCase() as PeriodWindow;
  const winPeriods = periodsForWindow(['TODAY','7D','30D','90D','YTD'].includes(win) ? win : '30D');
  const lookbackPeriods = (() => {
    const out: string[] = [];
    const today = new Date();
    for (let i = 0; i < 13; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return out;
  })();
  const fetchPeriods = Array.from(new Set([...winPeriods, ...lookbackPeriods]));

  // Parallel fetch: gl.* + legacy daily KPI.
  // Subcategory queries use `fetchPeriods` (12-month lookback) so we always have
  // closed-month data even when the calendar-current month is empty.
  const [plSections, houseRows, deptRows, agSubcat, payrollSubcat, fbDeptOnly, otaCommissions, dqUnmapped, decisions, daily] = await Promise.all([
    getPlSections(fetchPeriods),
    getUsaliHouse(fetchPeriods),
    getUsaliDept(fetchPeriods),
    getUsaliPlBySubcat(fetchPeriods, 'A&G'),
    getUsaliPlBySubcat(fetchPeriods, 'Payroll & Related'),
    getUsaliDept(fetchPeriods).then(rs => rs.filter(r => r.usali_department === 'F&B')),
    getUsaliPlBySubcat(fetchPeriods, 'Sales & Marketing'),
    getDqUnmappedCount(),
    getPendingDecisions(5),
    getKpiDaily(period).catch(() => []),
  ]);
  const agg = aggregateDaily(daily, period.capacityMode);

  // Pick the latest CLOSED period: explicitly exclude the calendar-current month
  // (it's always in progress and may have stray $13 of misposted revenue) — and
  // require at least $1,000 of income to count as a "real" closed month.
  const calCur = currentPeriod();
  const periodsWithRev = Array.from(new Set(
    plSections
      .filter(r => r.section === 'income' && Number(r.amount_usd) >= 1000 && r.period_yyyymm !== calCur)
      .map(r => r.period_yyyymm)
  )).sort().reverse();
  const cur = periodsWithRev[0] || calCur;
  const prior = periodsWithRev[1] || priorPeriod(cur);
  const plPrior = plSections.filter(r => r.period_yyyymm === prior);

  // KPI calculations from gl.* — `cur` is the latest closed month with revenue
  const totalRev = pickSection(plSections.filter(r => r.period_yyyymm === cur), 'income');
  const priorTotalRev = pickSection(plPrior, 'income');
  const revVsPriorPct = priorTotalRev ? ((totalRev - priorTotalRev) / priorTotalRev) * 100 : 0;

  const houseCur = pickPeriod(houseRows, cur);
  const gop = houseCur?.gop ?? null;
  const gopMargin = (gop != null && totalRev > 0) ? (gop / totalRev) * 100 : null;
  const ebitda = (gop != null) ? gop - (houseCur?.depreciation || 0) - (houseCur?.interest || 0) - (houseCur?.income_tax || 0) : null;

  // Window stats: scope to the latest closed period only so the secondary KPIs
  // line up with the primary KPIs (both reflect April when calendar=May).
  const closedScope = [cur];
  const totalRevWindow = closedScope.reduce((s, p) => s + pickSection(plSections.filter(r => r.period_yyyymm === p), 'income'), 0);
  const totalPayrollWindow = payrollSubcat
    .filter(r => closedScope.includes(r.period_yyyymm))
    .reduce((s, r) => s + Number(r.amount_usd || 0), 0);
  const labourPct = totalRevWindow > 0 ? (totalPayrollWindow / totalRevWindow) * 100 : null;

  const fbRevWindow = fbDeptOnly
    .filter(r => closedScope.includes(r.period_yyyymm))
    .reduce((s, r) => s + Number(r.revenue || 0), 0);
  const fbPayrollWindow = payrollSubcat
    .filter(r => r.usali_department === 'F&B' && closedScope.includes(r.period_yyyymm))
    .reduce((s, r) => s + Number(r.amount_usd || 0), 0);
  const fbLabourPct = fbRevWindow > 0 ? (fbPayrollWindow / fbRevWindow) * 100 : null;

  const otaCommWindow = otaCommissions
    .filter(r => closedScope.includes(r.period_yyyymm))
    .filter(r => (r.usali_line_code || '').includes('OTA') || (r.account_id || '').startsWith('624'))
    .reduce((s, r) => s + Number(r.amount_usd || 0), 0);
  const channelsCommissionPct = totalRevWindow > 0 ? (otaCommWindow / totalRevWindow) * 100 : null;

  const agTotalWindow = agSubcat
    .filter(r => closedScope.includes(r.period_yyyymm))
    .reduce((s, r) => s + Number(r.amount_usd || 0), 0);

  // Dept rows for USALI table — current period only
  const deptCurMap = new Map(deptRows.filter(r => r.period_yyyymm === cur).map(r => [r.usali_department, r]));
  const months = Array.from(new Set(plSections.map(r => r.period_yyyymm))).sort().reverse();
  const latestMonth = months[0] || cur;
  const monthLabel = latestMonth ? new Date(latestMonth + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'Apr 2026';

  return (
    <div className="pnl-page">
      {/* ============== BLOCK 1 — Title + breadcrumb ============== */}
      <div className="title-block" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-mute, #8a8170)', marginBottom: 4 }}>
          Finance &nbsp;›&nbsp; <b>P&amp;L</b>
        </div>
        <h1 style={{ margin: 0, fontFamily: 'var(--serif, Georgia, serif)', fontSize: 28, fontWeight: 600 }}>
          Profit &amp; loss · where the <em>margin</em> lives.
        </h1>
        <div className="subtitle" style={{ color: 'var(--ink-mute, #8a8170)', fontSize: 13, marginTop: 2 }}>
          Where to act this week to defend GOP. USALI 11th ed.
        </div>
      </div>

      {/* ============== BLOCK 2 — Period + write-policy banners ============== */}
      <div className="period-banner">
        <span>
          Active period: <b>{period.rangeLabel}</b> · {monthLabel} (MTD)
        </span>
        <span className="meta-token">
          win={period.win} · cmp={period.cmp} · ccy=usd · seg={period.seg}
        </span>
      </div>

      <div className="warn-banner">
        ⚠ <b>Cloudbeds write policy — pilot phase.</b>{' '}
        Agent-proposed reclassifications, JE proposals, and RFQs always require explicit human approval.
        Variance Composer never auto-publishes commentary. Controller Agent never posts to GL. Procurement
        Agent has no PO authority. After validation against 90 days of decisions, only Tier-1 actions
        (parity resync, &lt;$2k impact, ≥85% confidence) move to auto. Configure in <code>⚙ Agent Guardrails</code>.
      </div>

      {/* ============== BLOCK 4 — KPI grid (primary 6 + secondary 5) ============== */}
      <div className="kpi-section">
        {/* Primary 6 */}
        <div className="kpi-row">
          <div className="kpi">
            <div className="scope">Property</div>
            <div className="val">{fmtK(totalRev, 0)}</div>
            <div className="deltas">
              <span className={revVsPriorPct >= 0 ? 'pos' : 'neg'}>
                {revVsPriorPct >= 0 ? '▲' : '▼'} {fmtPctV(revVsPriorPct)} vs prior mo
              </span>
            </div>
            <div className="lbl">Total Revenue</div>
          </div>
          <div className={'kpi ' + (gop == null ? 'dim' : '')}>
            <div className="scope">P&amp;L</div>
            <div className="val">{fmtK(gop)}</div>
            <div className="deltas"><span className="neu">{gop == null ? 'awaiting gl_entries load' : 'gl.v_usali_house_summary.gop'}</span></div>
            <div className="lbl">GOP $</div>
            {gop == null && <span className="needs" title="Run qb-deploy/gl_entries_load.sql">load gl_entries</span>}
          </div>
          <div className={'kpi ' + (gopMargin == null ? 'dim' : '')}>
            <div className="scope">P&amp;L</div>
            <div className="val">{fmtPctV(gopMargin)}</div>
            <div className="deltas"><span className="neu">{gopMargin == null ? 'awaiting GOP$' : 'gop / total_revenue'}</span></div>
            <div className="lbl">GOP margin</div>
          </div>
          <div className="kpi dim">
            <div className="scope">Flow</div>
            <div className="val">—</div>
            <div className="deltas"><span className="neu">needs LY data</span></div>
            <div className="lbl">Flow-through</div>
            <span className="needs" title="Phase 3 — needs LY P&amp;L import">deferred</span>
          </div>
          <div className={'kpi ' + (ebitda == null ? 'dim' : '')}>
            <div className="scope">P&amp;L</div>
            <div className="val">{fmtK(ebitda)}</div>
            <div className="deltas"><span className="neu">{ebitda == null ? 'awaiting GOP$' : 'gop − depr − interest − tax'}</span></div>
            <div className="lbl">EBITDA</div>
          </div>
          <div className="kpi dim">
            <div className="scope">Cash</div>
            <div className="val">—</div>
            <div className="deltas"><span className="neu">bank feed pending</span></div>
            <div className="lbl">Cash on hand</div>
            <span className="needs" title="Gap 4 — gl.cash_forecast_weekly">data needed · Gap 4</span>
          </div>
        </div>

        {/* Secondary 5 */}
        <div className="kpi-row secondary">
          <div className={'kpi secondary ' + (labourPct == null ? 'dim' : '')}>
            <div className="scope">Ops</div>
            <div className="val">{fmtPctV(labourPct)}</div>
            <div className="deltas"><span className="neu">{labourPct == null ? 'awaiting gl_entries' : 'payroll ÷ revenue (window)'}</span></div>
            <div className="lbl">Labour cost %</div>
          </div>
          <div className={'kpi secondary ' + (fbLabourPct == null ? 'dim' : '')}>
            <div className="scope">F&amp;B</div>
            <div className="val">{fmtPctV(fbLabourPct)}</div>
            <div className="deltas"><span className="neu">{fbLabourPct == null ? 'awaiting gl_entries' : 'F&B payroll ÷ F&B revenue'}</span></div>
            <div className="lbl">F&amp;B labour %</div>
          </div>
          <div className={'kpi secondary ' + (channelsCommissionPct == null && (!agg || agg.commission_pct == null) ? 'dim' : '')}>
            <div className="scope">Channels</div>
            <div className="val">{channelsCommissionPct != null ? fmtPctV(channelsCommissionPct) : (agg && agg.commission_pct != null ? fmtPctV(agg.commission_pct as number) : '—')}</div>
            <div className="deltas"><span className="neu">{channelsCommissionPct != null ? 'gl.account_id LIKE 624%' : 'channels.commission_pct (legacy)'}</span></div>
            <div className="lbl">Distribution cost %</div>
          </div>
          <div className={'kpi secondary ' + (agTotalWindow === 0 ? 'dim' : '')}>
            <div className="scope">P&amp;L</div>
            <div className="val">{fmtK(agTotalWindow)}</div>
            <div className="deltas"><span className="neu">{agTotalWindow === 0 ? 'awaiting gl_entries' : 'mv_usali_pl_monthly · A&G'}</span></div>
            <div className="lbl">A&amp;G $</div>
          </div>
          <div className="kpi secondary">
            <div className="scope">Audit</div>
            <div className="val">{dqUnmapped}</div>
            <div className="deltas"><span className="neu">DQ-04-UNMAPPED open</span></div>
            <div className="lbl">USALI mapping gaps</div>
          </div>
        </div>
      </div>

      {/* ============== BLOCK 5 — Agent strip ============== */}
      <div className="agent-strip">
        <span className="heading"><span className="dot" /> Finance agents <span className="new-badge">NEW</span></span>
        <span className="chip" title="Daily 06:00 · last run 06:02 · 4 findings"><span className="dot idle" />P&amp;L Detector</span>
        <span className="chip" title="On-demand · 1 draft pending review"><span className="dot idle" />Variance Composer</span>
        <span className="chip" title="Weekly Mon 07:00 · running · 3 JE proposals"><span className="dot running" />Controller Agent</span>
        <span className="chip" title="Weekly Wed 09:00 · idle · 2 RFQ drafts"><span className="dot idle" />Procurement Agent</span>
        <button type="button" className="fire" disabled>⚡ Fire all</button>
      </div>

      {/* ============== BLOCK 6 — Decision queue ============== */}
      <div className="section-head">
        <h3>Decisions <em>queued</em> for you</h3>
        <span className="meta">5 actions · ranked by $ impact · <a href="#" style={{ color: 'var(--tan, #a17a4f)' }}>view all</a></span>
      </div>
      <div className="queue">
        {(() => {
          const sample = [
            { impact: '+$4,200', title: 'Renegotiate beverage supplier (Q2 cost +18% YoY)', meta: 'Top 3 SKUs · Lao Beverage Co · conf 72% · velocity: this week · Procurement Agent' },
            { impact: '+$2,800', title: 'Cut Tuesday spa shift Apr–May (utilisation 31%)', meta: 'Spa · 8 weeks · cross-section → Operations RosterAgent · conf 84% · velocity: this week' },
            { impact: '+$1,950', title: 'Approve revised energy mix (solar inverter), payback 14mo', meta: 'CapEx $27k · IRR 22% · conf 88% · velocity: this month · Maintenance Agent' },
            { impact: '+$1,600', title: 'Reclassify Mar marketing accruals (mis-coded to Rooms OPEX)', meta: '12 entries · Controller Agent · conf 95%', stamp: 'writes GL · 4-eyes req' },
            { impact: '+$1,400', title: 'Hire 1.0 FTE Front Office (offsets 0.5 OT + 0.5 contractor)', meta: 'manual review (HR) · conf 67% · velocity: this month' },
          ];
          const rows = decisions.length > 0
            ? decisions.map((d) => {
                const impact = d.impact_usd_estimate != null ? `+$${Math.round(Number(d.impact_usd_estimate)).toLocaleString()}` : '—';
                const title = String(d.title || (d as any).description || `Decision ${(d.id || '').toString().slice(0, 8)}`);
                const meta = `governance.decision_queue · ${(d as any).agent_code || ''} · status=${d.status || ''}`;
                return { impact, title, meta };
              })
            : sample;
          return rows.map((row: any, i: number) => (
            <div className="qrow" key={i}>
              <div className="impact pos">{row.impact}</div>
              <div>
                <div className="title">{row.title}</div>
                <div className="meta-line">
                  {row.meta}
                  {row.stamp && <span className="stamp"> {row.stamp}</span>}
                </div>
              </div>
              <div className="actions">
                <button type="button" className="btn primary" disabled>Approve</button>
                <button type="button" className="btn" disabled>Send back</button>
                <button type="button" className="btn" disabled>Snooze</button>
                <button type="button" className="btn" disabled>Open</button>
              </div>
            </div>
          ));
        })()}
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-mute, #8a8170)' }}>
        {decisions.length > 0
          ? <>Live queue from <code>governance.decision_queue</code> · {decisions.length} pending. Action handlers (Approve/Snooze) require server actions wiring — defer to Phase 3.</>
          : <>No pending items in <code>governance.decision_queue</code> · sample shown. Action handlers (Approve/Snooze) require server actions wiring — defer to Phase 3.</>
        }
      </div>

      {/* ============== BLOCK 7 — Tactical alerts ============== */}
      <div className="section-head" style={{ marginTop: 24 }}>
        <h3>Tactical <em>alerts</em></h3>
        <span className="meta">cross-dimensional gaps · severity-bordered · sample data until detectors wire</span>
      </div>
      <div className="alerts">
        <div className="alert hi">
          <h4>F&amp;B cost % 38% (target 30%) <span className="imp">−$3.6k / mo</span></h4>
          <div className="dims">dept=F&amp;B × line=beverage × vendor=Lao Beverage Co · breach 6pp</div>
          <div className="reason">Detector: beverage line driving the gap; volume flat, unit cost +18% YoY.</div>
          <div className="tactic"><b>Composer:</b> 1) RFQ to 3 alt suppliers · 2) menu remix toward higher-margin bottles · 3) renegotiate volume tier.</div>
          <div className="handoffs">
            <button type="button" className="btn" disabled>→ Procurement Agent <span className="stamp">approval req</span></button>
            <button type="button" className="btn" disabled>→ F&amp;B head</button>
          </div>
        </div>
        <div className="alert med">
          <h4>Rooms labour HpOR 1.8 (target 1.5) <span className="imp">−$1.9k / mo</span></h4>
          <div className="dims">dept=Rooms × dow=Tue+Wed × shift=night-audit · 2σ breach</div>
          <div className="reason">Detector: 2 night-audit overlap shifts during low occ; unchanged since Q4.</div>
          <div className="tactic"><b>Composer:</b> collapse to single-shift Tue/Wed; reassign overlap to weekend cover.</div>
          <div className="handoffs">
            <button type="button" className="btn" disabled>→ RosterAgent (Operations) <span className="stamp">approval req</span></button>
          </div>
        </div>
        <div className="alert med">
          <h4>Energy +22% MoM, no occ change <span className="imp">−$1.1k / mo</span></h4>
          <div className="dims">dept=POM × line=utilities × period=Mar→Apr · 1.6σ</div>
          <div className="reason">Detector: chiller usage abnormal Apr 14–22; possible refrigerant leak or set-point drift.</div>
          <div className="tactic"><b>Composer:</b> dispatch maintenance check; recalibrate BMS schedule; reset chiller set-point.</div>
          <div className="handoffs">
            <button type="button" className="btn" disabled>→ Maintenance Agent <span className="stamp">approval req</span></button>
          </div>
        </div>
        <div className="alert low">
          <h4>Spa products write-off 1.4% (target 1.0%) <span className="imp">−$220 / mo</span></h4>
          <div className="dims">dept=Spa × line=inventory write-off · audit-hygiene</div>
          <div className="reason">Detector: 6-month products approaching expiry; usage rate lower than 2024.</div>
          <div className="tactic"><b>Composer:</b> 1) discount package combo · 2) staff training on shelf-life rotation.</div>
          <div className="handoffs">
            <button type="button" className="btn" disabled>→ Procurement Agent</button>
          </div>
        </div>
      </div>

      {/* ============== BLOCK 8 — Core panels ============== */}
      <div className="panels" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, marginTop: 24 }}>
        {/* LEFT — USALI grid */}
        <div className="panel">
          <h3>USALI department <em>schedule</em> · {monthLabel} (MTD)</h3>
          <div className="meta">
            Materiality: 5% AND $1,000. Coloring — green ≤5% · amber 5–10% · red &gt;10% AND &gt;$1k.
            Expense rows tagged <b>Gap 2</b> until <code>gl.usali_expense_map</code> ships.
          </div>
          <table className="usali">
            <thead>
              <tr>
                <th>Line</th><th>Actual</th><th>Budget</th><th>LY</th><th>Δ Bgt</th><th>Δ%</th><th>Flow</th>
              </tr>
            </thead>
            <tbody>
              <tr className="section"><td colSpan={7}>Revenue</td></tr>
              {(() => {
                const deptOrder = ['Rooms', 'F&B', 'Spa', 'Activities', 'Mekong Cruise', 'Other Operated'];
                const rows = deptOrder
                  .map((d) => {
                    const r = deptCurMap.get(d);
                    return { name: d, val: r ? Number(r.revenue || 0) : 0 };
                  })
                  .filter((r) => r.val > 0);
                if (rows.length === 0) {
                  return (
                    <tr><td colSpan={7} style={{ color: 'var(--muted, #8a8170)', fontStyle: 'italic', textAlign: 'center' }}>
                      No revenue rows for {cur} — awaiting <code>gl_entries</code> load (run <code>qb-deploy/gl_entries_load.sql</code>)
                    </td></tr>
                  );
                }
                return rows.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{fmtK(r.val)}</td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                  </tr>
                ));
              })()}
              <tr className="subtotal">
                <td>Total Revenue</td>
                <td>{fmtK(totalRev)}</td>
                <td>—</td>
                <td>{fmtK(priorTotalRev)}</td>
                <td>—</td>
                <td className={revVsPriorPct >= 0 ? 'var-green' : 'var-amber'}>{fmtPctV(revVsPriorPct)}</td>
                <td>—</td>
              </tr>

              <tr className="section"><td colSpan={7}>Departmental Expenses (USALI · live from <code>gl.v_usali_dept_summary</code>)</td></tr>
              {(() => {
                const deptOrder = ['Rooms', 'F&B', 'Spa', 'Activities', 'Mekong Cruise', 'Other Operated'];
                const rows = deptOrder
                  .map((d) => {
                    const r = deptCurMap.get(d);
                    if (!r) return null;
                    const exp = (Number(r.cost_of_sales || 0) + Number(r.payroll || 0) + Number(r.other_op_exp || 0));
                    if (exp <= 0) return null;
                    return { name: d, val: exp };
                  })
                  .filter(Boolean) as { name: string; val: number }[];
                if (rows.length === 0) {
                  return (
                    <tr><td colSpan={7} style={{ color: 'var(--muted, #8a8170)', fontStyle: 'italic', textAlign: 'center' }}>
                      No expense rows for {cur} — awaiting <code>gl_entries</code> load
                    </td></tr>
                  );
                }
                return rows.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{fmtK(r.val)}</td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                  </tr>
                ));
              })()}

              <tr className="gop">
                <td>Departmental Profit</td>
                <td>{fmtK(houseCur?.total_dept_profit ?? null)}</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
              </tr>

              <tr className="section"><td colSpan={7}>Undistributed Operating Expenses (live from <code>gl.v_usali_house_summary</code>)</td></tr>
              <tr>
                <td>A&amp;G</td>
                <td>{fmtK(houseCur?.ag_total ?? null)}</td>
                <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
              </tr>
              <tr>
                <td>Sales &amp; Marketing</td>
                <td>{fmtK(houseCur?.sales_marketing ?? null)}</td>
                <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
              </tr>
              <tr>
                <td>POM</td>
                <td>{fmtK(houseCur?.pom ?? null)}</td>
                <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
              </tr>
              <tr>
                <td>Utilities</td>
                <td>{fmtK(houseCur?.utilities ?? null)}</td>
                <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
              </tr>
              <tr>
                <td>Mgmt Fees</td>
                <td>{fmtK(houseCur?.mgmt_fees ?? null)}</td>
                <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
              </tr>

              <tr className="gop">
                <td>GOP after Undistributed</td>
                <td>{fmtK(houseCur?.gop ?? null)}</td>
                <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
              </tr>

              <tr className="ebitda">
                <td>EBITDA</td>
                <td>{fmtK(ebitda)}</td>
                <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* RIGHT — sidekick stack */}
        <div>
          <div className="panel">
            <h3>Top <em>variances</em> vs Budget</h3>
            <div className="meta">requires plan schema join · Gap 2</div>
            <div className="waterfall">
              <div className="wfr"><div className="lbl">A&amp;G overrun</div><div><div className="bar neg" style={{ width: '96%' }} /></div><div className="num neg">−$7.1k</div></div>
              <div className="wfr"><div className="lbl">F&amp;B beverage</div><div><div className="bar neg" style={{ width: '48%' }} /></div><div className="num neg">−$3.6k</div></div>
              <div className="wfr"><div className="lbl">Rooms labour OT</div><div><div className="bar neg" style={{ width: '28%' }} /></div><div className="num neg">−$2.1k</div></div>
              <div className="wfr"><div className="lbl">Utilities</div><div><div className="bar neg" style={{ width: '14%' }} /></div><div className="num neg">−$0.9k</div></div>
              <div className="wfr"><div className="lbl">Sales &amp; Marketing</div><div><div className="bar pos" style={{ width: '30%' }} /></div><div className="num pos">+$2.3k</div></div>
              <div className="wfr"><div className="lbl">Spa rev mix</div><div><div className="bar pos" style={{ width: '20%' }} /></div><div className="num pos">+$1.5k</div></div>
            </div>
            <div className="meta" style={{ marginTop: 8 }}>Sample magnitudes · live values pending Gap 2 migration.</div>
          </div>

          <div className="panel" style={{ marginTop: 10 }}>
            <h3>13-week <em>cash</em> forecast</h3>
            <div className="meta">Gap 4 — <code>gl.cash_forecast_weekly</code></div>
            <div className="cash-strip">
              <div className="flag">cash dip W34–W36</div>
              <div className="legend">$ position · weekly buckets · sample</div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 10 }}>
            <h3>Margin leak <em>heatmap</em></h3>
            <div className="meta">$k impact · dept × week · sample · Gap 1+2</div>
            <div className="heatmap">
              <div className="hm-lbl">Rooms</div>
              <div className="hm" style={{ background: 'var(--st-good-bg)' }}>0.2</div>
              <div className="hm" style={{ background: 'var(--st-bad-bd)' }}>2.1</div>
              <div className="hm" style={{ background: 'var(--st-warn-bd)' }}>1.0</div>
              <div className="hm" style={{ background: 'var(--st-good-bg)' }}>0.4</div>
              <div className="hm" style={{ background: 'var(--st-good-bg)' }}>0.1</div>
              <div className="hm-lbl">F&amp;B</div>
              <div className="hm" style={{ background: 'var(--st-bad)', color: 'var(--paper-warm)' }}>3.6</div>
              <div className="hm" style={{ background: 'var(--st-warn-bd)' }}>1.2</div>
              <div className="hm" style={{ background: 'var(--st-good-bg)' }}>0.3</div>
              <div className="hm" style={{ background: 'var(--st-warn-bd)' }}>0.9</div>
              <div className="hm" style={{ background: 'var(--st-good-bg)' }}>0.4</div>
              <div className="hm-lbl">Spa</div>
              <div className="hm" style={{ background: 'var(--st-good-bg)' }}>0.4</div>
              <div className="hm" style={{ background: 'var(--st-good-bg)' }}>0.5</div>
              <div className="hm" style={{ background: 'var(--st-warn-bd)' }}>1.0</div>
              <div className="hm" style={{ background: 'var(--st-good-bg)' }}>0.2</div>
              <div className="hm" style={{ background: 'var(--st-good-bg)' }}>0.3</div>
              <div className="hm-lbl">A&amp;G</div>
              <div className="hm" style={{ background: 'var(--st-bad)', color: 'var(--paper-warm)' }}>7.1</div>
              <div className="hm" style={{ background: 'var(--st-warn-bd)' }}>1.1</div>
              <div className="hm" style={{ background: 'var(--st-bad-bd)' }}>2.0</div>
              <div className="hm" style={{ background: 'var(--st-good-bg)' }}>0.2</div>
              <div className="hm" style={{ background: 'var(--st-good-bg)' }}>0.1</div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 10 }}>
            <h3>Variance <em>commentary</em> · draft</h3>
            <div className="meta">Tone: Owner direct · never auto-published · Gap 5 — <code>gl.commentary_drafts</code></div>
            <div className="comm">
              <h4>Headline</h4>
              <p>April closes 21% behind budgeted GOP despite revenue +3.7%. Margin compression sits in A&amp;G and F&amp;B labor — neither is a revenue problem.</p>
              <h4>A&amp;G</h4>
              <p>$7.1k over budget (+47%). USALI Auditor flags GL-6420 as a likely Sales miscoding worth $12.4k YTD. Reclassification queued for 4-eyes (CFO+GM). If approved, GOP % recovers ~0.4 pp YTD.</p>
              <h4>F&amp;B</h4>
              <p>Labor $14.6k vs $11.5k budget (+27%) while revenue lagged 4.4%. Result: 38% labor ratio against the 28–32% norm. Margin Leak Sentinel flagged on day 12; roster optimizer recommendation pending GM approval.</p>
              <h4>Utilities</h4>
              <p>+8.6% vs budget, third consecutive month above LY ratio. Energy audit recommended.</p>
            </div>
            <div className="comm-foot">
              <button type="button" className="btn primary" disabled>Save draft</button>
              <button type="button" className="btn" disabled>Approve &amp; publish to Audit Trail</button>
              <button type="button" className="btn" disabled>Email to owner (queue)</button>
            </div>
          </div>
        </div>
      </div>

      {/* ============== BLOCK 9 — Guardrails banner ============== */}
      <div className="guard">
        <b>Agent guardrails — finance writes are always approval-required.</b>{' '}
        Until the GL→USALI mapping is locked and variance-materiality thresholds are calibrated against
        12 months of close data, every agent-proposed reclassification or commentary publication requires
        explicit human approval. After validation, only Tier-1 actions (defined criteria, ≥85% confidence,
        audit-logged) move to auto. <b>P&amp;L policy: Tier-1 auto disabled — financial reporting always Tier-2.</b>
      </div>

      <div className="legend-foot">
        Block compliance: 1 ✓ · 2 ✓ · 3 ✓ · 4 ✓ (primary 6 + secondary 5) · 5 ✓ · 6 ✓ · 7 ✓ · 8 ✓ · 9 ✓.
        Wired (gl.* schema, 2026-05-02): Total Revenue (<code>pl_section_monthly</code>) · GOP $ / margin / EBITDA (<code>v_usali_house_summary</code>) ·
        Labour % / F&amp;B labour % / A&amp;G $ / channels commission % (<code>mv_usali_pl_monthly</code>) · USALI dept table (<code>v_usali_dept_summary</code>) ·
        mapping gaps (<code>dq_findings</code> DQ-04) · decisions queue (<code>governance.decision_queue</code>).
        Deferred: Flow-through (LY data) · Cash on hand (bank feed) · Top variances vs Budget (<code>gl.budgets</code> not in schema) · 13-week cash · Margin leak heatmap (sample) · Variance commentary draft (<code>gl.commentary_drafts</code>).
        gl_entries-derived tiles render <code>—</code> until <code>qb-deploy/gl_entries_load.sql</code> is run via psql.
      </div>
    </div>
  );
}
