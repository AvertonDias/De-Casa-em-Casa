/** @type {import('next').NextConfig} */
import pwa from '@ducanh2912/next-pwa';

const withPWA = pwa({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
    ],
  },
  experimental: {
    forceSwcTransforms: true,
  },
};

export default withPWA(nextConfig);
