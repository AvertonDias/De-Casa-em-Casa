import withPWAInit from "@ducanh2912/next-pwa";

// Configure dotenv to load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });


const isDev = process.env.NODE_ENV === "development";

const withPWA = withPWAInit({
  dest: "public",
  disable: isDev,
  // The service worker filename is the default, but we specify it for clarity.
  sw: "sw.js", 
  // The service worker is registered by default, but we can be explicit.
  register: true, 
  // We can skip waiting for the old service worker to unregister.
  skipWaiting: true, 
  // Custom import to load the Firebase messaging service worker
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
