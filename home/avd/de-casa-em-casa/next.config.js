/** @type {import('next').NextConfig} */
import pwa from '@ducanh2912/next-pwa';

const isDev = process.env.NODE_ENV === 'development';

const withPWA = pwa({
  dest: 'public',
  disable: isDev,
  // add your own strategies
  // cacheOnFrontEndNav: true,
  // aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  workboxOptions: {
    disableDevLogs: true,
  }
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
