// app/h/[property_id]/finance/layout.tsx
// USALI partial fix for task #4 + task #16 (2026-05-26)
// Mirrors /finance/layout.tsx so Donna + property-scoped Namkhan finance pages
// get the same paper-white token override + FxRateHub strip on top.

import FxRateHub from '@/app/_components/finance/FxRateHub';

export default async function PropertyFinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="finance-paperwhite-scope">
      <style>{`
        .finance-paperwhite-scope {
          --surf-0: #FFFFFF;
          --surf-1: #FAFAF7;
          --surf-2: #F4EFE2;
          --paper-warm: #FAFAF7;
          --paper-deep: #EDE7D4;
          --border-1: #E6DFCC;
          --border-2: #D6CFB8;
          --border-3: #C8C0A6;
          --rule: #D6CFB8;
          --text-0: #1B1B1B;
          --text-1: #1B1B1B;
          --text-2: #2A2A2A;
          --text-warm: #1B1B1B;
          --text-soft: #5A5A5A;
          --text-mute: #5A5A5A;
          --text-dim: #7D7D7D;
          --text-place: #9A9A9A;
          --ink: #1B1B1B;
          --ink-mute: #5A5A5A;
          --ink-soft: #5A5A5A;
          --ink-faint: #9A9A9A;
          --line-soft: #E6DFCC;
          --hairline: #E6DFCC;
        }
        .finance-paperwhite-scope table.usali th,
        .finance-paperwhite-scope thead th {
          color: #5A5A5A !important;
          background: #FAFAF7 !important;
          border-bottom: 1px solid #E6DFCC !important;
        }
        .finance-paperwhite-scope .panel,
        .finance-paperwhite-scope .panel.dashed {
          background: #FFFFFF !important;
          border-color: #E6DFCC !important;
          color: #1B1B1B !important;
        }
        .finance-paperwhite-scope code {
          background: rgba(31, 58, 46, 0.06);
          color: #1B1B1B;
        }
      `}</style>
      {/* @ts-expect-error Async Server Component in JSX */}
      <FxRateHub />
      {children}
    </div>
  );
}
