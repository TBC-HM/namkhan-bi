// app/revenue/agents/page.tsx
// Maps to mockup's "agentsettings" tab — Agent Guardrails.
import { MockupTab } from '../_redesign/render';

export const dynamic = 'force-dynamic';

export default function AgentsPage() {
  return <MockupTab slug="agentsettings" />;
}
