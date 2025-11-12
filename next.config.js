/** @type {import('next').NextConfig} */
import pwa from '@ducanh2912/next-pwa';

const withPWA = pwa({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  reloadOnOnline: true,
  swcMinify: true,
  workboxOptions: {
    disableDevLogs: true,
  }
});

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
    ],
  },
};

export default withPWA(nextConfig);
