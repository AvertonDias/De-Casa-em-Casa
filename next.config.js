const withPWA = require('@ducanh2912/next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Objeto vazio, sem a chave 'experimental'.
};

module.exports = withPWA(nextConfig);