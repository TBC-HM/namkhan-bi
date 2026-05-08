// Bisect — KpiBox only.
import KpiBox from '@/components/kpi/KpiBox';

export default function Sample1() {
  return (
    <div style={{ padding: 40, color: '#e9e1ce', background: '#0a0a0a', minHeight: '100vh' }}>
      <h1>SMOKE: sample 1 + KpiBox</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KpiBox value={78}   unit="pct" label="Occupancy" delta={{ value: 4.2, unit: 'pp', period: 'STLY' }} />
        <KpiBox value={184}  unit="usd" label="ADR"       delta={{ value: 6,   unit: 'usd', period: 'STLY' }} />
        <KpiBox value={143}  unit="usd" label="RevPAR"    delta={{ value: 11,  unit: 'usd', period: 'LY' }} />
        <KpiBox value={4624} unit="usd" label="Revenue"   delta={{ value: 8.1, unit: 'pct', period: 'STLY' }} />
      </div>
    </div>
  );
}
