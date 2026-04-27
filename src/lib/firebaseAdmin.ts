"use server";

// src/lib/firebaseAdmin.ts
import * as admin from "firebase-admin";

/**
 * Inicializa o SDK Admin do Firebase.
 * Esta função é robusta e consegue tratar a variável de ambiente GOOGLE_APPLICATION_CREDENTIALS_JSON
 * tanto em formato string JSON pura quanto em Base64.
 */
export function initializeAdmin() {
  if (admin.apps.length > 0) {
    return admin;
  }

  try {
    const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!serviceAccountJson) {
      throw new Error("A variável de ambiente GOOGLE_APPLICATION_CREDENTIALS_JSON não está definida.");
    }

    let serviceAccount;
    
    // Tenta detectar se a string é um JSON direto ou se está em Base64
    if (serviceAccountJson.trim().startsWith('{')) {
      // Se começar com {, tratamos como JSON direto
      serviceAccount = JSON.parse(serviceAccountJson);
    } else {
      // Caso contrário, tenta decodificar de Base64
      serviceAccount = JSON.parse(Buffer.from(serviceAccountJson, 'base64').toString('utf8'));
    }
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // O databaseURL é necessário para o Realtime Database via Admin SDK
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    });
    
    console.log("Firebase Admin SDK inicializado com sucesso.");
    return admin;

  } catch (error: any) {
    console.error("Falha CRÍTICA ao inicializar o Firebase Admin SDK:", error);
    return null;
  }
}
