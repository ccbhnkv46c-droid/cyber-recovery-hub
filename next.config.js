const { resolveApiRewriteUrl } = require('./lib/urls.cjs');

/** @type {import('next').NextConfig} */
let apiRewriteUrl;

try {
  apiRewriteUrl = resolveApiRewriteUrl();
  console.log(`[next.config] API rewrite destination: ${apiRewriteUrl}/api/*`);
} catch (err) {
  console.error(`[next.config] Failed to resolve API rewrite URL: ${err.message}`);
  apiRewriteUrl = `http://127.0.0.1:${process.env.API_PORT || '3001'}`;
}

const nextConfig = {
  reactStrictMode: true,
  output: process.env.VERCEL ? undefined : 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiRewriteUrl.replace(/\/$/, '')}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
