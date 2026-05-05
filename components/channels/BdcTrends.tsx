// components/channels/BdcTrends.tsx — Trend tab for /revenue/channels/Booking.com?tab=trend
// Reads from public.v_bdc_*_history. With one snapshot, renders empty-state
// guidance. Once 3+ snapshots exist, fills with sparklines / line charts.

import { supabase } from '@/lib/supabase';

interface SnapshotMeta {
  snapshot_date: string;
  ranking: number;
  country_rows: number;
  genius_rows: number;
  pace_rows: number;
}

async function getSnapshotMeta(): Promise<SnapshotMeta[]> {
  const { data, error } = await supabase
    .from('ota_uploads')
    .select('snapshot_date, file_kind')
    .eq('ota_source', 'Booking.com')
    .order('snapshot_date', { ascending: false });
  if (error || !data) return [];
  // Group by snapshot_date
  const grouped = new Map<string, Set<string>>();
  for (const r of data as any[]) {
    const d = String(r.snapshot_date);
    if (!grouped.has(d)) grouped.set(d, new Set());
    grouped.get(d)!.add(String(r.file_kind));
  }
  return Array.from(grouped.entries()).map(([d, kinds]) => ({
    snapshot_date: d,
    ranking: kinds.has('ranking') ? 1 : 0,
    country_rows: kinds.has('booker_insights') ? 1 : 0,
    genius_rows: kinds.has('genius_timeline') ? 1 : 0,
    pace_rows: kinds.has('pace_monthly') ? 1 : 0,
  }));
}

export default async function BdcTrends() {
  const snapshots = await getSnapshotMeta();
  const haveTrendData = snapshots.length >= 3;

  return (
    <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 'var(--t-xl)' }}>BDC trend history</h2>
        <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>{snapshots.length} snapshot{snapshots.length === 1 ? '' : 's'} loaded</span>
      </div>

      {!haveTrendData && (
        <div style={{ padding: '16px', background: 'var(--paper)', border: '1px dashed var(--line-soft)', borderRadius: 6, color: 'var(--ink-mute)', fontSize: 'var(--t-sm)', marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginBottom: 6 }}>
            Need 3+ snapshots to show trends
          </div>
          We have <strong>{snapshots.length}</strong> snapshot{snapshots.length === 1 ? '' : 's'} loaded. Trends, drift detection, and conversion-over-time charts populate once you upload 12 months of historical Booker insights, Genius timeline, Pace, and Ranking exports. Path: <code>/settings/uploads/booking-com</code> (coming).
        </div>
      )}

      <div>
        <h3 style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginBottom: 8 }}>
          Snapshot history
        </h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>Snapshot date</th>
              <th className="num">Booker insights</th>
              <th className="num">Genius timeline</th>
              <th className="num">Pace</th>
              <th className="num">Ranking</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '12px', color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>No uploads recorded.</td></tr>
            ) : snapshots.map((s) => (
              <tr key={s.snapshot_date}>
                <td className="lbl"><strong>{s.snapshot_date}</strong></td>
                <td className="num">{s.country_rows ? '✓' : '—'}</td>
                <td className="num">{s.genius_rows ? '✓' : '—'}</td>
                <td className="num">{s.pace_rows ? '✓' : '—'}</td>
                <td className="num">{s.ranking ? '✓' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
