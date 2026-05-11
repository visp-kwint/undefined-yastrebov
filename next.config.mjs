/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // TODO: убрать при подключении реального бэкенда
    return [
      { source: '/api/:path*', destination: '/api/mock/:path*' }
    ];
  },
};

export default nextConfig;
