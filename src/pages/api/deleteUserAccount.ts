// src/pages/api/deleteUserAccount.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { initializeAdmin } from "@/lib/firebaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = initializeAdmin();
  if (!admin) {
    return res.status(500).json({ error: "Firebase Admin SDK não inicializado." });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const callingUserUid = decodedToken.uid;
    const { userIdToDelete } = req.body;

    if (!userIdToDelete) {
      return res.status(400).json({ error: 'ID do usuário para exclusão é necessário.' });
    }

    const callingUserDoc = await admin.firestore().doc(`users/${callingUserUid}`).get();
    if (!callingUserDoc.exists()) {
      return res.status(403).json({ error: 'Usuário chamador não encontrado.' });
    }

    const isCallingUserAdmin = callingUserDoc.data()?.role === 'Administrador';
    
    if (!isCallingUserAdmin && callingUserUid !== userIdToDelete) {
      return res.status(403).json({ error: 'Você não tem permissão para excluir outros usuários.' });
    }

    if (isCallingUserAdmin && callingUserUid === userIdToDelete) {
      return res.status(400).json({ error: 'Um administrador não pode se autoexcluir através desta API.' });
    }
    
    await admin.auth().deleteUser(userIdToDelete);
    
    const userDocRef = admin.firestore().doc(`users/${userIdToDelete}`);
    if ((await userDocRef.get()).exists) {
      await userDocRef.delete();
    }
    
    res.status(200).json({ success: true, message: 'Usuário excluído com sucesso.' });

  } catch (error: any) {
    console.error("Erro na API deleteUserAccount:", error);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: "Token expirado, por favor, faça login novamente." });
    }
    if (error.code === 'auth/user-not-found') {
      // Se o usuário já não existe no Auth, tenta remover do Firestore se ainda estiver lá
      try {
        const { userIdToDelete } = req.body;
        if(userIdToDelete){
          const userDocRef = admin.firestore().doc(`users/${userIdToDelete}`);
          if ((await userDocRef.get()).exists) {
            await userDocRef.delete();
          }
        }
      } catch(cleanupError){
        console.error("Erro no cleanup do Firestore:", cleanupError);
      }
      return res.status(200).json({ success: true, message: "Usuário já não existia no Auth, registro do Firestore limpo." });
    }

    return res.status(500).json({ error: error.message || 'Ocorreu um erro interno ao excluir o usuário.' });
  }
}
