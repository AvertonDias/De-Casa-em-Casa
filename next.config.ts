import withPWAInit from '@ducanh2912/next-pwa';

// Primeiro, chame a função importada com as suas opções de PWA.
// Isso retorna a função que irá "embrulhar" sua configuração do Next.js.
const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Qualquer configuração específica do Next.js entra aqui.
  // Por enquanto, pode ficar vazio.
};

// Por fim, exporte o resultado da função PWA chamada com a sua configuração do Next.js.
export default withPWA(nextConfig);