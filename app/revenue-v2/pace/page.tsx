// app/revenue-v2/pace/page.tsx
import { createClient } from '@supabase/supabase-js';
import '../styles.css';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface KpiRow {
  stay_date: string;
  rooms_sold: number | null;
  adr_usd: number | null;
  occupancy_pct: number | null;
  revpar_usd: number | null;
}

interface PaceRow {
  stay_date: string;
  otb_rooms: number | null;
  otb_adr: number | null;
  stly_rooms: number | null;
  stly_adr: number | null;
}

function fmt(n: number | null | undefined, prefix = ''): string {
  if (n == null) return '—';
  return `${prefix}${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function delta(a: number | null | undefined, b: number | null | undefined): string {
  if (a == null || b == null) return '—';
  const d = a - b;
  const sign = d >= 0 ? '+' : '−';
  return `${sign}${Math.abs(d).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default async function Page() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Primary: try f_pace_stly_snapshot RPC for OTB vs STLY pace curve
  const today = new Date();
  const fromDate = today.toISOString().slice(0, 10);
  const toDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  let paceRows: PaceRow[] = [];
  let paceSource: 'snapshot' | 'actuals_proxy' | 'kpi_fallback' = 'kpi_fallback';

  const { data: snapshotData, error: snapshotError } = await supabase.rpc(
    'f_pace_stly_snapshot',
    { p_from: fromDate, p_to: toDate }
  );

  if (!snapshotError && snapshotData && snapshotData.length > 0) {
    paceRows = snapshotData as PaceRow[];
    paceSource = 'snapshot';
  }

  // Fallback: mv_kpi_daily for recent 30-day trailing actuals
  const { data: kpiData } = await supabase
    .from('mv_kpi_daily')
    .select('stay_date, rooms_sold, adr_usd, occupancy_pct, revpar_usd')
    .order('stay_date', { ascending: false })
    .limit(30);

  const kpiRows: KpiRow[] = (kpiData ?? []) as KpiRow[];

  // Aggregate KPI summary from trailing actuals
  const totalRooms = kpiRows.reduce((s, r) => s + (r.rooms_sold ?? 0), 0);
  const avgAdr =
    kpiRows.length > 0
      ? kpiRows.reduce((s, r) => s + (r.adr_usd ?? 0), 0) / kpiRows.length
      : null;
  const avgOcc =
    kpiRows.length > 0
      ? kpiRows.reduce((s, r) => s + (r.occupancy_pct ?? 0), 0) / kpiRows.length
      : null;
  const avgRevpar =
    kpiRows.length > 0
      ? kpiRows.reduce((s, r) => s + (r.revpar_usd ?? 0), 0) / kpiRows.length
      : null;

  const sourceLabel =
    paceSource === 'snapshot'
      ? 'f_pace_stly_snapshot · true OTB STLY'
      : 'mv_kpi_daily · last-year actuals proxy (snapshot accumulating since 2026-05-03 · auto-switches once data covers the lead-time window)';

  return (
    <main className="rmv2">
      {/* Page header */}
      <div className="rmv2-page-header">
        <div>
          <h1 className="rmv2-hero-title">Booking Pace</h1>
          <p className="rmv2-hero-sub">
            OTB vs STLY · pickup velocity · 90-day forward window
          </p>
        </div>
        <nav className="rmv2-tab-nav">
          <a href="/revenue-v2" className="rmv2-tab">Overview</a>
          <a href="/revenue-v2/pulse" className="rmv2-tab">Pulse</a>
          <a href="/revenue-v2/pace" className="rmv2-tab rmv2-tab-active">Pace</a>
          <a href="/revenue-v2/channels" className="rmv2-tab">Channels</a>
          <a href="/revenue-v2/rateplans" className="rmv2-tab">Rate Plans</a>
          <a href="/revenue-v2/pricing" className="rmv2-tab">Pricing</a>
          <a href="/revenue-v2/compset" className="rmv2-tab">Compset</a>
          <a href="/revenue-v2/parity" className="rmv2-tab">Parity</a>
          <a href="/revenue-v2/agents" className="rmv2-tab">Agents</a>
        </nav>
      </div>

      {/* STLY source lede */}
      <div className="rmv2-lede-banner">
        STLY source: <code>{sourceLabel}</code>
      </div>

      {/* KPI strip — trailing 30-day actuals */}
      <div className="rmv2-kpi-grid">
        <div className="rmv2-kpi-box">
          <span className="rmv2-kpi-label">Rooms Sold (30d)</span>
          <span className="rmv2-kpi-value">{fmt(totalRooms)}</span>
        </div>
        <div className="rmv2-kpi-box">
          <span className="rmv2-kpi-label">Avg ADR (30d)</span>
          <span className="rmv2-kpi-value">{fmt(avgAdr, '$')}</span>
        </div>
        <div className="rmv2-kpi-box">
          <span className="rmv2-kpi-label">Avg Occupancy (30d)</span>
          <span className="rmv2-kpi-value">{fmtPct(avgOcc)}</span>
        </div>
        <div className="rmv2-kpi-box">
          <span className="rmv2-kpi-label">Avg RevPAR (30d)</span>
          <span className="rmv2-kpi-value">{fmt(avgRevpar, '$')}</span>
        </div>
      </div>

      {/* Pace curve table — OTB vs STLY */}
      {paceRows.length > 0 ? (
        <section className="rmv2-section">
          <h2 className="rmv2-section-title">90-Day Pace Curve — OTB vs STLY</h2>
          <div className="rmv2-table-wrap">
            <table className="rmv2-table">
              <thead>
                <tr>
                  <th>Stay Date</th>
                  <th>OTB Rooms</th>
                  <th>STLY Rooms</th>
                  <th>Δ Rooms</th>
                  <th>OTB ADR</th>
                  <th>STLY ADR</th>
                  <th>Δ ADR</th>
                </tr>
              </thead>
              <tbody>
                {paceRows.slice(0, 90).map((r) => (
                  <tr key={r.stay_date}>
                    <td>{r.stay_date}</td>
                    <td>{fmt(r.otb_rooms)}</td>
                    <td>{fmt(r.stly_rooms)}</td>
                    <td>{delta(r.otb_rooms, r.stly_rooms)}</td>
                    <td>{fmt(r.otb_adr, '$')}</td>
                    <td>{fmt(r.stly_adr, '$')}</td>
                    <td>{delta(r.otb_adr, r.stly_adr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        /* Trailing actuals table when pace snapshot not yet populated */
        <section className="rmv2-section">
          <h2 className="rmv2-section-title">Trailing 30-Day Actuals (pace snapshot accumulating)</h2>
          <div className="rmv2-table-wrap">
            <table className="rmv2-table">
              <thead>
                <tr>
                  <th>Stay Date</th>
                  <th>Rooms Sold</th>
                  <th>ADR</th>
                  <th>Occupancy</th>
                  <th>RevPAR</th>
                </tr>
              </thead>
              <tbody>
                {kpiRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center' }}>—</td>
                  </tr>
                ) : (
                  kpiRows.map((r) => (
                    <tr key={r.stay_date}>
                      <td>{r.stay_date}</td>
                      <td>{fmt(r.rooms_sold)}</td>
                      <td>{fmt(r.adr_usd, '$')}</td>
                      <td>{fmtPct(r.occupancy_pct)}</td>
                      <td>{fmt(r.revpar_usd, '$')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Pickup velocity callout */}
      <section className="rmv2-section">
        <h2 className="rmv2-section-title">Pickup Velocity</h2>
        <p className="rmv2-body-text">
          Pickup velocity (rooms booked in the last 7 days for each future stay date) will surface
          here once <code>mv_pace_daily</code> is promoted to the PostgREST allowlist.
          Current fallback: trailing 30-day actuals from <code>mv_kpi_daily</code> above.
        </p>
      </section>
    </main>
  );
}
