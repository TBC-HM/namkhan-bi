'use client';

// app/finance/layout.tsx
// 2026-05-08 — conditional chrome. /finance is the chat with Intel
// (no chrome). Sub-pages keep Banner + SubNav.
import { usePathname } from 'next/navigation';
import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  if (pathname === '/finance' || pathname === '/finance/') {
    return <>{children}</>;
  }
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
