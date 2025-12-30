/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {},
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};

export default nextConfig;
