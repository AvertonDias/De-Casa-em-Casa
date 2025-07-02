/** @type {import('next').NextConfig} */
const withPWAInit = require("@ducanh2912/next-pwa");

// Passo 1: Inicialize a função PWA com suas opções.
const withPWA = withPWAInit.default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  // A linha 'importScripts' foi REMOVIDA para este teste.
});

const nextConfig = {
  // Configurações do Next.js entram aqui, se necessário.
};

// Passo 2: Desabilitando o PWA temporariamente para diagnosticar o erro de build.
// module.exports = withPWA(nextConfig);
module.exports = nextConfig;
