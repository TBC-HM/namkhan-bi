// app/agents/run/page.tsx
import Link from 'next/link';
import { AGENTS, CATEGORY_LABELS } from '@/lib/agents';

export default function RunPickerPage() {
  return (
    <>
      <div className="section">
        <div className="section-head">
          <div className="section-title">Fire an Agent</div>
          <div className="section-tag">pick one to configure & run</div>
        </div>
        <div className="agents-picker-grid">
          {AGENTS.map(a => (
            <Link key={a.id} href={`/agents/run/${a.id}`} className="agent-picker-card">
              <div className="agent-picker-emoji">{a.emoji}</div>
              <div className="agent-picker-body">
                <div className="agent-picker-name">{a.name}</div>
                <div className="agent-picker-desc">{a.oneLiner}</div>
                <div className="agent-picker-cat muted">{CATEGORY_LABELS[a.category]}</div>
              </div>
              <div className="agent-picker-arrow">→</div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
