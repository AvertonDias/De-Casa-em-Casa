import withPWA from '@ducanh2912/next-pwa';

const pwaPlugin = withPWA({
  dest: 'public',
  register: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Coloque qualquer configuração específica do Next.js aqui.
};

export default pwaPlugin(nextConfig);
