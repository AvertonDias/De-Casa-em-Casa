import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  importScripts: ["/firebase-messaging-sw.js"],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A configuração de imagens
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
    ],
  },
  
  // ▼▼▼ A CORREÇÃO FINAL ESTÁ AQUI ▼▼▼
  // Garante que o Next.js não tente otimizar páginas que não existem mais ou não serão usadas
  experimental: {
    // Essa flag força o SWC, que às vezes resolve problemas de módulo/cache
    forceSwcTransforms: true,
  },
  
  // As funções 'rewrites' e 'redirects' podem ajudar a Next.js a ignorar rotas.
  // Por enquanto, não vamos colocar regras específicas aqui para não complicar,
  // mas é o lugar certo se precisarmos no futuro.
  // async redirects() {
  //   return [
  //     // Exemplo: redireciona uma página antiga para uma nova
  //     // {
  //     //   source: '/old-path',
  //     //   destination: '/new-path',
  //     //   permanent: true,
  //     // },
  //   ]
  // },
  // async rewrites() {
  //   return [
  //     // Exemplo: reescreve uma URL sem mudar a página real
  //     // {
  //     //   source: '/api/:path*',
  //     //   destination: 'http://localhost:5001/your-project-id/us-central1/api/:path*',
  //     // },
  //   ]
  // },
};

export default withPWA(nextConfig);
