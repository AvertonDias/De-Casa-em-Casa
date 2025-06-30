const withPWA = require('@ducanh2912/next-pwa')({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
  });
  
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    // Qualquer configuração futura do Next.js entra aqui.
    // Por enquanto, pode ficar vazio.
  };
  
  module.exports = withPWA(nextConfig);