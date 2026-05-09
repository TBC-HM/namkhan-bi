// app/revenue/layout.tsx
// PBS 2026-05-09: pure passthrough — body bg is dark, <Page> shell handles
// all chrome edge-to-edge, no .panel wrapper that adds cream-coloured padding.
export default function RevenueLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
