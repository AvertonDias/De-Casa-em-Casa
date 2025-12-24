/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {},
  // Adiciona a configuração para ignorar a página do favicon durante o build
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  webpack: (config, { isServer }) => {
    // Adiciona uma regra para ignorar a rota do favicon do lado do servidor
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        './favicon.ico': false,
      };
    }

    return config;
  },
};

export default nextConfig;
