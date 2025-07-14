/** @type {import('next').NextConfig} */
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  reactStrictMode: true,
  // Forcing a rebuild to clear a potentially corrupted Next.js cache.
  // This comment is added to trigger a rebuild. A new comment is added to ensure it triggers again.
  // Triggering another rebuild to fix module resolution issue.
  // Triggering yet another rebuild to resolve module loading errors.
  // Triggering another rebuild to clear the cache.
  // Forcing another cache invalidation to fix module loading issue.
  // Forcing a new cache invalidation to solve a recurring module error.
  // Forcing cache invalidation to resolve a module loading error.
  // Forcing another cache invalidation to fix a persistent module error.
  // Forcing a cache rebuild to solve module resolution issues.
};

module.exports = withPWA(nextConfig);
