/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages with next-on-pages
  experimental: {
    runtime: 'edge',
  },
};

module.exports = nextConfig;
