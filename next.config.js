/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Temp 2026-05-05: bypass TS strict on build because PBS's WIP files
  // (e.g. CashForecastPanel) reference types not yet fully exported in
  // app/finance/_data.ts. Remove once those exports are completed.
  // Tracked in cockpit/setup-log.md (Phase 5+ recovery section).
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] }
  },
  // Marketing restored as 3rd pillar (2026-04-30) — its own routes live again.
  // Today/Departments/Actions still fold into Operations.
  async headers() {
    return [
      {
        source: '/p/:token',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ];
  },
  // PBS 2026-07-07: Beyond Circle signing page — /sign/:token serves the
  // static public/sign/index.html; the inline JS reads the token from
  // location.pathname and POSTs to sign-revenue-contract.
  async rewrites() {
    return [
      { source: '/sign/:token', destination: '/sign/index.html' },
    ];
  },
  async redirects() {
    return [
      { source: '/today',                       destination: '/operations/today',        permanent: false },
      { source: '/departments',                 destination: '/operations',              permanent: false },
      { source: '/departments/roots',           destination: '/operations/restaurant',   permanent: false },
      { source: '/departments/spa-activities',  destination: '/operations/spa',          permanent: false },
      { source: '/actions',                     destination: '/operations',              permanent: false },
      // Front Office unfolded to top-level pillar 2026-05-01.
      { source: '/operations/frontoffice',      destination: '/front-office/arrivals',   permanent: false },
      { source: '/operations/frontoffice/:path*', destination: '/front-office/arrivals', permanent: false },
      // Phase 2 marketing restructure 2026-05-01 PM: /media* → /library, /upload, /taxonomy.
      // PBS 2026-07-11 pm: killed the legacy /marketing/media redirects — the new Media Hub owns /marketing/media.
      // /marketing/library now 307 → /marketing/media (in app/marketing/library/page.tsx).
      // 2026-07-30 (brief autospec-newsletter_module-20260725 · A8/URL LAW rule 7):
      // Director Studio moved under the tenant tree; legacy path is a Namkhan-only 307.
      { source: '/guest/newsletters/director',  destination: '/h/260955/guest/newsletters/director', permanent: false },
      // 2026-08-14 (brief ops_maintenance_module-owner-findings-v1 · finding #90):
      // /ops/maintenance is a shorthand alias for /operations/maintenance.
      { source: '/ops/maintenance',             destination: '/operations/maintenance',  permanent: false },
    ];
  },
};
module.exports = nextConfig;
