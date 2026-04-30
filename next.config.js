/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] }
  },
  // Marketing restored as 3rd pillar (2026-04-30) — its own routes live again.
  // Today/Departments/Actions still fold into Operations.
  async redirects() {
    return [
      { source: '/today',                       destination: '/operations/today',        permanent: false },
      { source: '/departments',                 destination: '/operations',              permanent: false },
      { source: '/departments/roots',           destination: '/operations/restaurant',   permanent: false },
      { source: '/departments/spa-activities',  destination: '/operations/spa',          permanent: false },
      { source: '/actions',                     destination: '/operations',              permanent: false },
    ];
  },
};
module.exports = nextConfig;
