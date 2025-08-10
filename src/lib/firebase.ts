// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// ATUALIZADO: Importa initializeFirestore e persistentLocalCache em vez de getFirestore e enableIndexedDbPersistence
import { initializeFirestore, persistentLocalCache, memoryLocalCache } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getMessaging } from "firebase/messaging";
import { getDatabase } from "firebase/database";

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
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
// ATUALIZADO: A inicialização do Firestore agora configura a persistência diretamente.
const db = initializeFirestore(app, {
  localCache: (typeof window !== 'undefined')
    ? persistentLocalCache({
        // Configurações opcionais do cache, se necessário
      })
    : memoryLocalCache(), // Usa cache em memória no servidor
});

const storage = getStorage(app);
const functions = getFunctions(app, 'southamerica-east1');
const messaging = (typeof window !== 'undefined') ? getMessaging(app) : null;
const rtdb = getDatabase(app);


// Exporta tudo para ser usado em outras partes do aplicativo
export { app, auth, db, storage, functions, messaging, rtdb };
