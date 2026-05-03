// app/sales/b2b/_components/B2bKpiStrip.tsx
// Persistent KPI strip across all B2B/DMC sub-tabs.
// WIRED to real LPA reservations + dmc_contracts.

import { getDmcKpisLive } from '@/lib/dmc';

const TONE_CLS: Record<string, string> = {
  flat: '',
  up:   'pos',
  warn: 'warn',
  bad:  'neg',
};

export default async function B2bKpiStrip() {
  const k = await getDmcKpisLive();

  const kpis = [
    { scope: 'Active LPAs',         value: String(k.activeContracts),                          sub: `of ${k.contractCount} contracts`,        tone: 'flat' as const },
    { scope: 'Expiring 90d',        value: String(k.expiringIn90),                             sub: 'auto-alerts armed',                       tone: k.expiringIn90 > 0 ? 'warn' as const : 'flat' as const },
    { scope: 'LPA reservations',    value: String(k.reservationCount),                         sub: `${k.totalRns} room nights`,               tone: 'flat' as const },
    { scope: 'Mapped reservations', value: `${k.matchedReservations}/${k.reservationCount}`,    sub: `${k.unmatchedSources} unmapped sources`,  tone: k.unmatchedSources > 0 ? 'warn' as const : 'up' as const },
    { scope: 'LPA revenue',         value: `USD ${(k.totalRevenue / 1000).toFixed(1)}k`,        sub: 'all-time on LPA rate plan',               tone: 'up' as const },
    { scope: 'Avg booking value',   value: k.reservationCount > 0 ? `USD ${(k.totalRevenue / k.reservationCount).toFixed(0)}` : '—', sub: `${k.totalRns > 0 ? `USD ${(k.totalRevenue / k.totalRns).toFixed(0)} ADR` : 'no data'}`, tone: 'flat' as const },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
        gap: 10,
        marginBottom: 14,
      }}
    >
      {kpis.map((kp) => (
        <div key={kp.scope} className="kpi-tile" data-tooltip={`${kp.scope} · ${kp.sub}`}>
          <div className="kpi-tile-scope">{kp.scope}</div>
          <div className={`kpi-tile-value ${TONE_CLS[kp.tone] ?? ''}`.trim()}>{kp.value}</div>
          <div className="kpi-tile-sub">{kp.sub}</div>
        </div>
      ))}
    </div>
  );
}
