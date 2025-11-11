/** @type {import('next').NextConfig} */
import pwa from '@ducanh2912/next-pwa';

const withPWA = pwa({
  dest: 'public',
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
};

export default withPWA(nextConfig);
