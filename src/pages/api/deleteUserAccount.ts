
// src/pages/api/deleteUserAccount.ts
import type { NextApiRequest, NextApiResponse } from "next";
import admin from "firebase-admin";
import { EmailAuthProvider } from "firebase-admin/auth";

// --- Função para inicialização segura do Firebase Admin ---
function initializeAdmin() {
  if (admin.apps.length > 0) {
    return admin;
  }
  try {
    const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!serviceAccountJson) {
      throw new Error("A variável de ambiente GOOGLE_APPLICATION_CREDENTIALS_JSON não está definida.");
    }
    const serviceAccount = JSON.parse(Buffer.from(serviceAccountJson, 'base64').toString('utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return admin;
  } catch (error: any) {
    console.error("Falha ao inicializar o Firebase Admin SDK:", error);
    return null;
  }
}
// --- Fim da Inicialização ---


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminInstance = initializeAdmin();
  if (!adminInstance) {
    return res.status(500).json({ error: "Firebase Admin SDK não inicializado corretamente." });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }

  let callingUserUid;
  try {
    const decodedToken = await adminInstance.auth().verifyIdToken(idToken);
    callingUserUid = decodedToken.uid;
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
  
  const { userIdToDelete, password } = req.body;
  if (!userIdToDelete || typeof userIdToDelete !== 'string') {
    return res.status(400).json({ error: 'ID de usuário para exclusão é inválido.' });
  }
  
  try {
    const callingUserSnap = await adminInstance.firestore().doc(`users/${callingUserUid}`).get();
    const isCallingUserAdmin = callingUserSnap.exists && callingUserSnap.data()?.role === "Administrador";

    // Regra 1: Admin não pode se autoexcluir via esta rota.
    if (isCallingUserAdmin && callingUserUid === userIdToDelete) {
      return res.status(403).json({ error: "Um administrador não pode se autoexcluir." });
    }
    
    // Regra 2: Usuário normal só pode se autoexcluir E deve fornecer a senha
    if (!isCallingUserAdmin && callingUserUid === userIdToDelete) {
        if (!password) {
            return res.status(400).json({ error: "Senha necessária para autoexclusão." });
        }
        // A reautenticação acontece no frontend, aqui só confiamos no token já verificado.
    }
    
    // Regra 3: Admin pode excluir outros (não precisa de senha)
    if (!isCallingUserAdmin && callingUserUid !== userIdToDelete) {
        return res.status(403).json({ error: "Você não tem permissão para excluir este usuário." });
    }
    
    // Excluir da Auth
    await adminInstance.auth().deleteUser(userIdToDelete);
    
    // Excluir do Firestore
    const userDocRef = adminInstance.firestore().doc(`users/${userIdToDelete}`);
    if ((await userDocRef.get()).exists) {
      await userDocRef.delete();
    }

    return res.status(200).json({ success: true, message: "Usuário excluído com sucesso." });
    
  } catch (error: any) {
    console.error("Erro na API deleteUserAccount:", error);
    if (error.code === 'auth/user-not-found') {
        const userDocRef = adminInstance.firestore().doc(`users/${userIdToDelete}`);
        if ((await userDocRef.get()).exists) {
            await userDocRef.delete();
        }
        return res.status(200).json({ success: true, message: "Usuário não encontrado na Auth, mas removido do Firestore." });
    }
    return res.status(500).json({ error: error.message || "Erro interno do servidor." });
  }
}
