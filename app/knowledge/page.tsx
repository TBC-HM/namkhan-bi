// app/knowledge/page.tsx
// Knowledge utility — SOPs, brand, automation roster.

import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';
import { AGENTS } from '@/lib/agents';

export const dynamic = 'force-dynamic';

export default function KnowledgePage() {
  const h = PILLAR_HEADER.knowledge;
  const live = AGENTS.filter((a: any) => a.status === 'live').length;
  const draft = AGENTS.filter((a: any) => a.status === 'draft').length;

  return (
    <>
      <Banner
        eyebrow={h.eyebrow}
        title={h.title}
        titleEmphasis={h.emphasis}
        meta={<><strong>Knowledge & automation</strong></>}
      />
      <SubNav items={RAIL_SUBNAV.knowledge} />
      <div className="panel">
        <PanelHero
          eyebrow="Knowledge"
          title="Repos"
          emphasis="& automation"
          sub="SOPs · brand · agents · prompt library"
          kpis={
            <>
              <KpiCard label="Total Agents" value={AGENTS.length} hint="across all categories" />
              <KpiCard label="Live" value={live} tone="pos" />
              <KpiCard label="Draft" value={draft} tone="warn" />
              <KpiCard label="SOPs" value={null} greyed hint="Library Phase 2" />
            </>
          }
        />

        <div className="card-grid-2">
          <Card title="Agent roster" sub="Automation primitives — Phase 4 will move these into action cards inline">
            <div className="stub" style={{ padding: 32 }}>
              <h3>Open Agents · Roster</h3>
              <p>
                {AGENTS.length} agents configured ({live} live, {draft} draft).
                Visit <strong>/agents/roster</strong> for the full list.
              </p>
            </div>
          </Card>

          <Card title="SOP library" sub="Coming Phase 2" source="grey">
            <div className="stub" style={{ padding: 32 }}>
              <h3>Coming soon</h3>
              <p>
                Centralized SOP library — guest journey, F&B, spa protocols, brand standards.
                Will pull from Drive folder structure.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
