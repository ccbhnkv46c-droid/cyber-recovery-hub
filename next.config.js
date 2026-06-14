require('dotenv/config');

const { resolveApiRewriteUrl } = require('./lib/urls.cjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: process.env.VERCEL ? undefined : 'standalone',
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
