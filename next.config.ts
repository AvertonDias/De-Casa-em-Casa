import withPWA from '@ducanh2912/next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = {};

const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

// Esta é a forma mais segura de combinar as configurações
const finalConfig = pwaConfig(nextConfig);

export default finalConfig;
