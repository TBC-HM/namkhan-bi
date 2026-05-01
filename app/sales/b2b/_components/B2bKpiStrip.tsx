// app/sales/b2b/_components/B2bKpiStrip.tsx
// Persistent KPI strip across all B2B/DMC sub-tabs.
// WIRED to real LPA reservations + dmc_contracts.

import { getDmcKpisLive } from '@/lib/dmc';

const TONE_COLOR: Record<string, string> = {
  flat: '#4a4538',
  up:   '#1f6f43',
  warn: '#a17a4f',
  bad:  '#a83232',
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
        <div
          key={kp.scope}
          style={{
            background: '#fff',
            border: '1px solid #e6dfc9',
            borderRadius: 8,
            padding: '12px 14px',
            minHeight: 86,
          }}
        >
          <div style={{ fontSize: 10.5, color: '#8a8170', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {kp.scope}
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 500, color: TONE_COLOR[kp.tone] ?? '#4a4538', margin: '2px 0' }}>
            {kp.value}
          </div>
          <div style={{ fontSize: 11, color: '#8a8170' }}>{kp.sub}</div>
        </div>
      ))}
    </div>
  );
}
