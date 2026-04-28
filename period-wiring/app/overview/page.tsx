// app/overview/page.tsx
// PERIOD-AWARE Overview page.
//
// Pattern every page must follow:
//   1. accept `searchParams` prop
//   2. call `resolvePeriod(searchParams)`
//   3. pass `period` (or {from, to, seg}) to every data fetcher
//   4. label sections with `period.label` so user sees what's applied

import { resolvePeriod } from '@/lib/period';
import {
  getKpis, getDailySeries, getChannelMix, getTodaySnapshot, getDqOpenCount,
} from '@/lib/data';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function fmtUsd(n: number, decimals = 0): string {
  if (!isFinite(n)) return '—';
  return `$${Math.round(n).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
function fmtLak(n: number): string {
  if (!isFinite(n) || n === 0) return '';
  if (n >= 1_000_000) return `₭${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₭${(n/1_000).toFixed(1)}k`;
  return `₭${Math.round(n)}`;
}
function fmtPct(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

function deltaCell(now: number, prev: number, suffix = ''): string {
  if (!isFinite(prev) || prev === 0) return '';
  const d = ((now - prev) / prev) * 100;
  const arrow = d >= 0 ? '▲' : '▼';
  const cls = d >= 0 ? 'delta-up' : 'delta-down';
  return ` ${arrow} ${Math.abs(d).toFixed(1)}%${suffix}`;
}

export default async function OverviewPage({ searchParams }: PageProps) {
  const period = resolvePeriod(searchParams);

  const [kpis, series, channels, snap, dq] = await Promise.all([
    getKpis(period),
    getDailySeries({ ...period, from: addDays(period.to, -90), to: period.to } as any),  // chart always 90d ending at period.to
    getChannelMix(period, 6),
    getTodaySnapshot(),
    getDqOpenCount(),
  ]);

  return (
    <>
      {/* Right Now strip - always shows TODAY, period-independent */}
      <div className="section">
        <div className="section-head">
          <div className="section-title">Right Now</div>
          <div className="section-tag">Live · operations</div>
        </div>
        <div className="kpi-strip cols-4">
          <div className="kpi-tile">
            <div className="kpi-label">In-House</div>
            <div className="kpi-value">{snap.in_house}</div>
            <div className="kpi-deltas">guests on property</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Arriving Today</div>
            <div className="kpi-value">{snap.arriving}</div>
            <div className="kpi-deltas">check-ins today</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Departing Today</div>
            <div className="kpi-value">{snap.departing}</div>
            <div className="kpi-deltas">check-outs today</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">OTB Next 90d</div>
            <div className="kpi-value">{snap.otb_next_90d}</div>
            <div className="kpi-deltas">reservations on books</div>
          </div>
        </div>
      </div>

      {/* PERIOD-AWARE KPI strip */}
      <div className="section">
        <div className="section-head">
          <div className="section-title">Performance · {period.label}</div>
          <div className="section-tag">{period.rangeLabel}</div>
        </div>
        <div className="kpi-strip cols-4">
          <div className="kpi-tile">
            <div className="kpi-label">Occupancy</div>
            <div className="kpi-value">{fmtPct(kpis.occupancy)}</div>
            <div className="kpi-deltas">
              {kpis.compare ? <span className={kpis.occupancy >= kpis.compare.occupancy ? 'delta-up' : 'delta-down'}>
                {(kpis.occupancy - kpis.compare.occupancy >= 0 ? '+' : '')}{((kpis.occupancy - kpis.compare.occupancy) * 100).toFixed(1)}pp {kpis.compareLabel}
              </span> : `${kpis.rooms_sold} rn sold`}
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">ADR</div>
            <div className="kpi-value">{fmtUsd(kpis.adr_usd)}</div>
            <div className="kpi-value-secondary">{fmtLak(kpis.adr_lak)}</div>
            <div className="kpi-deltas">
              {kpis.compare ? deltaCell(kpis.adr_usd, kpis.compare.adr_usd, ` ${kpis.compareLabel}`) : ''}
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">RevPAR</div>
            <div className="kpi-value">{fmtUsd(kpis.revpar_usd)}</div>
            <div className="kpi-value-secondary">{fmtLak(kpis.revpar_lak)}</div>
            <div className="kpi-deltas">
              {kpis.compare ? deltaCell(kpis.revpar_usd, kpis.compare.revpar_usd, ` ${kpis.compareLabel}`) : ''}
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">TRevPAR</div>
            <div className="kpi-value">{fmtUsd(kpis.trevpar_usd)}</div>
            <div className="kpi-value-secondary">{fmtLak(kpis.trevpar_lak)}</div>
            <div className="kpi-deltas">
              {kpis.compare ? deltaCell(kpis.trevpar_usd, kpis.compare.trevpar_usd, ` ${kpis.compareLabel}`) : ''}
            </div>
          </div>
        </div>
        <div className="kpi-strip cols-5">
          <div className="kpi-tile">
            <div className="kpi-label">GOPPAR</div>
            <div className="kpi-value">—</div>
            <div className="kpi-deltas">cost data needed</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Cancel %</div>
            <div className="kpi-value">{fmtPct(kpis.cancel_pct)}</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">No-show %</div>
            <div className="kpi-value">{fmtPct(kpis.noshow_pct, 1)}</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">F&amp;B / Occ Rn</div>
            <div className="kpi-value">{fmtUsd(kpis.fb_per_occ_usd)}</div>
            <div className="kpi-value-secondary">{fmtLak(kpis.fb_per_occ_lak)}</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Spa / Occ Rn</div>
            <div className="kpi-value">{fmtUsd(kpis.spa_per_occ_usd)}</div>
            <div className="kpi-value-secondary">{fmtLak(kpis.spa_per_occ_lak)}</div>
          </div>
        </div>
      </div>

      {/* Channel mix - period-aware */}
      <div className="section">
        <div className="section-head">
          <div className="section-title">Channel Mix · {period.label}</div>
          <div className="section-tag">top sources</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th className="num">Bookings</th>
              <th className="num">Revenue</th>
              <th className="num">% Mix</th>
              <th className="num">ADR</th>
            </tr>
          </thead>
          <tbody>
            {channels.map(c => (
              <tr key={c.source}>
                <td className="label">{c.source}</td>
                <td className="num">{c.bookings}</td>
                <td className="num">{fmtUsd(c.revenue_usd)}</td>
                <td className="num">{(c.pct_mix * 100).toFixed(0)}%</td>
                <td className="num">{fmtUsd(c.adr_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="muted" style={{ fontSize: 11, marginTop: 24, padding: 12, background: 'var(--surface-2)', borderRadius: 4 }}>
        ⓘ DQ Open Issues: {dq} · Period filter: <code>{period.from} → {period.to}</code> · Segment: <code>{period.seg}</code> · Compare: <code>{period.cmp || 'none'}</code>
      </div>
    </>
  );
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
