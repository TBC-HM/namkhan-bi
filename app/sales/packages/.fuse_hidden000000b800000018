// app/sales/packages/page.tsx
// Sales › Packages — not yet wired (no sales.packages schema).

import LoremPage, { LOREM_SHORT, LOREM_LONG } from '../_components/LoremPage';

export const dynamic = 'force-dynamic';

export default function PackagesPage() {
  return (
    <LoremPage
      pillar="Sales"
      tab="Packages"
      lede="Package builder — room × LOS × F&B × spa × activities × transfer. Margin floor + brand voice + vendor lock."
      kpis={[
        { scope: 'Active packages',    sub: 'in market' },
        { scope: 'Revenue MTD',        sub: 'package bookings' },
        { scope: 'Avg margin',         sub: 'after F&B + spa cost' },
        { scope: 'Top seller',         sub: 'by RNs' },
        { scope: 'Margin floor breaches', sub: 'guardrail breaches' },
      ]}
      sections={[
        { heading: 'Package catalog',     body: LOREM_LONG },
        { heading: 'Margin breakdown',    body: LOREM_SHORT },
        { heading: 'Vendor cost stack',   body: LOREM_SHORT },
        { heading: 'Inventory & lock',    body: LOREM_LONG },
      ]}
      dataSourceNote="Needs schema: sales.packages, sales.package_components, sales.package_costs. Should integrate ops.vendors + items + rate_plans for component pricing."
    />
  );
}
