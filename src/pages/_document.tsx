// src/pages/_document.tsx
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head>
        {/* Tags essenciais para o funcionamento do PWA */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192x192.png"></link>
        <meta name="theme-color" content="#221f2d" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
