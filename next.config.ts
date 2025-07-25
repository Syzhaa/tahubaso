import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'asset.kompas.com',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
      {
        protocol: 'https',
        hostname: 'iili.io',
      },
      { // INI YANG TERAKHIR DITAMBAHKAN
        protocol: 'https',
        hostname: 'csczaropdidefplsylwt.supabase.co',
      },
    ],
  },
};

export default nextConfig;