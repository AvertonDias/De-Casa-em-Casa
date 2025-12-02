/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Adiciona uma regra para garantir que 'react-remove-scroll' seja tratado corretamente.
    config.externals.push('react-remove-scroll');
    return config;
  },
};

export default nextConfig;
