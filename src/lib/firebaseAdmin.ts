// src/lib/firebaseAdmin.ts
import * as admin from "firebase-admin";

const serviceAccountString = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

if (!admin.apps.length) {
  // Apenas inicialize se a variável de ambiente estiver presente
  if (serviceAccountString) {
    try {
      const serviceAccount = JSON.parse(
        Buffer.from(serviceAccountString, "base64").toString("utf8")
      );
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("Firebase Admin SDK inicializado com sucesso a partir da variável de ambiente.");
    } catch (error) {
      console.error("Erro ao inicializar o Firebase Admin SDK:", error);
    }
  } else {
    // Se a variável não estiver definida, a inicialização padrão (usada em Cloud Functions) será tentada.
    // Isso é útil para ambientes de desenvolvimento/teste do Firebase.
    try {
        admin.initializeApp();
        console.log("Firebase Admin SDK inicializado com credenciais padrão do ambiente.");
    } catch(e) {
        console.warn("Não foi possível inicializar o Firebase Admin. Credenciais padrão não encontradas e GOOGLE_APPLICATION_CREDENTIALS_JSON não definida. As funções de admin não funcionarão.");
    }
  }
}

export default admin;
