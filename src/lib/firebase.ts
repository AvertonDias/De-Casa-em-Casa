import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  CACHE_SIZE_UNLIMITED,
  Firestore // Importamos o tipo Firestore
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

// Inicializações que funcionam em qualquer ambiente
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');
export const messaging = (typeof window !== 'undefined') ? getMessaging(app) : null;

// ▼▼▼ MUDANÇA CRÍTICA: INICIALIZAÇÃO SEGURA DO FIRESTORE ▼▼▼

// Declaramos a variável 'db' que vai guardar nossa instância do Firestore.
let db: Firestore;

// Verificamos se estamos no ambiente do NAVEGADOR.
if (typeof window !== 'undefined') {
  try {
    // Se estamos no navegador, inicializamos o Firestore COM persistência.
    db = initializeFirestore(app, {
        localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED })
    });
    console.log("Firestore inicializado com persistência offline.");
  } catch (e) {
    console.error("Não foi possível inicializar o Firestore com persistência, usando o padrão.", e);
    // Se a inicialização com cache falhar, usamos o getFirestore padrão.
    db = getFirestore(app);
  }
} else {
  // Se estamos no SERVIDOR, usamos o getFirestore padrão (que não tem persistência).
  db = getFirestore(app);
}

// Exportamos a instância 'db' que agora temos certeza que foi inicializada.
export { db };
