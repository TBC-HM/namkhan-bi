// app/sample/layout.tsx — pure passthrough so the candidate templates render
// without Banner/SubNav chrome. No client hooks; the parent app/layout.tsx
// handles the global frame.

export default function SampleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
