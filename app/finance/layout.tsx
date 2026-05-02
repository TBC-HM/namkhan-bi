// app/finance/layout.tsx
// Cowork audit 2026-05-03: removed FilterStrip from this layout. Finance has
// snapshot pages (ledger AR aging, agents) where window/compare/segment don't
// apply. Period-aware pages (snapshot, P&L, budget) render their own FilterStrip.
import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const h = PILLAR_HEADER.finance;
  const t = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Vientiane',
  });
  return (
    <>
      <Banner
        eyebrow={h.eyebrow}
        title={h.title}
        titleEmphasis={h.emphasis}
        meta={<><strong>USALI ledger</strong><br />Refreshed {t} ICT</>}
      />
      <SubNav items={RAIL_SUBNAV.finance} />
      <div className="panel">{children}</div>
    </>
  );
}
