// app/knowledge/page.tsx
// Re-restored 2026-05-05 from previous deployment dpl_5B5z3cVUhnAMp3ZpRwcnDzks7HCB:
//   1. <Snapshot> — 6-card streaming grid: Weather · Air quality · News · Flights · KB · Expiries
//   2. <KnowledgeApp> — 4-tab workspace: 🔎 Search · 💬 Ask · ⬆ Upload · 🔗 Links

import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';
import Snapshot from './_components/Snapshot';
import KnowledgeApp from './_components/KnowledgeApp';

export const dynamic = 'force-dynamic';

export default function KnowledgePage() {
  const h = PILLAR_HEADER.knowledge;
  return (
    <>
      <Banner
        eyebrow={h.eyebrow}
        title={h.title}
        titleEmphasis={h.emphasis}
        meta={<><strong>Knowledge &amp; docs</strong></>}
      />
      <SubNav items={RAIL_SUBNAV.knowledge} />
      <div className="panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Snapshot />
        <KnowledgeApp />
      </div>
    </>
  );
}
