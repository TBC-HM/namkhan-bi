// app/agents/settings/page.tsx
import Link from 'next/link';
import { AGENTS } from '@/lib/agents';

export default function SettingsIndexPage() {
  return (
    <div className="section">
      <div className="section-head">
        <div className="section-title">Agent Settings</div>
        <div className="section-tag">edit prompts, models, triggers</div>
      </div>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Agent</th>
            <th>Model</th>
            <th>Trigger</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {AGENTS.map(a => (
            <tr key={a.id}>
              <td style={{ fontSize: "var(--t-xl)", width: 32 }}>{a.emoji}</td>
              <td className="label">{a.name}</td>
              <td className="muted mono">{a.model}</td>
              <td className="muted">{a.trigger}{a.schedule ? ` · ${a.schedule}` : ''}</td>
              <td><span className={`badge agent-status-${a.status}`}>{a.status}</span></td>
              <td><Link href={`/agents/settings/${a.id}`} className="link-out">Edit ↗</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
