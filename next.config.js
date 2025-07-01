/** @type {import('next').NextConfig} */
const withPWA = require('@ducanh2912/next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig = {
  // Objeto vazio, sem a chave 'experimental'.
};

module.exports = withPWA(nextConfig);
