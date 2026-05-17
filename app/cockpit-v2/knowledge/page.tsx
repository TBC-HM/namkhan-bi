// app/cockpit-v2/knowledge/page.tsx
// Ask 2 — tiered knowledge with strict tenant separation.
// L1 Holding (Felix) · L2 Property (Namkhan OR Donna — never blended) ·
// L3 Department · L4 Agent (drill-in to prompt + memories).
// Edit-prompt button on each agent card opens a versioned write flow that
// goes through /api/cockpit-v2/prompt with a mandatory dry-run preview.

import { fetchAgents, fetchMemories, fetchPrompts } from '../_lib/data';
import { KnowledgeView } from './KnowledgeView';

export const dynamic = 'force-dynamic';

export default async function CockpitV2KnowledgePage() {
  const [agents, memories, prompts] = await Promise.all([
    fetchAgents(),
    fetchMemories(),
    fetchPrompts(),
  ]);
  return <KnowledgeView agents={agents} memories={memories} prompts={prompts} />;
}
