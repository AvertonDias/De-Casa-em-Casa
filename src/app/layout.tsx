import { ThemeProvider } from '@/components/ThemeProvider';
import { UserProvider } from '@/contexts/UserContext';
import { FontSizeProvider } from '@/contexts/FontSizeContext'; // Importar
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css";

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

export default function RootLayout({ children }: { children: React.ReactNode; }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
       <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Casa em Casa" />
      </head>
      <body className="font-body antialiased">
        <UserProvider>
          <ThemeProvider 
            attribute="class" 
            defaultTheme="system" 
            enableSystem 
            disableTransitionOnChange
          >
            <FontSizeProvider> {/* Adicionar o Provider */}
              {children}
            </FontSizeProvider>
            <Toaster />
          </ThemeProvider>
        </UserProvider>
        <SpeedInsights/>
      </body>
    </html>
  );
}
