import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth, browserLocalPersistence, setPersistence, GoogleAuthProvider } from "firebase/auth";
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore 
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, type Functions } from "firebase/functions";
import { getMessaging, type Messaging } from "firebase/messaging";
import { getDatabase, type Database } from "firebase/database";

const firebaseConfig = {
  projectId: "appterritorios-e5bb5",
  appId: "1:83629039662:web:42d410f411b2e9b33fffbf",
  apiKey: "AIzaSyBKW1da2xBNH0TCrW0AoSbbGgX8-HI8WSI",
  authDomain: "appterritorios-e5bb5.firebaseapp.com",
  messagingSenderId: "83629039662",
  storageBucket: "appterritorios-e5bb5.appspot.com",
  databaseURL: "https://appterritorios-e5bb5-default-rtdb.firebaseio.com",
};

// Inicializa o Firebase
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Configuração Offline do Firestore (A parte mais importante)
const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    // Permite que o cache funcione em múltiplas abas simultaneamente
    tabManager: persistentMultipleTabManager()
  })
});

const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);
const functions: Functions = getFunctions(app, 'southamerica-east1');
const rtdb: Database = getDatabase(app);

// Persistência de login: Mantém logado mesmo offline ou ao fechar o app
setPersistence(auth, browserLocalPersistence);

let messaging: Messaging | null = null;
if (typeof window !== 'undefined') {
    try {
        messaging = getMessaging(app);
    } catch (error) {
        console.warn("Firebase Messaging não suportado neste ambiente.");
    }
}

export { app, auth, db, storage, functions, messaging, rtdb, GoogleAuthProvider };
