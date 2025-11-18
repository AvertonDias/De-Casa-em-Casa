/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Adiciona uma regra para ignorar o diretório 'api'
    config.watchOptions.ignored = /api/;
    
    // Adiciona uma regra para não tratar o conteúdo do diretório 'api'
    config.module.rules.push({
      test: /api/,
      loader: 'ignore-loader',
    });

    return config;
  },
};

module.exports = nextConfig;
