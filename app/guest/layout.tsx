// app/guest/layout.tsx
// PBS 2026-05-09: pure passthrough — <Page> shell owns chrome on every page.
export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
