// Usamos a sintaxe de import, como no resto do seu projeto
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  importScripts: ["/firebase-messaging-sw.js"],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A configuração de imagens que permite o uso de placehold.co
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
    ],
  },
};

// E exportamos usando a sintaxe 'export default'
export default withPWA(nextConfig);
