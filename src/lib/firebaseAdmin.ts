"use server";

// src/lib/firebaseAdmin.ts
import * as adminNamespace from "firebase-admin";

// Resolve interop para garantir que funciona em ESM (como Next.js em produção) e CommonJS
const admin: any = (adminNamespace as any).default || adminNamespace;

/**
 * Inicializa o SDK Admin do Firebase.
 * Esta função é robusta e consegue tratar a variável de ambiente GOOGLE_APPLICATION_CREDENTIALS_JSON
 * tanto em formato string JSON pura quanto em Base64.
 */
export async function initializeAdmin() {
  if (!admin) {
    console.error("Não foi possível carregar o módulo firebase-admin.");
    return { admin: null, error: new Error("Módulo firebase-admin é nulo ou indefinido") };
  }

  const apps = admin.apps || [];
  if (apps.length > 0) {
    return { admin, error: null };
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
    
    // Validar as propriedades mínimas de uma service account para ajudar no diagnóstico
    const requiredKeys = ['project_id', 'private_key', 'client_email'];
    const missingKeys = requiredKeys.filter(k => !serviceAccount[k]);
    if (missingKeys.length > 0) {
      throw new Error(`O JSON de credenciais está incompleto. Faltam as chaves: ${missingKeys.join(', ')}`);
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // O databaseURL é necessário para o Realtime Database via Admin SDK
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    });
    
    console.log("Firebase Admin SDK inicializado com sucesso.");
    return { admin, error: null };

  } catch (error: any) {
    console.error("Falha CRÍTICA ao inicializar o Firebase Admin SDK:", error);
    return { admin: null, error };
  }
}
