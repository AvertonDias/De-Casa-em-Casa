// src/lib/firebaseAdmin.ts
import * as admin from "firebase-admin";

// Esta função garante que o SDK seja inicializado apenas uma vez.
export function initializeAdmin() {
  // Se o admin já foi inicializado, retorna a instância existente.
  if (admin.apps.length > 0) {
    return admin;
  }

  // Se o admin não foi inicializado, tenta inicializar com as credenciais do ambiente.
  try {
    const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!serviceAccountJson) {
      throw new Error("A variável de ambiente GOOGLE_APPLICATION_CREDENTIALS_JSON não está definida.");
    }
    
    // Decodifica a string Base64 para obter o JSON da conta de serviço.
    const serviceAccount = JSON.parse(Buffer.from(serviceAccountJson, 'base64').toString('utf8'));
    
    // Inicializa o app do Firebase com as credenciais decodificadas.
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    
    console.log("Firebase Admin SDK inicializado com sucesso.");
    return admin;

  } catch (error: any) {
    console.error("Falha CRÍTICA ao inicializar o Firebase Admin SDK:", error);
    // Em caso de falha, retorna null para que a função que o chamou possa tratar o erro.
    return null;
  }
}
