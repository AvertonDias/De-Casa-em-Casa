// src/pages/api/deleteUserAccount.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { initializeAdmin } from "@/lib/firebaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = initializeAdmin();
  if (!admin) {
    return res.status(500).json({ error: "Firebase Admin SDK não foi inicializado." });
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
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    callingUserUid = decodedToken.uid;
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
  
  const { userIdToDelete } = req.body;
  if (!userIdToDelete || typeof userIdToDelete !== 'string') {
    return res.status(400).json({ error: 'ID de usuário para exclusão é inválido.' });
  }
  
  try {
    const callingUserSnap = await admin.firestore().doc(`users/${callingUserUid}`).get();
    const isCallingUserAdmin = callingUserSnap.exists && callingUserSnap.data()?.role === "Administrador";

    if (isCallingUserAdmin && callingUserUid === userIdToDelete) {
      return res.status(403).json({ error: "Um administrador não pode se autoexcluir." });
    }
    if (!isCallingUserAdmin) { // Apenas admin pode deletar
        return res.status(403).json({ error: "Você não tem permissão para excluir este usuário." });
    }

    // Excluir da Auth
    await admin.auth().deleteUser(userIdToDelete);
    
    // Excluir do Firestore
    const userDocRef = admin.firestore().doc(`users/${userIdToDelete}`);
    if ((await userDocRef.get()).exists) {
      await userDocRef.delete();
    }

    return res.status(200).json({ success: true, message: "Usuário excluído com sucesso." });
    
  } catch (error: any) {
    console.error("Erro na API deleteUserAccount:", error);
    if (error.code === 'auth/user-not-found') {
        const userDocRef = admin.firestore().doc(`users/${userIdToDelete}`);
        if ((await userDocRef.get()).exists) {
            await userDocRef.delete();
        }
        return res.status(200).json({ success: true, message: "Usuário não encontrado na Auth, mas removido do Firestore." });
    }
    return res.status(500).json({ error: error.message || "Erro interno do servidor." });
  }
}
