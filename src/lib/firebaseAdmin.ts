// src/lib/firebaseAdmin.ts

// Garantir que o código só rode no servidor
import type { App } from "firebase-admin/app";

let admin: typeof import("firebase-admin") | null = null;
let app: App;

export function initializeAdmin(): App {
  if (!admin) {
    // Faz o import dinâmico apenas no servidor
    admin = require("firebase-admin");
  }

  if (!admin.apps.length) {
    // Decodifica a variável GOOGLE_APPLICATION_CREDENTIALS_JSON
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

/**
 * Retorna a instância atual do Firebase Admin, caso já esteja inicializada.
 * Ideal para evitar inicializações duplicadas em rotas server-side.
 */
export function getAdmin() {
  if (!app) {
    return initializeAdmin();
  }
  return app;
}
