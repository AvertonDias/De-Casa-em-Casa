import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Suas credenciais, que estão corretas.
const firebaseConfig = {
  // SUBSTITUA PELAS SUAS CREDENCIAIS REAIS DO PROJETO FIREBASE
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Nenhuma mudança nestas linhas
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// --- A CORREÇÃO CRÍTICA FINAL ESTÁ AQUI ---
// Estamos explicitamente dizendo ao serviço de Functions para se conectar à
// região 'us-central1', que é onde a sua função foi publicada.
// Isso garante que a autenticação seja tratada corretamente na chamada.
export const functions = getFunctions(app, 'us-central1');