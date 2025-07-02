"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  browserLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInAnonymously,
  Auth,
  User
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

// --- INICIALIZAÇÃO SEGURA E ROBUSTA ---
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

// ▼▼▼ A LÓGICA DO "GUARDIÃO" ▼▼▼
let authReadyPromise: Promise<User | null> | null = null;

export const ensureAuthReady = (): Promise<User | null> => {
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          resolve(user); // Resolve com o objeto do usuário encontrado
          unsubscribe();
        } else {
          signInAnonymously(auth).then((userCredential) => {
            resolve(userCredential.user); // Resolve com o novo usuário anônimo
            unsubscribe();
          }).catch((err) => {
            console.error("Falha no login anônimo:", err);
            resolve(null); // Resolve com null em caso de falha
            unsubscribe();
          });
        }
      });
    });
  }
  return authReadyPromise;
};
