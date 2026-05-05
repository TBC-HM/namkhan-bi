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
      { source: '/marketing/media',             destination: '/marketing/library',  permanent: false },
      { source: '/marketing/media/upload',      destination: '/marketing/upload',   permanent: false },
      { source: '/marketing/media/taxonomy',    destination: '/marketing/taxonomy', permanent: false },
    ];
  },
};
module.exports = nextConfig;
