/** @type {import('next').NextConfig} */
const nextConfig = {
  // O seu aplicativo funcionará perfeitamente com esta configuração básica.
  experimental: {
    allowedDevOrigins: [
        // URL exata extraída do seu terminal para permitir o acesso
        "https://3000-firebase-studio-1750624095908.cluster-m7tpz3bmgjgoqrktlvd4ykrc2m.cloudworkstations.dev"
    ],
  },
};

module.exports = nextConfig;
