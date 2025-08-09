import withPWAInit from "@ducanh2912/next-pwa";

// Configure dotenv to load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });


const isDev = process.env.NODE_ENV === "development";

const withPWA = withPWAInit({
  dest: "public",
  disable: isDev,
  importScripts: ["/firebase-messaging-sw.js"],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
    ],
  },
  experimental: {
    forceSwcTransforms: true,
  },
};

export default withPWA(nextConfig);
