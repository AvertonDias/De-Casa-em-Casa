import { https, setGlobalOptions, pubsub } from "firebase-functions/v2";
import { onDocumentWritten, onDocumentDeleted, onDocumentCreated } from "firebase-functions/v2/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import * as admin from "firebase-admin";
import { format } from 'date-fns';
import { randomBytes } from 'crypto';
import * as cors from "cors";
import { AppUser, Notification, Territory } from "./types";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
setGlobalOptions({ region: "southamerica-east1" });

const corsHandler = cors({ origin: true });

// ========================================================================
//   FUNÇÕES HTTPS
// ========================================================================

export const createCongregationAndAdmin = https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp } = req.body;
    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    let newUser: admin.auth.UserRecord | undefined;

    try {
      const existing = await db.collection('congregations').where('number', '==', congregationNumber).get();
      if (!existing.empty) return res.status(409).json({ error: 'Número da congregação já existe.' });

      newUser = await admin.auth().createUser({ email: adminEmail, password: adminPassword, displayName: adminName });

      const batch = db.batch();
      const congRef = db.collection('congregations').doc();
      batch.set(congRef, {
        name: congregationName,
        number: congregationNumber,
        territoryCount: 0, ruralTerritoryCount: 0, totalQuadras: 0, totalHouses: 0, totalHousesDone: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdate: admin.firestore.FieldValue.serverTimestamp()
      });

      batch.set(db.collection("users").doc(newUser.uid), {
        name: adminName,
        email: adminEmail,
        whatsapp,
        congregationId: congRef.id,
        role: "Administrador",
        status: "ativo"
      });

      await batch.commit();
      res.status(200).json({ success: true, userId: newUser.uid, message: 'Congregação criada com sucesso!' });

    } catch (error: any) {
      if (newUser) await admin.auth().deleteUser(newUser.uid).catch(console.error);
      console.error("Erro createCongregationAndAdmin:", error);
      const codeMap: Record<string,string> = { 'auth/email-already-exists': 'Este e-mail já está em uso.' };
      res.status(500).json({ error: codeMap[error.code] || error.message || 'Erro interno' });
    }
  });
});

export const requestPasswordReset = https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mail obrigatório.' });

    try {
      await admin.auth().getUserByEmail(email);
      const token = randomBytes(32).toString("hex");
      const expires = admin.firestore.Timestamp.fromMillis(Date.now() + 3600*1000);
      await db.collection("resetTokens").doc(token).set({ email, expires });
      res.status(200).json({ success: true, token });
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') return res.status(200).json({ success: true, token: null });
      console.error("Erro requestPasswordReset:", error);
      res.status(500).json({ error: 'Falha ao processar pedido de redefinição.' });
    }
  });
});

export const resetPasswordWithToken = https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: "Token e nova senha obrigatórios." });
    if (newPassword.length < 6) return res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres." });

    const tokenRef = db.collection("resetTokens").doc(token);
    try {
      const tokenDoc = await tokenRef.get();
      if (!tokenDoc.exists) return res.status(404).json({ error: "Token inválido ou já usado." });

      const tokenData = tokenDoc.data()!;
      if (tokenData.expires.toMillis() < Date.now()) { await tokenRef.delete(); return res.status(410).json({ error: "Token expirado." }); }

      const user = await admin.auth().getUserByEmail(tokenData.email);
      await admin.auth().updateUser(user.uid, { password: newPassword });
      await tokenRef.delete();
      res.status(200).json({ success: true, message: "Senha redefinida com sucesso." });
    } catch (error: any) {
      console.error("Erro resetPasswordWithToken:", error);
      res.status(500).json({ error: "Erro interno ao redefinir senha." });
    }
  });
});

export const deleteUserAccount = https.onCall(async (request) => {
  if (!request.auth) throw new https.HttpsError('unauthenticated', 'Ação não autorizada.');
  const callingUserUid = request.auth.uid;
  const userIdToDelete = request.data.userIdToDelete;
  if (!userIdToDelete) throw new https.HttpsError('invalid-argument', 'ID do usuário é necessário.');

  const callingUserData = (await db.doc(`users/${callingUserUid}`).get()).data() as AppUser;
  if (callingUserData.role !== 'Administrador' && callingUserUid !== userIdToDelete)
      throw new https.HttpsError('permission-denied', 'Sem permissão para excluir outros usuários.');
  if (callingUserData.role === 'Administrador' && callingUserUid === userIdToDelete)
      throw new https.HttpsError('permission-denied', 'Administrador não pode se autoexcluir.');

  try {
    await admin.auth().deleteUser(userIdToDelete);
    await db.doc(`users/${userIdToDelete}`).delete();
    return { success: true, message: 'Usuário excluído com sucesso.' };
  } catch (error: any) {
    console.error('Erro CRÍTICO ao excluir usuário:', error);
    if (error.code === 'auth/user-not-found') {
      await db.doc(`users/${userIdToDelete}`).delete();
      return { success: true, message: 'Usuário não encontrado na Auth, mas removido do Firestore.' };
    }
    throw new https.HttpsError('internal', error.message || 'Falha ao excluir usuário.');
  }
});
