// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, type Functions } from "firebase/functions";
import { getMessaging, type Messaging } from "firebase/messaging";
import { getDatabase, type Database } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "appterritorios-e5bb5.firebaseapp.com",
  databaseURL: "https://appterritorios-e5bb5-default-rtdb.firebaseio.com",
  projectId: "appterritorios-e5bb5",
  storageBucket: "appterritorios-e5bb5.appspot.com",
  messagingSenderId: "83629039662",
  appId: "1:83629039662:web:028e1dc87bdd41f73fffbf"
};


// Inicializa o Firebase
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);
const functions: Functions = getFunctions(app, 'southamerica-east1');
const messaging: Messaging | null = (typeof window !== 'undefined') ? getMessaging(app) : null;
const rtdb: Database = getDatabase(app);

// Inicialização robusta do Firestore com cache offline de 100MB
const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({ 
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: 100 * 1024 * 1024 // 100 MB
  })
});


// Exporta tudo para ser usado em outras partes do aplicativo
export { app, auth, db, storage, functions, messaging, rtdb };
