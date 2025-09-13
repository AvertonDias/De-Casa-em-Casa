// src/pages/api/sendOverdueNotification.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { adminFirestore, adminMessaging, adminAuth } from "@/lib/firebaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificação de inicialização do Admin SDK
  if (!adminFirestore || !adminMessaging || !adminAuth) {
    return res.status(500).json({ error: "O Firebase Admin SDK não foi inicializado corretamente. Verifique as credenciais do servidor." });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verificação de autenticação do usuário que está chamando a API
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const callingUserUid = decodedToken.uid;
    
    const callingUserDoc = await adminFirestore.doc(`users/${callingUserUid}`).get();
    const callingUserData = callingUserDoc.data();

    if (!callingUserData || !['Administrador', 'Dirigente'].includes(callingUserData.role)) {
      return res.status(403).json({ error: 'Você não tem permissão para realizar esta ação.' });
    }

  } catch (error) {
    console.error("Erro na verificação do token de autenticação:", error);
    return res.status(401).json({ error: 'Token de autenticação inválido ou expirado.' });
  }
  
  // Lógica principal da função
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
      return res.status(200).json({ success: true, message: "O usuário não possui dispositivos registrados para receber notificações." });
    }

    const message = { notification: { title, body }, tokens };

    const response = await adminMessaging.sendMulticast(message);

    // Limpeza de tokens inválidos
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
    });

  } catch (error: any) {
    console.error("Erro ao enviar notificação (lógica principal):", error);
    res.status(500).json({ error: error.message || "Erro interno do servidor ao processar a notificação." });
  }
}
