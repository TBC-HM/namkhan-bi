// app/finance/layout.tsx

import SubNav from '@/components/nav/SubNav';

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubNav
        items={[
          { label: 'P&L', href: '/finance/pnl' },
          { label: 'Budget', href: '/finance/budget', coming: true },
          { label: 'Guest Ledger & Deposits', href: '/finance/ledger' },
        ]}
      />
      {children}
    </>
  );
}
