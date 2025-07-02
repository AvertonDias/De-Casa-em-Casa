import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  browserLocalPersistence, // Importa o tipo de persistência desejado
  initializeAuth // Nova função para inicialização com persistência
} from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  CACHE_SIZE_UNLIMITED,
  Firestore
} from "firebase/firestore";

// As outras importações continuam as mesmas...
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

// --- INICIALIZAÇÃO SEGURA E CONDICIONAL DOS SERVIÇOS ---

let authInstance: any;
let dbInstance: Firestore;

// Verificamos se estamos no NAVEGADOR antes de inicializar serviços de cliente
if (typeof window !== 'undefined') {
  
  // ▼▼▼ CORREÇÃO PARA O LOGIN PERSISTENTE ▼▼▼
  // Inicializa o Auth com a persistência de armazenamento local.
  authInstance = initializeAuth(app, {
    persistence: browserLocalPersistence
  });
  console.log("Autenticação configurada para persistência local.");

  // ▼▼▼ CORREÇÃO PARA O MODO OFFLINE ▼▼▼
  // Inicializa o Firestore com o cache offline.
  try {
    dbInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED })
    });
    console.log("Firestore inicializado com persistência offline.");
  } catch (e) {
    console.error("Persistência do Firestore falhou, usando o padrão.", e);
    dbInstance = getFirestore(app);
  }

} else {
  // Se estamos no SERVIDOR, inicializamos as versões padrão sem persistência.
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
}

export const auth = authInstance;
export const db = dbInstance;
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');
export const messaging = (typeof window !== 'undefined') ? getMessaging(app) : null;