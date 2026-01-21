import { ThemeProvider } from '@/components/ThemeProvider';
import { UserProvider } from '@/contexts/UserContext';
import { FontSizeProvider } from '@/contexts/FontSizeContext';
import { ModalProvider } from '@/contexts/ModalContext';
import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/toaster";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { PT_Sans } from 'next/font/google'; // Importar a fonte
import "./globals.css";
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';

// Configurar a fonte
const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-pt-sans', // Definir uma variável CSS
});

export const metadata: Metadata = {
  title: "De Casa em Casa",
  description: "Painel de Controle de Territórios",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "De Casa em Casa",
  },
  other: {
    "mobile-web-app-capable": "yes",
  }
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode; }) {
  return (
    <html lang="pt-BR" className={ptSans.variable} suppressHydrationWarning>
      {/* O <head> foi removido. As meta tags estão no objeto 'metadata' e a fonte é injetada pelo Next.js */}
      <body className="font-body antialiased">
        <UserProvider>
          <ThemeProvider 
            attribute="class" 
            defaultTheme="system" 
            enableSystem 
            disableTransitionOnChange
          >
            <ModalProvider>
              <FontSizeProvider>
                <ServiceWorkerRegistrar />
                {children}
                <Toaster />
              </FontSizeProvider>
            </ModalProvider>
          </ThemeProvider>
        </UserProvider>
        <SpeedInsights/>
      </body>
    </html>
  );
}
