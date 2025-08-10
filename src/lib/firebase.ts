// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getMessaging } from "firebase/messaging";
import { getDatabase } from "firebase/database";

// Objeto de configuração completo e correto para o projeto appterritorios-e5bb5.
const firebaseConfig = {
  apiKey: "AIzaSyBu4-CY52oi93-g611yCgvqEkd8vb5Jaa0",
  authDomain: "appterritorios-e5bb5.firebaseapp.com",
  projectId: "appterritorios-e5bb5",
  storageBucket: "appterritorios-e5bb5.appspot.com",
  messagingSenderId: "83629039662",
  appId: "1:83629039662:web:72832b87617b7468b31778",
  databaseURL: "https://appterritorios-e5bb5.firebaseio.com",
};

// Inicializa o Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'southamerica-east1');
const messaging = (typeof window !== 'undefined') ? getMessaging(app) : null;
const rtdb = getDatabase(app);

// Habilita a persistência de dados offline
if (typeof window !== 'undefined') {
  try {
    enableIndexedDbPersistence(db)
      .catch((err) => {
        if (err.code == 'failed-precondition') {
          console.warn("Múltiplas abas abertas, a persistência pode não funcionar corretamente.");
        } else if (err.code == 'unimplemented') {
          console.warn("O navegador não suporta persistência offline.");
        }
      });
  } catch (error) {
    console.error("Erro ao habilitar a persistência do Firestore", error);
  }
}

// Exporta tudo para ser usado em outras partes do aplicativo
export { app, auth, db, storage, functions, messaging, rtdb };
