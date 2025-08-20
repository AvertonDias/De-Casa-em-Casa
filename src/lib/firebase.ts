// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, CACHE_SIZE_UNLIMITED } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getMessaging } from "firebase/messaging";
import { getDatabase } from "firebase/database";

// O objeto de configuração agora lê as variáveis de ambiente seguras.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: `https://appterritorios-e5bb5-default-rtdb.firebaseio.com`,
};

// Inicializa o Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'southamerica-east1');
const messaging = (typeof window !== 'undefined') ? getMessaging(app) : null;
const rtdb = getDatabase(app);

// Inicialização do Firestore com a nova configuração de cache
let db;
if (typeof window !== 'undefined') {
    try {
        db = initializeFirestore(app, {
            cache: {
                kind: 'indexeddb',
                cacheSizeBytes: CACHE_SIZE_UNLIMITED,
                synchronizeTabs: true
            }
        });
        console.log("Firestore inicializado com persistência offline e sincronização de abas.");
    } catch (error) {
        console.error("Erro ao inicializar Firestore com persistência, usando configuração padrão.", error);
        db = getFirestore(app);
    }
} else {
    // Para renderização no lado do servidor, não há persistência
    db = getFirestore(app);
}


// Exporta tudo para ser usado em outras partes do aplicativo
export { app, auth, db, storage, functions, messaging, rtdb };
