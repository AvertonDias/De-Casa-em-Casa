import withPWA from '@ducanh2912/next-pwa';

const pwaPlugin = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A chave 'experimental' foi completamente removida
  // para resolver o erro de tipo durante o build.
};

export default pwaPlugin(nextConfig);
