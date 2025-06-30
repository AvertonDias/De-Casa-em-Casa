import withPWA from '@ducanh2912/next-pwa';

const pwaPlugin = withPWA({
  dest: 'public',
  register: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ele autoriza o seu ambiente de desenvolvimento na nuvem.
  experimental: {
    allowedDevOrigins: [
        // Substitua pela URL exata que aparece no seu terminal, começando com "https://".
        // Por exemplo: "https://3000-firebase-studio-1750624095908.cluster-m7tpz3bmgjgoqrktlvd4ykrc2m.cloudworkstations.dev"
        "COLE_A_SUA_URL_DO_CLOUDWORKSTATIONS_AQUI"
    ],
  },
};

export default pwaPlugin(nextConfig);
