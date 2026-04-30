// app/agents/layout.tsx
import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  const h = PILLAR_HEADER.agents;
  const t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Vientiane' });
  return (
    <>
      <Banner eyebrow={h.eyebrow} title={h.title} titleEmphasis={h.emphasis}
        meta={<><strong>Automation</strong><br />Refreshed {t} ICT</>} />
      <SubNav items={RAIL_SUBNAV.agents} />
      <div className="panel">{children}</div>
    </>
  );
}
