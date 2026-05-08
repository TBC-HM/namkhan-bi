// app/cockpit/layout.tsx
// Server-component layout — sets ISR revalidation for the entire /cockpit segment.
// The child page.tsx is 'use client' and fetches live data; this layout
// controls how Next.js caches the HTML shell + static assets at the edge.

export const revalidate = 60; // revalidate every 60 seconds
export const dynamic = 'force-dynamic'; // allow per-request data, but still ISR-eligible

export default function CockpitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
