// src/lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getMessaging } from "firebase/messaging";

// O objeto de configuração agora lê as variáveis de ambiente seguras.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, // A linha crucial!
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Inicializa o Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Inicializa o serviço do Storage
export const functions = getFunctions(app, 'southamerica-east1'); // Especificando a região
export const messaging = (typeof window !== 'undefined') ? getMessaging(app) : null;

// Habilita a persistência de dados offline
if (typeof window !== 'undefined') {
  try {
    enableIndexedDbPersistence(db)
      .catch((err) => {
        if (err.code == 'failed-precondition') {
          console.warn("Múltiplas abas abertas, a persistência pode não funcionar corretamente.");
        } else if (err.code == 'unimplemented') {
          console.warn("O navegador não suporta persistência offline.");
        }
      });
  } catch (error) {
    console.error("Erro ao habilitar a persistência do Firestore", error);
  }
}

// Exporta tudo para ser usado em outras partes do aplicativo
export { app, auth, db, storage };