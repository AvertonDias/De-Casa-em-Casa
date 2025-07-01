/** @type {import('next').NextConfig} */
const withPWA = require('@ducanh2912/next-pwa');

const nextConfig = {
  // Next.js configuration options can be added here.
};

module.exports = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})(nextConfig);
