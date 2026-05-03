// app/agents/run/[id]/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAgent, AGENTS } from '@/lib/agents';
import AgentRunner from '@/components/agents/AgentRunner';

export function generateStaticParams() {
  return AGENTS.map(a => ({ id: a.id }));
}

export default function AgentRunPage({ params }: { params: { id: string } }) {
  const agent = getAgent(params.id);
  if (!agent) notFound();

  return (
    <>
      <div className="agent-detail-head">
        <div>
          <div className="agent-detail-eyebrow">
            <Link href="/agents/roster" className="link-out">← Back to roster</Link>
          </div>
          <div className="agent-detail-title-row">
            <span className="agent-detail-emoji">{agent.emoji}</span>
            <h1 className="agent-detail-title">{agent.name}</h1>
            <span className={`badge agent-status-${agent.status}`}>{agent.status}</span>
          </div>
          <div className="agent-detail-desc">{agent.description}</div>
        </div>
        <Link href={`/agents/settings/${agent.id}`} className="agent-btn">
          Edit prompt & settings
        </Link>
      </div>

      <AgentRunner agent={agent} />
    </>
  );
}
