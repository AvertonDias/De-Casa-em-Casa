
// Configure dotenv to load environment variables at the very top
require('dotenv').config({ path: './.env.local' });

const withPWAInit = require("@ducanh2912/next-pwa");

const isDev = process.env.NODE_ENV === "development";

const withPWA = withPWAInit({
  dest: "public",
  disable: isDev,
  sw: "sw.js",
  register: true,
  skipWaiting: true,
  importScripts: ["/firebase-messaging-sw.js"],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
    ],
  },
  experimental: {
    forceSwcTransforms: true,
  },
};

module.exports = withPWA(nextConfig);
