import withPWA from '@ducanh2912/next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deixe este objeto vazio.
};

const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

// Esta é a forma mais segura de exportar a configuração
export default pwaConfig(nextConfig);
