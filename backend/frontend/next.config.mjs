/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:5000/api/:path*' },
      { source: '/reports/:path*', destination: 'http://localhost:5000/reports/:path*' },
      { source: '/uploads/:path*', destination: 'http://localhost:5000/uploads/:path*' },
    ];
  },
};

export default nextConfig;
