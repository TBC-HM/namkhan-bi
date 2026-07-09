// app/holding/finance/invoices/_components/InvoiceSubNav.tsx
// PBS 2026-07-09: second-level tab strip inside /holding/finance/invoices.
// Sits inside a page body — the top DashboardPage strip carries the dept tabs
// (HoD / Invoices / Clients) and this one carries the invoice subtabs.

import TenantLink from '@/components/nav/TenantLink';

const HAIRLINE = '#E6DFCC';
const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const PRIMARY = '#084838';
const PAPER_SOFT = '#FAFAF7';

type SubTab = 'create' | 'send-log' | 'template';

const TABS: Array<{ key: SubTab; label: string; href: string }> = [
  { key: 'create',   label: 'Create',    href: '/holding/finance/invoices/create'   },
  { key: 'send-log', label: 'Send log',  href: '/holding/finance/invoices/send-log' },
  { key: 'template', label: 'Template',  href: '/holding/finance/invoices/template' },
];

export default function InvoiceSubNav({ active }: { active: SubTab }) {
  return (
    <div style={{
      gridColumn: '1 / -1', display: 'flex', gap: 6, alignItems: 'center',
      padding: '6px 10px', background: PAPER_SOFT,
      border: `1px solid ${HAIRLINE}`, borderRadius: 6,
      marginBottom: 4,
    }}>
      <span style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: INK_SOFT, fontWeight: 700, marginRight: 8 }}>
        Invoices ›
      </span>
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <TenantLink key={t.key} href={t.href}
            style={{
              padding: '4px 10px', borderRadius: 4,
              fontSize: 11, fontWeight: isActive ? 700 : 600, letterSpacing: '0.04em',
              textDecoration: 'none',
              color: isActive ? '#FFFFFF' : INK,
              background: isActive ? PRIMARY : 'transparent',
              border: `1px solid ${isActive ? PRIMARY : HAIRLINE}`,
            }}>
            {t.label}
          </TenantLink>
        );
      })}
    </div>
  );
}
