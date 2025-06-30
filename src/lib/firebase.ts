import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Validação explícita das credenciais
const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

// Ação necessária do usuário:
// Este erro é intencional para impedir a execução sem as credenciais corretas.
// Se você está vendo este erro, significa que o arquivo .env.local na raiz do projeto
// precisa ser preenchido com as chaves reais do seu projeto Firebase.
if (!firebaseApiKey || firebaseApiKey.startsWith("SUA_")) {
  throw new Error("AÇÃO NECESSÁRIA: Suas credenciais do Firebase estão faltando. Abra o arquivo .env.local na raiz do projeto e preencha com as chaves reais do seu projeto Firebase para continuar.");
}

// As credenciais do Firebase agora são carregadas das variáveis de ambiente.
const firebaseConfig = {
  apiKey: firebaseApiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Conecta à região correta das Cloud Functions para evitar erros de autenticação.
export const functions = getFunctions(app, 'us-central1');
