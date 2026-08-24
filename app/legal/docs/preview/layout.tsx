// app/legal/docs/preview/layout.tsx
// Passthrough layout that intentionally opts OUT of the cockpit navigation
// shell. Without this file Next.js 15 App Router inherits the root cockpit
// layout and wraps the preview in the full Namkhan menu — bug #178.
//
// Rules:
//   • Nested layouts MUST NOT render <html> or <body> — only the root layout
//     may do that (Next.js 15 App Router; duplicate tags → hydration errors).
//   • No inline styles, no hex values — this layout is a transparent passthrough.

export default function DocPreviewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

