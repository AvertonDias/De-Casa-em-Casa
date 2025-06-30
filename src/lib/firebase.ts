import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Configuração das credenciais, lidas do ambiente
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Variável para guardar a instância do app (padrão Singleton)
let app: FirebaseApp;

// --- A MUDANÇA CRÍTICA ESTÁ AQUI ---
// Criamos uma função para inicializar e obter o app.
// Isso garante que a verificação e a inicialização só aconteçam quando chamadas.
const getFirebaseApp = () => {
  if (!getApps().length) {
    // 1. Verificamos as credenciais ANTES de inicializar
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("SUA_")) {
        throw new Error("AÇÃO NECESSÁRIA: Suas credenciais do Firebase estão faltando. Configure as Variáveis de Ambiente na Vercel para continuar.");
    }
    // 2. Inicializamos o app
    app = initializeApp(firebaseConfig);
  } else {
    // 3. Se já foi inicializado, apenas o pegamos
    app = getApp();
  }
  return app;
};

// Agora, exportamos os serviços já inicializados
const firebaseApp = getFirebaseApp();
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const functions = getFunctions(firebaseApp, 'us-central1');