// app/settings/agents/prompts/page.tsx
// Edit the agent rule books (prompts/*.md) in-browser.
// Stored as overrides in docs.agent_prompt_overrides — falls back to filesystem.

import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';
import AgentPromptsApp from '../_components/AgentPromptsApp';

export const dynamic = 'force-dynamic';

export default function AgentPromptsPage() {
  const h = PILLAR_HEADER.settings;
  return (
    <>
      <Banner
        eyebrow="Settings"
        title="Agent prompts"
        titleEmphasis="& rule books"
        meta={<><strong>edit in-browser</strong> · DB-stored · 60s hot-reload</>}
      />
      <SubNav items={RAIL_SUBNAV.settings} />
      <div className="panel" style={{ padding: 24 }}>
        <AgentPromptsApp />
      </div>
    </>
  );
}
