// app/revenue/layout.tsx
// PBS 2026-05-09: dept layouts are pure passthroughs. The <Page> shell on
// each page provides the SLH-affiliation footer + sub-pages strip; no
// Banner/SubNav/FilterStrip/.bc-redesign chrome. (Old mockup wrapper
// removed per the canvas manifesto.)

export default function RevenueLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
