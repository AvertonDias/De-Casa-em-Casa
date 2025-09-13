// src/lib/firebaseAdmin.ts
import * as admin from "firebase-admin";

const serviceAccountString = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

if (!admin.apps.length) {
  if (serviceAccountString) {
    try {
      const serviceAccount = JSON.parse(
        Buffer.from(serviceAccountString, "base64").toString("utf8")
      );
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("Firebase Admin SDK inicializado com sucesso.");
    } catch (error) {
      console.error("Erro ao inicializar o Firebase Admin SDK:", error);
    }
  } else {
    console.warn("GOOGLE_APPLICATION_CREDENTIALS_JSON não está definida. Funções de admin podem não funcionar.");
  }
}

export default admin;
