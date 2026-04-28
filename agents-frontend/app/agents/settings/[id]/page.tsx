// app/agents/settings/[id]/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAgent, AGENTS } from '@/lib/agents';
import AgentSettingsEditor from '@/components/agents/AgentSettingsEditor';

export function generateStaticParams() {
  return AGENTS.map(a => ({ id: a.id }));
}

export default function AgentSettingsPage({ params }: { params: { id: string } }) {
  const agent = getAgent(params.id);
  if (!agent) notFound();

  return (
    <>
      <div className="agent-detail-head">
        <div>
          <div className="agent-detail-eyebrow">
            <Link href="/agents/settings" className="link-out">← Back to settings</Link>
          </div>
          <div className="agent-detail-title-row">
            <span className="agent-detail-emoji">{agent.emoji}</span>
            <h1 className="agent-detail-title">{agent.name} · Settings</h1>
          </div>
          <div className="agent-detail-desc">{agent.description}</div>
        </div>
        <Link href={`/agents/run/${agent.id}`} className="agent-btn agent-btn-primary">
          Test run ▶
        </Link>
      </div>

      <AgentSettingsEditor agent={agent} />
    </>
  );
}
