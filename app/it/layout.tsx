// app/it/layout.tsx
// 2026-05-08 (ticket #328): bare layout for the IT entry page so it matches
// /revenue (no Banner / SubNav / panel wrapper). No /it sub-routes exist yet,
// so this is a straight pass-through. When sub-routes ship, follow the same
// usePathname early-return pattern as /finance, /guest, /operations, /sales,
// /marketing.

export default function ITLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
