// src/pages/api/sendOverdueNotification.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { adminFirestore, adminMessaging } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verificação de autenticação
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const callingUserUid = decodedToken.uid;
    
    const callingUserDoc = await adminFirestore.doc(`users/${callingUserUid}`).get();
    const callingUserData = callingUserDoc.data();

    if (!callingUserData || !['Administrador', 'Dirigente'].includes(callingUserData.role)) {
      return res.status(403).json({ error: 'Você não tem permissão para realizar esta ação.' });
    }

  } catch (error) {
    return res.status(401).json({ error: 'Token de autenticação inválido.' });
  }


  const { userId, title, body } = req.body;

  if (!userId || !title || !body) {
    return res.status(400).json({ error: "userId, title e body são obrigatórios" });
  }

  try {
    const userDocRef = adminFirestore.doc(`users/${userId}`);
    const userDoc = await userDocRef.get();
    
    if(!userDoc.exists){
       return res.status(404).json({ error: "O usuário para o qual você está tentando notificar não foi encontrado." });
    }

    const tokens: string[] = userDoc.data()?.fcmTokens || [];

    if (!tokens.length) {
      return res.status(200).json({ message: "O usuário não possui dispositivos registrados para receber notificações." });
    }

    const message = { notification: { title, body }, tokens };

    const response = await adminMessaging.sendMulticast(message);

    // Tokens inválidos ou expirados serão removidos
    const invalidTokens: string[] = [];
    response.responses.forEach((r, idx) => {
      if (!r.success) {
        const errorCode = (r.error as any)?.code;
        if (errorCode === "messaging/registration-token-not-registered" ||
            errorCode === "messaging/invalid-argument") {
          invalidTokens.push(tokens[idx]);
        }
      }
    });

    if (invalidTokens.length) {
      await userDocRef.update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens)
      });
    }

    res.status(200).json({
      success: true,
      messageCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens,
    });

  } catch (error: any) {
    console.error("Erro ao enviar notificação:", error);
    res.status(500).json({ error: error.message || "Erro interno do servidor." });
  }
}
