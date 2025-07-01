import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enablePersistence, CACHE_SIZE_UNLIMITED } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getMessaging } from "firebase/messaging";

// Simplesmente montamos o objeto de configuração a partir das variáveis de ambiente.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');
export const db = getFirestore(app);
export const messaging = (typeof window !== 'undefined') ? getMessaging(app) : null;

// Habilitando a persistência offline do Firestore
(async () => {
    if (typeof window !== 'undefined') {
        try {
            await enablePersistence(db, {
                synchronizeTabs: true, 
                cacheSizeBytes: CACHE_SIZE_UNLIMITED 
            });
            console.log("Persistência do Firestore habilitada com sucesso!");
        } catch (err: any) {
            if (err.code == 'failed-precondition') {
                console.warn("Persistência do Firestore falhou: múltiplas abas abertas ou inicialização em aba inativa.");
            } else if (err.code == 'unimplemented') {
                console.warn("Persistência do Firestore não é suportada neste navegador.");
            } else {
                console.error("Erro ao habilitar a persistência do Firestore:", err);
            }
        }
    }
})();
