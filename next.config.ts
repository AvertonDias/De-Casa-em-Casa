import withPWA from '@ducanh2912/next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configurações do Next.js podem ser adicionadas aqui no futuro
};

// O export default usa a função withPWA para "embrulhar" sua configuração do Next.js
export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
})(nextConfig);