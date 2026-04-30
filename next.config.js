/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] }
  },

  // v1.1 architecture: 4 pillars only.
  // Old URLs redirect to their new home so existing bookmarks / Vercel traffic
  // continue to work after deployment.
  async redirects() {
    return [
      // Operations pillar absorbs Today + Departments + Action Plans
      { source: '/today',                       destination: '/operations/today',        permanent: false },
      { source: '/departments',                 destination: '/operations',              permanent: false },
      { source: '/departments/roots',           destination: '/operations/restaurant',   permanent: false },
      { source: '/departments/spa-activities',  destination: '/operations/spa',          permanent: false },
      { source: '/actions',                     destination: '/operations',              permanent: false },

      // Guest pillar absorbs Marketing
      { source: '/marketing',                   destination: '/guest',                   permanent: false },
      { source: '/marketing/reviews',           destination: '/guest/reviews',           permanent: false },
      { source: '/marketing/social',            destination: '/guest/social',            permanent: false },
      { source: '/marketing/influencers',       destination: '/guest/influencers',       permanent: false },
      { source: '/marketing/media',             destination: '/guest/media',             permanent: false },
    ];
  },
};

module.exports = nextConfig;
