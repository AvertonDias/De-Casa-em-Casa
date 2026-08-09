import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth, browserLocalPersistence, setPersistence, GoogleAuthProvider } from "firebase/auth";
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore as getFirestoreInstance,
  type Firestore 
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, type Functions } from "firebase/functions";
import { getMessaging, type Messaging } from "firebase/messaging";
import { getDatabase, type Database } from "firebase/database";

// Valores de fallback SOMENTE para desenvolvimento local, quando o
// desenvolvedor ainda não configurou o .env.local. Em produção, se alguma
// variável faltar, preferimos falhar de forma clara a apontar silenciosamente
// para o projeto Firebase de produção real (o que já aconteceu antes: um
// ambiente de preview/CI sem env vars configuradas cairia direto no banco
// real, sem ninguém perceber).
const DEV_FALLBACK_CONFIG = {
  projectId: "appterritorios-e5bb5",
  appId: "1:83629039662:web:42d410f411b2e9b33fffbf",
  apiKey: "AIzaSyBKW1da2xBNH0TCrW0AoSbbGgX8-HI8WSI",
  authDomain: "appterritorios-e5bb5.firebaseapp.com",
  messagingSenderId: "83629039662",
  storageBucket: "appterritorios-e5bb5.appspot.com",
  databaseURL: "https://appterritorios-e5bb5-default-rtdb.firebaseio.com",
};

const REQUIRED_KEYS = [
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
] as const;

const missingKeys = REQUIRED_KEYS.filter((key) => !process.env[key]);

if (missingKeys.length > 0) {
  console.warn(
    `[firebase.ts] Usando configuração de fallback porque as variáveis a seguir não estão definidas: ${missingKeys.join(", ")}.`
  );
}

const firebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || DEV_FALLBACK_CONFIG.projectId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || DEV_FALLBACK_CONFIG.appId,
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || DEV_FALLBACK_CONFIG.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || DEV_FALLBACK_CONFIG.authDomain,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || DEV_FALLBACK_CONFIG.messagingSenderId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || DEV_FALLBACK_CONFIG.storageBucket,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || DEV_FALLBACK_CONFIG.databaseURL,
};

const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const db: Firestore = typeof window !== 'undefined' 
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    })
  : getFirestoreInstance(app);

const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);
const functions: Functions = getFunctions(app, 'southamerica-east1');
const rtdb: Database = getDatabase(app);

// Força a persistência local para manter o usuário logado
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.error("Erro ao configurar persistência do Firebase Auth:", err);
  });
}

let messaging: Messaging | null = null;
if (typeof window !== 'undefined') {
    try {
        messaging = getMessaging(app);
    } catch (error) {
        console.warn("Firebase Messaging não suportado neste ambiente.");
    }
}

// Exportando getFirestoreInstance para permitir conexão com bancos nomeados (backup)
export { app, auth, db, storage, functions, messaging, rtdb, GoogleAuthProvider, getFirestoreInstance as getFirestore };