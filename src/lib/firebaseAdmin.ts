"use server";

// src/lib/firebaseAdmin.ts
import * as admin from "firebase-admin";

// Esta função garante que o SDK seja inicializado apenas uma vez.
export function initializeAdmin() {
  if (admin.apps.length > 0) {
    return admin;
  }

  try {
    // Espera uma única variável de ambiente com o JSON completo codificado em Base64.
    const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    
    if (!serviceAccountJson) {
      throw new Error("A variável de ambiente GOOGLE_APPLICATION_CREDENTIALS_JSON não está definida.");
    }
    
    // Decodifica a string Base64 para obter o JSON original.
    const serviceAccount = JSON.parse(Buffer.from(serviceAccountJson, 'base64').toString('utf8'));
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    
    console.log("Firebase Admin SDK inicializado com sucesso via credencial JSON.");
    return admin;

  } catch (error: any) {
    console.error("Falha CRÍTICA ao inicializar o Firebase Admin SDK:", error);
    // Retorna null ou lança o erro para que a API que chama possa tratar.
    return null;
  }
}
