// src/lib/firebaseAdmin.ts

// Garantir que o código só rode no servidor
import type { App } from "firebase-admin/app";

let admin: typeof import("firebase-admin") | null = null;
let app: App;

export function initializeAdmin() {
  if (!admin) {
    // Faz o import dinâmico apenas no servidor
    admin = require("firebase-admin");
  }

  if (!admin.apps.length) {
    const credentials = JSON.parse(
      Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!, "base64").toString()
    );

    app = admin.initializeApp({
      credential: admin.credential.cert(credentials),
    });
  } else {
    app = admin.app();
  }

  return app;
}
