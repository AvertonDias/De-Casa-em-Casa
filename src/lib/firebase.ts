// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, initializeFirestore, CACHE_SIZE_UNLIMITED, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, type Functions } from "firebase/functions";
import { getMessaging, type Messaging } from "firebase/messaging";
import { getDatabase, type Database } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBKW1da2xBNH0TCrW0AoSbbGgX8-HI8WSI",
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

// Inicialização do Firestore com a nova configuração de cache
let db: Firestore;

if (typeof window !== 'undefined') {
    try {
        db = initializeFirestore(app, {
            cache: {
                kind: 'indexeddb',
                cacheSizeBytes: CACHE_SIZE_UNLIMITED,
                synchronizeTabs: true
            }
        });
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
