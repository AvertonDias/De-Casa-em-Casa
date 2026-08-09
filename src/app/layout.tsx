import type {
  Metadata,
  Viewport,
} from "next";

import {
  PT_Sans,
} from "next/font/google";

import "./globals.css";

import { ThemeProvider } from "@/components/ThemeProvider";

import {
  UserProvider,
} from "@/contexts/UserContext";

import {
  FontSizeProvider,
} from "@/contexts/FontSizeContext";

import {
  ModalProvider,
} from "@/contexts/ModalContext";

import {
  Toaster,
} from "@/components/ui/toaster";

import {
  SpeedInsights,
} from "@vercel/speed-insights/next";

import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

import {
  FirebaseErrorListener,
} from "@/components/FirebaseErrorListener";


/* =========================================================
   FONTE
========================================================= */

const ptSans = PT_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-pt-sans",
});


/* =========================================================
   CONFIGURAÇÃO
========================================================= */

export const dynamic =
  "force-dynamic";


/* =========================================================
   METADATA
========================================================= */

export const metadata: Metadata = {
  title: "De Casa em Casa",

  description:
    "Painel de Controle de Territórios",

  manifest:
    "/manifest.json?v=2",

  appleWebApp: {
    capable: true,

    statusBarStyle:
      "black-translucent",

    title:
      "De Casa em Casa",
  },

  other: {
    "mobile-web-app-capable":
      "yes",
  },
};


/* =========================================================
   VIEWPORT
========================================================= */

export const viewport: Viewport = {
  themeColor:
    "#0f172a",
};


/* =========================================================
   ROOT LAYOUT
========================================================= */

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <html
      lang="pt-BR"
      className={ptSans.variable}
      suppressHydrationWarning
    >

      <body
        className="font-body antialiased"
      >

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

                <FirebaseErrorListener />

                {children}

                <Toaster />

              </FontSizeProvider>

            </ModalProvider>

          </ThemeProvider>

        </UserProvider>


        <SpeedInsights />

      </body>

    </html>
  );
}