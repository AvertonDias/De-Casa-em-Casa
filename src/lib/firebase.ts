
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

const firebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "appterritorios-e5bb5",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:83629039662:web:42d410f411b2e9b33fffbf",
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBKW1da2xBNH0TCrW0AoSbbGgX8-HI8WSI",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "appterritorios-e5bb5.firebaseapp.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "83629039662",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "appterritorios-e5bb5.appspot.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://appterritorios-e5bb5-default-rtdb.firebaseio.com",
};

const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

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
