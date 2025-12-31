import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.decasaemcasa.app',
  appName: 'De Casa em Casa',
  webDir: 'out', // Verifique se sua pasta de build se chama 'out' (Next.js) ou 'dist' (Vite/React)
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    allowNavigation: ['*'] // Permite navegação interna fluída
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  // Garante que o app não tente carregar de um servidor externo se estiver offline
  android: {
    allowMixedContent: true,
    captureInput: true
  }
};

export default config;