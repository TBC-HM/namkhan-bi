// app/operations/layout.tsx
// Cowork audit 2026-05-03: removed FilterStrip from this layout. Most Ops
// sub-pages (today, housekeeping, maintenance, staff, inventory) are live
// snapshots and shouldn't show window/compare/segment selectors. Pages that
// ARE period-aware (operations/page.tsx, restaurant, spa, activities) render
// their own FilterStrip inline.
import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';

export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  const h = PILLAR_HEADER.operations;
  const t = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Vientiane',
  });
  return (
    <>
      <Banner
        eyebrow={h.eyebrow}
        title={h.title}
        titleEmphasis={h.emphasis}
        meta={<><strong>Live operations</strong><br />Refreshed {t} ICT</>}
      />
      <SubNav items={RAIL_SUBNAV.operations} />
      <div className="panel">{children}</div>
    </>
  );
}
