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
  getLyTotalRevenue, getLyByDept,
} from '../_data';
import { priorPeriod, type PeriodWindow } from '@/lib/supabase-gl';
import PageHeader from '@/components/layout/PageHeader';

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

  // LY (last-year) data from gl.pnl_snapshot — used to populate the LY column
  // in the USALI grid + flow-through KPI. Only fetches once cur is known.
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

  // LY fetch (parallel with rest is overkill — happens after we know `cur`)
  const [lyTotalRev, lyByDept] = await Promise.all([
    getLyTotalRevenue(cur),
    getLyByDept(cur),
  ]);
  const lyRevBySubcat = new Map(lyByDept.map(r => [r.usali_subcategory, r.revenue]));
  const revVsLyPct = (lyTotalRev != null && lyTotalRev !== 0)
    ? ((totalRev - lyTotalRev) / lyTotalRev) * 100
    : null;
  // Flow-through = ΔGOP / ΔRevenue. We have curGop but no LY GOP, so we
  // approximate flow as the year-over-year change in revenue retained as
  // current-period GOP — only meaningful when LY rev > 0 and gop is set.
  // True flow-through needs LY GOP — surfaced as `xx` when not available.

  const months = Array.from(new Set(plSections.map(r => r.period_yyyymm))).sort().reverse();
  const latestMonth = months[0] || cur;
  const monthLabel = latestMonth ? new Date(latestMonth + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'Apr 2026';

  return (
    <div className="pnl-page">
      {/* ============== BLOCK 1 — Title + breadcrumb ============== */}
      <PageHeader
        pillar="Finance"
        tab="P&L"
        title={<>Profit &amp; loss · where the <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>margin</em> lives.</>}
        lede="Where to act this week to defend GOP. USALI 11th ed."
      />

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
          <div className={'kpi ' + (revVsLyPct == null ? 'dim' : '')}>
            <div className="scope">Flow</div>
            <div className="val">{revVsLyPct == null ? 'xx' : fmtPctV(revVsLyPct)}</div>
            <div className="deltas"><span className="neu">{revVsLyPct == null ? 'no LY data this month' : 'rev vs same month LY · pnl_snapshot'}</span></div>
            <div className="lbl">Revenue vs LY</div>
            {revVsLyPct == null && <span className="needs" title="gl.pnl_snapshot has no row for this period">no LY row</span>}
          </div>
          <div className={'kpi ' + (ebitda == null ? 'dim' : '')}>
            <div className="scope">P&amp;L</div>
            <div className="val">{fmtK(ebitda)}</div>
            <div className="deltas"><span className="neu">{ebitda == null ? 'awaiting GOP$' : 'gop − depr − interest − tax'}</span></div>
            <div className="lbl">EBITDA</div>
          </div>
          <div className="kpi dim">
            <div className="scope">Cash</div>
            <div className="val">xx</div>
            <div className="deltas"><span className="neu">bank feed not connected</span></div>
            <div className="lbl">Cash on hand</div>
            <span className="needs" title="Gap 4 — gl.cash_forecast_weekly empty">not wired</span>
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
        <span className="heading"><span className="dot" /> Finance agents <span className="new-badge" title="agent runtime not connected">not wired</span></span>
        <span className="chip" title="agents.runs / agents.findings tables empty"><span className="dot idle" />P&amp;L Detector · xx findings</span>
        <span className="chip" title="agents.runs / commentary_drafts empty"><span className="dot idle" />Variance Composer · xx drafts</span>
        <span className="chip" title="agents.runs / je_proposals empty"><span className="dot idle" />Controller Agent · xx JEs</span>
        <span className="chip" title="agents.runs / rfq_drafts empty"><span className="dot idle" />Procurement Agent · xx RFQs</span>
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
            { impact: '+$xx', title: 'Renegotiate beverage supplier (placeholder — Procurement Agent will populate)', meta: 'governance.decision_queue is empty · template shown' },
            { impact: '+$xx', title: 'Cut low-utilisation shift (placeholder — RosterAgent will populate)', meta: 'governance.decision_queue is empty · template shown' },
            { impact: '+$xx', title: 'Approve revised energy mix (placeholder — Maintenance Agent will populate)', meta: 'governance.decision_queue is empty · template shown' },
            { impact: '+$xx', title: 'Reclassify accruals (placeholder — Controller Agent will populate)', meta: 'governance.decision_queue is empty · template shown', stamp: 'writes GL · 4-eyes req' },
            { impact: '+$xx', title: 'Hire FTE (placeholder — manual review)', meta: 'governance.decision_queue is empty · template shown' },
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
      <div style={{ marginTop: 6, fontSize: "var(--t-sm)", color: 'var(--ink-mute, #8a8170)' }}>
        {decisions.length > 0
          ? <>Live queue from <code>governance.decision_queue</code> · {decisions.length} pending. Action handlers (Approve/Snooze) require server actions wiring — defer to Phase 3.</>
          : <>No pending items in <code>governance.decision_queue</code> · sample shown. Action handlers (Approve/Snooze) require server actions wiring — defer to Phase 3.</>
        }
      </div>

      {/* ============== BLOCK 7 — Tactical alerts ============== */}
      <div className="section-head" style={{ marginTop: 24 }}>
        <h3>Tactical <em>alerts</em> <span className="needs" style={{ marginLeft: 8 }}>not wired</span></h3>
        <span className="meta">No detector outputs in <code>governance.dq_findings</code> yet. Cards below are placeholders showing what will render once detectors run.</span>
      </div>
      <div className="alerts" style={{ opacity: .55 }}>
        <div className="alert hi">
          <h4>F&amp;B cost % xx% (target xx%) <span className="imp">−$xx / mo</span></h4>
          <div className="dims">dept=F&amp;B × line=xx × vendor=xx · breach xx pp</div>
          <div className="reason">Detector pending — needs gl_entries × class join + materiality threshold check.</div>
          <div className="tactic"><b>Composer:</b> 1) RFQ to alt suppliers · 2) menu remix · 3) renegotiate volume tier (template).</div>
          <div className="handoffs">
            <button type="button" className="btn" disabled>→ Procurement Agent <span className="stamp">approval req</span></button>
            <button type="button" className="btn" disabled>→ F&amp;B head</button>
          </div>
        </div>
        <div className="alert med">
          <h4>Rooms labour HpOR xx (target xx) <span className="imp">−$xx / mo</span></h4>
          <div className="dims">dept=Rooms × dow=xx × shift=xx · xx σ breach</div>
          <div className="reason">Detector pending — needs roster × occupancy join.</div>
          <div className="tactic"><b>Composer:</b> consolidate shifts on low-occ days (template).</div>
          <div className="handoffs">
            <button type="button" className="btn" disabled>→ RosterAgent (Operations) <span className="stamp">approval req</span></button>
          </div>
        </div>
        <div className="alert med">
          <h4>Energy ±xx% MoM, no occ change <span className="imp">−$xx / mo</span></h4>
          <div className="dims">dept=POM × line=utilities × period=xx · xx σ</div>
          <div className="reason">Detector pending — needs utility meter feed.</div>
          <div className="tactic"><b>Composer:</b> dispatch maintenance check; recalibrate BMS schedule (template).</div>
          <div className="handoffs">
            <button type="button" className="btn" disabled>→ Maintenance Agent <span className="stamp">approval req</span></button>
          </div>
        </div>
        <div className="alert low">
          <h4>Spa products write-off xx% (target xx%) <span className="imp">−$xx / mo</span></h4>
          <div className="dims">dept=Spa × line=inventory write-off · audit-hygiene</div>
          <div className="reason">Detector pending — needs inv.spa_products + write-off log.</div>
          <div className="tactic"><b>Composer:</b> discount combo · staff training (template).</div>
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
                    <td title="needs gl.budgets table">xx</td>
                    <td title="needs LY breakdown by dept">xx</td>
                    <td title="needs gl.budgets table">xx</td>
                    <td title="needs prior-mo dept breakdown">xx</td>
                    <td title="needs gl.budgets + LY">xx</td>
                  </tr>
                ));
              })()}
              <tr className="subtotal">
                <td>Total Revenue</td>
                <td>{fmtK(totalRev)}</td>
                <td title="needs gl.budgets table">xx</td>
                <td>{lyTotalRev != null ? fmtK(lyTotalRev) : <span title="no pnl_snapshot row for this period">xx</span>}</td>
                <td title="needs gl.budgets table">xx</td>
                <td className={revVsPriorPct >= 0 ? 'var-green' : 'var-amber'}>{fmtPctV(revVsPriorPct)}</td>
                <td title="needs gl.budgets table">xx</td>
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
                    <td title="needs gl.budgets table">xx</td>
                    <td title="needs LY breakdown by dept">xx</td>
                    <td title="needs gl.budgets table">xx</td>
                    <td title="needs prior-mo dept breakdown">xx</td>
                    <td title="needs gl.budgets + LY">xx</td>
                  </tr>
                ));
              })()}

              <tr className="gop">
                <td>Departmental Profit</td>
                <td>{fmtK(houseCur?.total_dept_profit ?? null)}</td>
                <td title="needs gl.budgets table">xx</td>
                <td title="needs LY GOP">xx</td>
                <td title="needs gl.budgets table">xx</td>
                <td title="needs prior-mo">xx</td>
                <td title="needs gl.budgets + LY">xx</td>
              </tr>

              <tr className="section"><td colSpan={7}>Undistributed Operating Expenses (live from <code>gl.v_usali_house_summary</code>)</td></tr>
              <tr>
                <td>A&amp;G</td>
                <td>{fmtK(houseCur?.ag_total ?? null)}</td>
                <td title="needs gl.budgets table">xx</td><td title="needs LY breakdown by dept">xx</td><td title="needs gl.budgets table">xx</td><td title="needs prior-mo dept breakdown">xx</td><td title="needs gl.budgets + LY">xx</td>
              </tr>
              <tr>
                <td>Sales &amp; Marketing</td>
                <td>{fmtK(houseCur?.sales_marketing ?? null)}</td>
                <td title="needs gl.budgets table">xx</td><td title="needs LY breakdown by dept">xx</td><td title="needs gl.budgets table">xx</td><td title="needs prior-mo dept breakdown">xx</td><td title="needs gl.budgets + LY">xx</td>
              </tr>
              <tr>
                <td>POM</td>
                <td>{fmtK(houseCur?.pom ?? null)}</td>
                <td title="needs gl.budgets table">xx</td><td title="needs LY breakdown by dept">xx</td><td title="needs gl.budgets table">xx</td><td title="needs prior-mo dept breakdown">xx</td><td title="needs gl.budgets + LY">xx</td>
              </tr>
              <tr>
                <td>Utilities</td>
                <td>{fmtK(houseCur?.utilities ?? null)}</td>
                <td title="needs gl.budgets table">xx</td><td title="needs LY breakdown by dept">xx</td><td title="needs gl.budgets table">xx</td><td title="needs prior-mo dept breakdown">xx</td><td title="needs gl.budgets + LY">xx</td>
              </tr>
              <tr>
                <td>Mgmt Fees</td>
                <td>{fmtK(houseCur?.mgmt_fees ?? null)}</td>
                <td title="needs gl.budgets table">xx</td><td title="needs LY breakdown by dept">xx</td><td title="needs gl.budgets table">xx</td><td title="needs prior-mo dept breakdown">xx</td><td title="needs gl.budgets + LY">xx</td>
              </tr>

              <tr className="gop">
                <td>GOP after Undistributed</td>
                <td>{fmtK(houseCur?.gop ?? null)}</td>
                <td title="needs gl.budgets table">xx</td><td title="needs LY breakdown by dept">xx</td><td title="needs gl.budgets table">xx</td><td title="needs prior-mo dept breakdown">xx</td><td title="needs gl.budgets + LY">xx</td>
              </tr>

              <tr className="ebitda">
                <td>EBITDA</td>
                <td>{fmtK(ebitda)}</td>
                <td title="needs gl.budgets table">xx</td><td title="needs LY breakdown by dept">xx</td><td title="needs gl.budgets table">xx</td><td title="needs prior-mo dept breakdown">xx</td><td title="needs gl.budgets + LY">xx</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* RIGHT — sidekick stack */}
        <div>
          <div className="panel">
            <h3>Top <em>variances</em> vs Budget <span className="needs" style={{ marginLeft: 8 }}>not wired</span></h3>
            <div className="meta">no <code>gl.budgets</code> table — every value below is a placeholder until owner uploads an annual budget.</div>
            <div className="waterfall">
              <div className="wfr"><div className="lbl">A&amp;G overrun</div><div><div className="bar neg" style={{ width: '60%', opacity: .25 }} /></div><div className="num neg">xx</div></div>
              <div className="wfr"><div className="lbl">F&amp;B beverage</div><div><div className="bar neg" style={{ width: '60%', opacity: .25 }} /></div><div className="num neg">xx</div></div>
              <div className="wfr"><div className="lbl">Rooms labour OT</div><div><div className="bar neg" style={{ width: '60%', opacity: .25 }} /></div><div className="num neg">xx</div></div>
              <div className="wfr"><div className="lbl">Utilities</div><div><div className="bar neg" style={{ width: '60%', opacity: .25 }} /></div><div className="num neg">xx</div></div>
              <div className="wfr"><div className="lbl">Sales &amp; Marketing</div><div><div className="bar pos" style={{ width: '60%', opacity: .25 }} /></div><div className="num pos">xx</div></div>
              <div className="wfr"><div className="lbl">Spa rev mix</div><div><div className="bar pos" style={{ width: '60%', opacity: .25 }} /></div><div className="num pos">xx</div></div>
            </div>
            <div className="meta" style={{ marginTop: 8 }}>Source: <code>gl.budgets</code> (does not exist yet) joined to <code>v_usali_house_summary</code>.</div>
          </div>

          <div className="panel" style={{ marginTop: 10 }}>
            <h3>13-week <em>cash</em> forecast <span className="needs" style={{ marginLeft: 8 }}>not wired</span></h3>
            <div className="meta"><code>gl.cash_forecast_weekly</code> exists but has 0 rows — needs bank feed import.</div>
            <div className="cash-strip">
              <div className="flag">cash dip Wxx–Wxx</div>
              <div className="legend">$ position · weekly buckets · xx (placeholder)</div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 10 }}>
            <h3>Margin leak <em>heatmap</em> <span className="needs" style={{ marginLeft: 8 }}>not wired</span></h3>
            <div className="meta">$k impact · dept × week · needs <code>governance.dq_findings</code> filtered by detector type. Cells below are placeholders.</div>
            <div className="heatmap">
              <div className="hm-lbl">Rooms</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
              <div className="hm-lbl">F&amp;B</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
              <div className="hm-lbl">Spa</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
              <div className="hm-lbl">A&amp;G</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
              <div className="hm" style={{ background: 'var(--surf-2, #f5f1e7)', opacity: .35 }}>xx</div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 10 }}>
            <h3>Variance <em>commentary</em> · draft <span className="needs" style={{ marginLeft: 8 }}>not wired</span></h3>
            <div className="meta"><code>gl.commentary_drafts</code> exists but has 0 rows · LLM composer not yet scheduled. Body below is a placeholder template.</div>
            <div className="comm" style={{ opacity: .45 }}>
              <h4>Headline</h4>
              <p>{monthLabel} closes xx% behind budgeted GOP despite revenue ±xx%. Margin compression sits in xx — placeholder until composer runs.</p>
              <h4>A&amp;G</h4>
              <p>$xx over budget (xx%). Auditor flags GL-xxxx as a likely miscoding worth $xx YTD. Reclassification queued for 4-eyes (CFO+GM). If approved, GOP % recovers ~xx pp YTD.</p>
              <h4>F&amp;B</h4>
              <p>Labor $xx vs $xx budget (xx%) while revenue lagged xx%. Result: xx% labor ratio against the 28–32% norm. Margin Leak Sentinel flagged on day xx; roster optimizer recommendation pending GM approval.</p>
              <h4>Utilities</h4>
              <p>±xx% vs budget, xx consecutive month above LY ratio. Energy audit recommended.</p>
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
        <div style={{ marginBottom: 8 }}><b>WIRED (real numbers, no <code>xx</code>):</b></div>
        <div style={{ marginBottom: 12 }}>
          Total Revenue · prior-mo Δ · Revenue vs LY (<code>pl_section_monthly</code> + <code>pnl_snapshot</code>) ·
          GOP $ / GOP margin / EBITDA (<code>v_usali_house_summary</code>) ·
          Labour % / F&amp;B labour % / A&amp;G $ / Distribution cost % (<code>mv_usali_pl_monthly</code>) ·
          USALI dept Actual + LY total (<code>v_usali_dept_summary</code>, <code>pnl_snapshot</code>) ·
          USALI mapping gaps (<code>dq_findings</code> DQ-04) ·
          Decisions queue (<code>governance.decision_queue</code> if present, else placeholder).
        </div>
        <div style={{ marginBottom: 8 }}><b>NOT WIRED (rendered as <code>xx</code>):</b></div>
        <div>
          Cash on hand (no bank feed) ·
          USALI Budget / Δ Bgt / Flow columns (no <code>gl.budgets</code> table) ·
          Per-dept LY breakdown (LY snapshot lacks class join) ·
          Top variances vs Budget waterfall · 13-week cash forecast · Margin leak heatmap · Variance commentary · Tactical alerts (all need detectors + budgets).
          Account mapping fixes for <code>not_specified</code> entries: edit at <a href="/finance/mapping" style={{ color: 'var(--brass)', textDecoration: 'underline' }}>/finance/mapping</a>.
        </div>
      </div>
    </div>
  );
}
