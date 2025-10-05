// src/lib/firebaseAdmin.ts

// Este arquivo inicializa o Firebase Admin de forma segura no Next.js + Vercel
// sem causar erros de compilação no build e sem rodar no cliente.

let admin: typeof import("firebase-admin") | null = null;
let app: import("firebase-admin").app.App | undefined;

export function initializeAdmin() {
  // Faz o import dinâmico apenas no ambiente de servidor
  if (!admin) {
    admin = require("firebase-admin");
  }

  if (!admin.apps.length) {
    const decoded = Buffer.from(
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!,
      "base64"
    ).toString();

    const credentials = JSON.parse(decoded);

    app = admin.initializeApp({
      credential: admin.credential.cert(credentials),
    });

    console.log("✅ Firebase Admin inicializado");
  } else {
    app = admin.app();
  }

  return app;
}

export function getAdmin() {
  if (!app) {
    return initializeAdmin();
  }
  return app;
}
