"use server";

// src/lib/firebaseAdmin.ts
import * as adminNamespace from "firebase-admin";

function resolveAdmin() {
  const namespaceObj: any = adminNamespace;
  const defaultObj: any = namespaceObj?.default;

  // Diagnóstico completo para depuração em produção
  console.log("[Firebase Admin Interop] Namespace keys:", namespaceObj ? Object.keys(namespaceObj) : "null");
  console.log("[Firebase Admin Interop] Default keys:", defaultObj ? Object.keys(defaultObj) : "null");

  // Se o defaultObj contiver as funções principais do Firebase Admin, ele é o objeto correto (comum em ESM/Webpack)
  if (defaultObj && (defaultObj.credential || defaultObj.initializeApp)) {
    console.log("[Firebase Admin Interop] Resolvido usando .default");
    return defaultObj;
  }

  // Se o namespaceObj contiver as funções principais, usamos ele diretamente
  if (namespaceObj && (namespaceObj.credential || namespaceObj.initializeApp)) {
    console.log("[Firebase Admin Interop] Resolvido usando namespaceObj direto");
    return namespaceObj;
  }

  // Fallback seguro
  console.log("[Firebase Admin Interop] Usando fallback .default || namespaceObj");
  return defaultObj || namespaceObj;
}

const admin: any = resolveAdmin();

/**
 * Inicializa o SDK Admin do Firebase.
 * Esta função é robusta e consegue tratar a variável de ambiente GOOGLE_APPLICATION_CREDENTIALS_JSON
 * tanto em formato string JSON pura quanto em Base64.
 */
export async function initializeAdmin() {
  if (!admin) {
    console.error("Não foi possível carregar o módulo firebase-admin.");
    return { admin: null, error: new Error("Módulo firebase-admin é nulo ou indefinido") };
  }

  const apps = admin.apps || (adminNamespace as any).apps || (adminNamespace as any).default?.apps || [];
  if (apps.length > 0) {
    return { admin, error: null };
  }

  try {
    // Tenta encontrar o JSON de credenciais em múltiplas variáveis de ambiente comuns
    const serviceAccountJson = 
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || 
      process.env.GOOGLE_APPLICATION_CREDENTIALS || 
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.FIREBASE_SERVICE_ACCOUNT;

    const credentialHelper = admin.credential || (adminNamespace as any).credential || (adminNamespace as any).default?.credential;
    const initializeAppFn = admin.initializeApp || (adminNamespace as any).initializeApp || (adminNamespace as any).default?.initializeApp;

    if (!serviceAccountJson) {
      // Se não há variável de ambiente com o JSON e estamos na Vercel / ambiente sem ADC nativo
      if (process.env.VERCEL || !process.env.K_SERVICE) {
        console.warn("[FirebaseAdmin] Variável GOOGLE_APPLICATION_CREDENTIALS_JSON não está definida no ambiente da Vercel.");
        return { 
          admin: null, 
          error: new Error("A variável de ambiente GOOGLE_APPLICATION_CREDENTIALS_JSON não foi configurada na Vercel.") 
        };
      }

      // Tenta inicializar com a credencial padrão da aplicação (ADC) se estiver rodando no GCP / Cloud Run
      try {
        if (!credentialHelper || !initializeAppFn) {
          throw new Error("Membros credential ou initializeApp não encontrados no Firebase Admin.");
        }

        initializeAppFn({
          credential: credentialHelper.applicationDefault(),
          databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
        });
        console.log("Firebase Admin SDK inicializado usando Application Default Credentials.");
        return { admin, error: null };
      } catch (defaultErr: any) {
        return {
          admin: null,
          error: new Error(
            "Nenhuma variável de credenciais do Firebase foi encontrada (GOOGLE_APPLICATION_CREDENTIALS_JSON) " +
            "e falhou ao tentar carregar a credencial padrão: " + defaultErr.message
          )
        };
      }
    }

    let serviceAccount: any;
    
    // Tenta detectar se a string é um JSON direto ou se está codificada em Base64
    const trimmedJson = serviceAccountJson.trim();
    if (trimmedJson.startsWith('{')) {
      // Se começar com {, tratamos como JSON direto
      serviceAccount = JSON.parse(trimmedJson);
    } else {
      // Caso contrário, tenta decodificar de Base64
      try {
        serviceAccount = JSON.parse(Buffer.from(trimmedJson, 'base64').toString('utf8'));
      } catch (base64Err: any) {
        // Se falhar ao decodificar Base64 e não começa com {, pode ser um caminho de arquivo de credencial do Google
        // Nesse caso, se o arquivo existir, podemos deixar o Firebase Admin tentar ler pelo caminho (usando o caminho na inicialização padrão)
        if (trimmedJson.endsWith('.json')) {
          try {
            if (!initializeAppFn) {
              throw new Error("Função initializeApp não encontrada no Firebase Admin.");
            }
            initializeAppFn({
              databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
            });
            console.log("Firebase Admin SDK inicializado apontando para o arquivo de credenciais padrão em disco.");
            return { admin, error: null };
          } catch (fileErr: any) {
            throw new Error(`Variável aponta para arquivo JSON, mas falhou ao inicializar: ${fileErr.message}`);
          }
        }
        throw new Error(`Não foi possível decodificar as credenciais. Erro: ${base64Err.message}`);
      }
    }
    
    // Validar as propriedades mínimas de uma service account para ajudar no diagnóstico
    const requiredKeys = ['project_id', 'private_key', 'client_email'];
    const missingKeys = requiredKeys.filter(k => !serviceAccount[k]);
    if (missingKeys.length > 0) {
      throw new Error(`O JSON de credenciais está incompleto. Faltam as chaves: ${missingKeys.join(', ')}`);
    }

    // Correção CRÍTICA para a Vercel e outros ambientes de produção:
    // Às vezes as quebras de linha '\n' da private_key são escapadas como '\\n' (string literal de duas barras e um n).
    // Precisamos substituir '\\n' por '\n' real para que a chave privada PEM seja válida.
    if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    if (!credentialHelper || !initializeAppFn) {
      throw new Error("Membros credential ou initializeApp não encontrados no Firebase Admin ao tentar inicializar com cert.");
    }

    initializeAppFn({
      credential: credentialHelper.cert(serviceAccount),
      // O databaseURL é necessário para o Realtime Database via Admin SDK
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    });
    
    console.log("Firebase Admin SDK inicializado com sucesso usando credenciais JSON estruturadas.");
    return { admin, error: null };

  } catch (error: any) {
    console.error("Falha CRÍTICA ao inicializar o Firebase Admin SDK:", error);
    return { admin: null, error };
  }
}
