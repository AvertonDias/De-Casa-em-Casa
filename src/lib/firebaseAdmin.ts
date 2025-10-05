// src/lib/firebaseAdmin.ts

// Este arquivo é responsável por inicializar o SDK do Firebase Admin
// de forma segura e compatível com Next.js e Vercel.

// ⚠️ Importação dinâmica — garante que o firebase-admin
// só será carregado em ambiente de servidor, nunca no cliente.
import type { app as AppNamespace } from "firebase-admin";

let admin: typeof import("firebase-admin") | null = null;
let app: AppNamespace.App | undefined;

/**
 * Inicializa e retorna uma instância única do Firebase Admin SDK.
 * Este método garante:
 * - Que o SDK seja inicializado apenas uma vez.
 * - Que ele funcione corretamente tanto localmente quanto no Vercel.
 * - Que as credenciais sejam lidas da variável codificada em Base64.
 */
export function initializeAdmin(): AppNamespace.App {
  if (!admin) {
    // Import dinâmico, evita erros de build do Next.js
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
