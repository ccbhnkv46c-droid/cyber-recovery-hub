require('dotenv/config');

const { resolveApiRewriteUrl } = require('./lib/urls.cjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone breaks `next start` rewrites in monolith deploys (Railway, Docker+Express)
  output:
    process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PUBLIC_DOMAIN
      ? undefined
      : 'standalone',
  async rewrites() {
    const apiRewriteUrl = resolveApiRewriteUrl();
    console.log(`[next.config] API rewrite destination: ${apiRewriteUrl}/api/*`);
    return [
      {
        source: '/api/:path*',
        destination: `${apiRewriteUrl.replace(/\/$/, '')}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
