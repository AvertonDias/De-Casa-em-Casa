// src/pages/api/sendOverdueNotification.ts
import type { NextApiRequest, NextApiResponse } from "next";
import admin from "@/lib/firebaseAdmin"; // Importa a referência do admin

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // --- Inicialização Segura do Firebase Admin ---
  if (!admin.apps.length) {
    try {
      const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
      if (!serviceAccountJson) {
        throw new Error("A variável de ambiente GOOGLE_APPLICATION_CREDENTIALS_JSON não está definida.");
      }
      const serviceAccount = JSON.parse(Buffer.from(serviceAccountJson, 'base64').toString('utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (error: any) {
      console.error("Falha ao inicializar o Firebase Admin SDK:", error);
      return res.status(500).json({ error: "Firebase Admin SDK não foi inicializado corretamente." });
    }
  }
  // --- Fim da Inicialização ---

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // A verificação de autenticação do chamador (opcional, mas recomendado)
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const callingUserDoc = await admin.firestore().doc(`users/${decodedToken.uid}`).get();
    if (!callingUserDoc.exists() || !['Administrador', 'Dirigente'].includes(callingUserDoc.data()?.role)) {
      return res.status(403).json({ error: 'Permissão negada.' });
    }
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }

  const { userId, title, body } = req.body;
  if (!userId || !title || !body) {
    return res.status(400).json({ error: "userId, title e body são obrigatórios" });
  }

  try {
    const userDocRef = admin.firestore().doc(`users/${userId}`);
    const userDoc = await userDocRef.get();
    const tokens: string[] = userDoc.data()?.fcmTokens || [];

    if (!tokens.length) {
      return res.status(200).json({ success: true, message: "O usuário não possui dispositivos registrados." });
    }

    const message = { notification: { title, body }, tokens };
    const response = await admin.messaging().sendMulticast(message);

    const invalidTokens: string[] = [];
    response.responses.forEach((r, idx) => {
      if (!r.success && (r.error?.code === 'messaging/registration-token-not-registered' || r.error?.code === 'messaging/invalid-argument')) {
        invalidTokens.push(tokens[idx]);
      }
    });

    if (invalidTokens.length > 0) {
      await userDocRef.update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens) });
    }

    return res.status(200).json({
      success: true,
      messageCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error: any) {
    console.error("Erro na API sendOverdueNotification:", error);
    return res.status(500).json({ error: error.message || "Erro interno do servidor." });
  }
}
