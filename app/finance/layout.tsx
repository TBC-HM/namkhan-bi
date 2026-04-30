// app/finance/layout.tsx
import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import FilterStrip from '@/components/nav/FilterStrip';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const h = PILLAR_HEADER.finance;
  const t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Vientiane' });
  return (
    <>
      <Banner eyebrow={h.eyebrow} title={h.title} titleEmphasis={h.emphasis}
        meta={<><strong>USALI 11th edition</strong><br />Refreshed {t} ICT</>} />
      <SubNav items={RAIL_SUBNAV.finance} />
      <FilterStrip baseHref="/finance" liveSource="Cloudbeds · live" />
      <div className="panel">{children}</div>
    </>
  );
}
