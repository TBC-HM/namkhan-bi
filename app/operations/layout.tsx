// app/operations/layout.tsx
// 2026-05-08 (ticket #328): bare-render the entry page (matches /revenue).
'use client';

import { usePathname } from 'next/navigation';
import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';

export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  if (pathname === '/operations' || pathname === '/operations/') return <>{children}</>;
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
