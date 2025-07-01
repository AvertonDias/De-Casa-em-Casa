import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  CACHE_SIZE_UNLIMITED,
  persistentLocalCache,
  Firestore,
  getFirestore,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getMessaging } from "firebase/messaging";

// Simplesmente montamos o objeto de configuração a partir das variáveis de ambiente.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');
export const messaging = (typeof window !== 'undefined') ? getMessaging(app) : null;

// Usamos uma variável para armazenar a instância do DB para que não seja reinicializada.
let db: Firestore;

// A inicialização do DB agora é mais robusta.
// No servidor (SSR), usamos getFirestore() normalmente.
// No cliente, tentamos inicializar com persistência.
// Isso evita que a chamada que usa IndexedDB (persistentLocalCache) quebre no lado do servidor.
if (typeof window === "undefined") {
  db = getFirestore(app);
} else {
  // A verificação `!db` evita reinicializações desnecessárias.
  if (!db) {
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          cacheSizeBytes: CACHE_SIZE_UNLIMITED,
        }),
      });
      console.log("Persistência do Firestore habilitada com sucesso!");
    } catch (err: any) {
      if (err.code === 'failed-precondition') {
        console.warn("Persistência do Firestore falhou: múltiplas abas abertas. Usando instância normal.");
      } else if (err.code === 'unimplemented') {
        console.warn("Persistência do Firestore não é suportada neste navegador. Usando instância normal.");
      } else {
        console.error("Erro ao habilitar a persistência do Firestore:", err);
      }
      // Se a inicialização com persistência falhar, usamos a instância padrão como fallback.
      db = getFirestore(app);
    }
  }
}

export { db };
