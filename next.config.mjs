/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Ignore the 'api' directory from being watched
    config.watchOptions.ignored = /api/;
    return config;
  },
};

export default nextConfig;
