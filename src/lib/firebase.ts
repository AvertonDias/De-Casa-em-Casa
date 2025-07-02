"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  browserLocalPersistence,
  initializeAuth,
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

// ▼▼▼ A FUNÇÃO "GUARDIÃO" ▼▼▼
// Esta função garante que obteremos uma sessão de usuário (anônima ou não)
// e só tenta o login anônimo se for estritamente necessário.
export const getAuthSession = async (): Promise<User> => {
  // 1. Verifica se já existe um usuário logado.
  if (auth.currentUser) {
    return auth.currentUser;
  }
  
  // 2. Se não houver, tenta logar anonimamente.
  try {
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } catch (error) {
    console.error("Falha crítica no login anônimo:", error);
    // Lança um erro para que a página de cadastro possa pegá-lo.
    throw new Error("Não foi possível estabelecer uma sessão segura.");
  }
};
