import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.decasaemcasa.app',
  appName: 'De Casa em Casa',
  webDir: 'out',
  bundledWebRuntime: false,

  server: {
    url: 'https://de-casa-em-casa.vercel.app',
    cleartext: false,
  },
};

export default config;
