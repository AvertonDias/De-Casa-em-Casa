"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  browserLocalPersistence,
  initializeAuth,
  signInAnonymously,
  Auth,
  User,
  onAuthStateChanged
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  CACHE_SIZE_UNLIMITED,
  Firestore,
  getFirestore
} from "firebase/firestore";

import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// --- INICIALIZAÇÕES SEGURAS ---
export const auth: Auth = initializeAuth(app, {
  persistence: browserLocalPersistence
});

let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED })
  });
} catch (e) {
  console.error("Persistência do Firestore falhou, usando o padrão.", e);
  dbInstance = getFirestore(app);
}

export const db = dbInstance;

export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');
export const messaging = (typeof window !== 'undefined') ? getMessaging(app) : null;


// ▼▼▼ O PADRÃO SINGLETON DEFINITIVO ▼▼▼

let authReadyPromise: Promise<User> | null = null;

// Esta é a nossa função "guardiã" pública.
export const ensureAuthIsReady = (): Promise<User> => {
  // Se a promessa ainda não foi criada, crie-a.
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve, reject) => {
      // Usamos onAuthStateChanged para saber quando a autenticação está pronta.
      const unsubscribe = onAuthStateChanged(auth,
        (user) => {
          if (user) {
            // Se encontrarmos um usuário (seja ele persistente ou recém-criado anonimamente),
            // a promessa é resolvida com sucesso e o listener é removido.
            unsubscribe();
            resolve(user);
          }
        },
        (error) => {
          // Se houver um erro no listener, rejeitamos a promessa.
          unsubscribe();
          reject(error);
        }
      );
    });
  }

  // Retorna a promessa existente (ou a recém-criada).
  return authReadyPromise;
};

// Esta chamada inicializa o processo de login anônimo SE necessário.
// Nós a chamamos uma vez, aqui no módulo, para "acordar" o sistema.
// E imediatamente iniciamos o processo de verificação da autenticação
onAuthStateChanged(auth, (user) => {
  if (!user) {
    signInAnonymously(auth).catch((error) => {
      console.error("Falha no login anônimo inicial: ", error);
    });
  }
});
