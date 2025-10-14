import { ThemeProvider } from '@/components/ThemeProvider';
import { UserProvider } from '@/contexts/UserContext';
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css";

export const metadata: Metadata = {
  title: "De Casa em Casa",
  description: "Painel de Controle de Territórios",
  manifest: "/manifest.json",
  icons: {
    icon: '/icon-192x192.jpg',
    apple: '/icon-192x192.jpg',
  },
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
    <html lang="pt-br" suppressHydrationWarning>
       <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <UserProvider>
          <ThemeProvider 
            attribute="class" 
            defaultTheme="system" 
            enableSystem 
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </UserProvider>
        <SpeedInsights/>
      </body>
    </html>
  );
}
