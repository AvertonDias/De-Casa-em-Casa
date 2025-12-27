
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  type Firestore 
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, type Functions } from "firebase/functions";
import { getMessaging, type Messaging } from "firebase/messaging";
import { getDatabase, type Database } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  "projectId": "appterritorios-e5bb5",
  "appId": "1:83629039662:web:42d410f411b2e9b33fffbf",
  "apiKey": "AIzaSyBKW1da2xBNH0TCrW0AoSbbGgX8-HI8WSI",
  "authDomain": "appterritorios-e5bb5.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "83629039662",
  "storageBucket": "appterritorios-e5bb5.appspot.com",
  "databaseURL": "https://appterritorios-e5bb5-default-rtdb.firebaseio.com",
};


// Inicializa o Firebase
let app: FirebaseApp;
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

// Inicialização do Firestore com a nova abordagem de persistência
let db: Firestore;
try {
    db = initializeFirestore(app, {
      cache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
} catch (e: any) {
    // Se a inicialização falhar (ex: por já existir), apenas pegamos a instância
    if (e.code === 'failed-precondition') {
        console.warn("A persistência do Firestore falhou porque múltiplas abas estão abertas. A funcionalidade offline pode ser limitada.");
    } else if (e.code === 'unimplemented') {
        console.warn("Este navegador não suporta a persistência offline do Firestore.");
    }
    db = getFirestore(app);
}


const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);
const functions: Functions = getFunctions(app, 'southamerica-east1');
const rtdb: Database = getDatabase(app);

// Garante a persistência de login mais robusta
setPersistence(auth, browserLocalPersistence);


// Inicializa o Messaging apenas no lado do cliente
let messaging: Messaging | null = null;
if (typeof window !== 'undefined') {
    try {
        messaging = getMessaging(app);
    } catch (error) {
        console.error("Firebase Messaging não é suportado neste navegador.", error);
    }
}


// Exporta tudo para ser usado em outras partes do aplicativo
export { app, auth, db, storage, functions, messaging, rtdb };

