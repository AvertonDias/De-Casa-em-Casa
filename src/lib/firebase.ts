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

// Configuração do Firebase
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

const DEV_FALLBACK_CONFIG = {
  projectId: "appterritorios-e5bb5",
  appId: "1:83629039662:web:028e1dc87bdd41f73fffbf",
  apiKey: "AIzaSyBKW1da2xBNH0TCrW0AoSbbGgX8-HI8WSI",
  authDomain: "appterritorios-e5bb5.firebaseapp.com",
  messagingSenderId: "83629039662",
  storageBucket: "appterritorios-e5bb5.firebasestorage.app",
  databaseURL: "https://appterritorios-e5bb5-default-rtdb.firebaseio.com",
};

const missingKeys = [
  !projectId && "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  !appId && "NEXT_PUBLIC_FIREBASE_APP_ID",
  !apiKey && "NEXT_PUBLIC_FIREBASE_API_KEY",
  !authDomain && "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  !messagingSenderId && "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  !storageBucket && "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  !databaseURL && "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
].filter((k): k is string => Boolean(k));

if (missingKeys.length > 0) {
  console.warn(
    `[firebase.ts] Usando configuração de fallback porque as variáveis a seguir não estão definidas: ${missingKeys.join(", ")}.`
  );
}

const firebaseConfig = {
  projectId: projectId || DEV_FALLBACK_CONFIG.projectId,
  appId: appId || DEV_FALLBACK_CONFIG.appId,
  apiKey: apiKey || DEV_FALLBACK_CONFIG.apiKey,
  authDomain: authDomain || DEV_FALLBACK_CONFIG.authDomain,
  messagingSenderId: messagingSenderId || DEV_FALLBACK_CONFIG.messagingSenderId,
  storageBucket: storageBucket || DEV_FALLBACK_CONFIG.storageBucket,
  databaseURL: databaseURL || DEV_FALLBACK_CONFIG.databaseURL,
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