/** @type {import('next').NextConfig} */
const withPWAInit = require("@ducanh2912/next-pwa");

// Passo 1: Inicialize a função PWA com suas opções.
const withPWA = withPWAInit.default({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig = {
  // Configurações do Next.js entram aqui, se necessário.
};

// Passo 2: Exporte o resultado da função PWA envolvendo sua nextConfig.
module.exports = withPWA(nextConfig);