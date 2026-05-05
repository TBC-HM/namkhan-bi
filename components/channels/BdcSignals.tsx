// components/channels/BdcSignals.tsx — Signals tab. Reads governance.decision_queue
// rows scoped to Booking.com / BDC. Empty state explains the agent loop.

import { supabase } from '@/lib/supabase';

interface Signal {
  decision_id: string;
  source_agent: string;
  scope_section: string | null;
  title: string;
  impact_usd: number | null;
  confidence_pct: number | null;
  velocity: string | null;
  status: string | null;
  created_at: string;
  expires_at: string | null;
}

async function getSignals(): Promise<Signal[]> {
  const { data, error } = await supabase
    .from('v_decisions_booking_com')
    .select('*')
    .limit(50);
  if (error) {
    console.error('getSignals error', error);
    return [];
  }
  return (data ?? []) as Signal[];
}

const fmtUsd = (n: number | null | undefined) => {
  if (n == null) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
};

export default async function BdcSignals() {
  const signals = await getSignals();
  return (
    <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 'var(--t-xl)' }}>BDC agent signals</h2>
        <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>{signals.length} open</span>
      </div>
      {signals.length === 0 ? (
        <div style={{ padding: '14px', background: 'var(--paper)', border: '1px dashed var(--line-soft)', borderRadius: 6, color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginBottom: 6 }}>No agent signals yet</div>
          BDC agents (geo marketing, rate strategy, Genius dependency, pace pickup, funnel) write actionable plays to <code>governance.decision_queue</code>. They activate once 3+ snapshots exist for trend-detection.
          <br />Until then, the <strong>What needs attention</strong> panel on the Now tab is the live signal source — it runs the rules synchronously on every page load.
        </div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Title</th>
              <th>Agent</th>
              <th className="num">Impact</th>
              <th className="num">Confidence</th>
              <th>Velocity</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => (
              <tr key={s.decision_id}>
                <td className="lbl"><strong>{s.title}</strong></td>
                <td>{s.source_agent}</td>
                <td className="num">{fmtUsd(s.impact_usd)}</td>
                <td className="num">{s.confidence_pct != null ? `${s.confidence_pct.toFixed(0)}%` : '—'}</td>
                <td>{s.velocity ?? '—'}</td>
                <td>{s.status ?? '—'}</td>
                <td style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{new Date(s.created_at).toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
