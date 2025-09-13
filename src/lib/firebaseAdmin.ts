// src/lib/firebaseAdmin.ts
"use server";
import * as admin from "firebase-admin";

let app: admin.app.App;

if (!admin.apps.length) {
  const serviceAccountString = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (!serviceAccountString) {
    console.error("ERRO CRÍTICO: A variável de ambiente GOOGLE_APPLICATION_CREDENTIALS_JSON não está definida.");
    // Não inicializa o app se a credencial não existir
  } else {
    try {
      const serviceAccount = JSON.parse(
        Buffer.from(serviceAccountString, "base64").toString("utf8")
      );
      
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("Firebase Admin inicializado com sucesso.");
    } catch (error) {
      console.error("Erro ao inicializar Firebase Admin:", error);
    }
  }
} else {
  app = admin.app();
}

// Exporta instâncias que podem falhar graciosamente se o app não foi inicializado
export const adminFirestore = app ? app.firestore() : null;
export const adminMessaging = app ? app.messaging() : null;
export const adminAuth = app ? app.auth() : null;
