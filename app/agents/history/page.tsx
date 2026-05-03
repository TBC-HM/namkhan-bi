// app/agents/history/page.tsx
import Link from 'next/link';

// Placeholder mock history rows. When backend exists, replace with fetch from agent_runs table.
const MOCK_HISTORY = [
  { id: 'run_001', agent_id: 'outlook-agent',     agent_name: 'Outlook Agent',     emoji: '📊', when: '2026-04-28 06:01', duration: '4.2s', status: 'complete', cost: 0.18 },
  { id: 'run_002', agent_id: 'pickup-predictor',  agent_name: 'Pickup Predictor',  emoji: '📈', when: '2026-04-28 07:00', duration: '2.8s', status: 'complete', cost: 0.09 },
  { id: 'run_003', agent_id: 'dq-auditor',        agent_name: 'DQ Auditor',        emoji: '🔍', when: '2026-04-28 04:00', duration: '12.4s', status: 'complete', cost: 0.32 },
  { id: 'run_004', agent_id: 'comp-set-watcher',  agent_name: 'Comp Set Watcher',  emoji: '👁️', when: '2026-04-28 05:00', duration: '6.1s', status: 'complete', cost: 0.14 },
  { id: 'run_005', agent_id: 'fb-capture',        agent_name: 'F&B Capture Agent', emoji: '🍽️', when: '2026-04-28 09:00', duration: '3.4s', status: 'complete', cost: 0.11 },
  { id: 'run_006', agent_id: 'pricing-coach',     agent_name: 'Pricing Coach',     emoji: '💰', when: '2026-04-27 14:23', duration: '5.7s', status: 'complete', cost: 0.21 },
  { id: 'run_007', agent_id: 'what-if',           agent_name: 'What-If Simulator', emoji: '🔮', when: '2026-04-27 11:08', duration: '8.2s', status: 'complete', cost: 0.27 },
  { id: 'run_008', agent_id: 'review-responder',  agent_name: 'Review Responder',  emoji: '✍️', when: '2026-04-26 16:45', duration: '2.9s', status: 'complete', cost: 0.08 },
];

export default function HistoryPage() {
  const totalRuns = MOCK_HISTORY.length;
  const totalCost = MOCK_HISTORY.reduce((s, r) => s + r.cost, 0);
  const avgDuration = MOCK_HISTORY.reduce((s, r) => s + parseFloat(r.duration), 0) / totalRuns;

  return (
    <>
      <div className="kpi-strip cols-4">
        <div className="kpi-box">
          <div className="kpi-label">Runs (mock)</div>
          <div className="kpi-value">{totalRuns}</div>
          <div className="kpi-deltas">last 7 days</div>
        </div>
        <div className="kpi-box">
          <div className="kpi-label">Total Cost</div>
          <div className="kpi-value">${totalCost.toFixed(2)}</div>
          <div className="kpi-deltas">across all agents</div>
        </div>
        <div className="kpi-box">
          <div className="kpi-label">Avg Duration</div>
          <div className="kpi-value">{avgDuration.toFixed(1)}s</div>
          <div className="kpi-deltas">per run</div>
        </div>
        <div className="kpi-tile good">
          <div className="kpi-label">Success Rate</div>
          <div className="kpi-value">100%</div>
          <div className="kpi-deltas">no failures</div>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <div className="section-title">Run History (mock data)</div>
          <div className="section-tag">most recent first · click to view output</div>
        </div>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Agent</th>
              <th>When</th>
              <th className="num">Duration</th>
              <th className="num">Cost</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {MOCK_HISTORY.map(r => (
              <tr key={r.id}>
                <td style={{ fontSize: "var(--t-xl)", width: 28 }}>{r.emoji}</td>
                <td className="label">{r.agent_name}</td>
                <td className="muted">{r.when}</td>
                <td className="num">{r.duration}</td>
                <td className="num">${r.cost.toFixed(2)}</td>
                <td><span className="badge agent-status-live">{r.status}</span></td>
                <td>
                  <Link href={`/agents/run/${r.agent_id}`} className="link-out">Re-run ↗</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="muted" style={{ fontSize: "var(--t-base)", lineHeight: 1.6, padding: '16px 0' }}>
        ⓘ History is mock data. When agents are wired to real models, runs will be persisted in <code>public.agent_runs</code> with full output, inputs, and cost tracking.
      </div>
    </>
  );
}
