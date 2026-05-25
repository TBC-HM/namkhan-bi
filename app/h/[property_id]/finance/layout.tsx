// app/h/[property_id]/finance/layout.tsx
// REVERT 2026-05-26: this file was added earlier today to mirror /finance/layout.tsx
// (paper-white scope + FxRateHub). PBS reports it overwrote the finance sub-menu UX.
// Restoring to a clean passthrough — same effect as having no layout file here.
export default function PropertyFinanceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
