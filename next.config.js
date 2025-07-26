// next.config.js

// Usamos a sintaxe de import, como no resto do seu projeto
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  importScripts: ["/firebase-messaging-sw.js"],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A configuração de imagens, que é a que realmente precisávamos
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co', // Domínio para as imagens de placeholder
      },
    ],
  },
};

// E exportamos usando a sintaxe 'export default'
export default withPWA(nextConfig);
