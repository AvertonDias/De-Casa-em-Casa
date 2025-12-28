/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {},
  experimental: {
    missingSuspenseWithCSRBailout: false,
    instrumentationHook: false, // Adicionado para forçar a invalidação do cache
  },
};

export default nextConfig;
