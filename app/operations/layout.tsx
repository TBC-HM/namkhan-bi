// app/operations/layout.tsx
// PBS 2026-05-09: pure passthrough — <Page> shell owns chrome on every page.
export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
