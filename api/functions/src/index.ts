// src/functions/src/index.ts

import { https, setGlobalOptions, logger } from "firebase-functions/v2";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import admin from "firebase-admin";
import * as crypto from "crypto";
import type { AppUser } from "./types/types";
import cors from 'cors';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
setGlobalOptions({ region: "southamerica-east1" });

// Initialize CORS handler as per user instructions
const corsHandler = cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// ========================================================================
//   HTTPS onRequest Functions (with CORS)
// ========================================================================

export const getCongregationIdByNumberV2 = https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
        
        try {
            const { congregationNumber } = req.body.data;
            if (!congregationNumber) {
                res.status(400).json({ error: { message: "O número da congregação é obrigatório." } });
                return;
            }

            const congQuery = await db.collection("congregations").where("number", "==", congregationNumber).limit(1).get();
            if (congQuery.empty) {
                res.status(404).json({ error: { message: "Congregação não encontrada." } });
                return;
            }

            const congregationId = congQuery.docs[0].id;
            res.status(200).json({ data: { success: true, congregationId } });

        } catch (error) {
            logger.error("Erro em getCongregationIdByNumberV2:", error);
            res.status(500).json({ error: { message: "Erro interno do servidor." } });
        }
    });
});


export const createCongregationAndAdminV2 = https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

        try {
            const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp } = req.body.data;

            if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
                res.status(400).json({ error: { message: "Todos os campos são obrigatórios." } });
                return;
            }

            const congQuery = await db.collection("congregations").where("number", "==", congregationNumber).get();
            if (!congQuery.empty) {
                res.status(409).json({ error: { message: "Uma congregação com este número já existe." } });
                return;
            }

            const newUser = await admin.auth().createUser({ email: adminEmail, password: adminPassword, displayName: adminName });

            const batch = db.batch();
            const newCongregationRef = db.collection("congregations").doc();
            batch.set(newCongregationRef, {
                name: congregationName,
                number: congregationNumber,
                territoryCount: 0,
                ruralTerritoryCount: 0,
                totalQuadras: 0,
                totalHouses: 0,
                totalHousesDone: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
            });

            const userDocRef = db.collection("users").doc(newUser.uid);
            batch.set(userDocRef, {
                name: adminName,
                email: adminEmail,
                whatsapp: whatsapp,
                congregationId: newCongregationRef.id,
                role: "Administrador",
                status: "ativo",
            } as Omit<AppUser, 'uid'>);

            await batch.commit();
            res.status(200).json({ data: { success: true, userId: newUser.uid, message: "Congregação criada com sucesso!" } });

        } catch (error: any) {
            logger.error("Erro em createCongregationAndAdmin:", error);
            if (error.code === 'auth/email-already-exists') {
                res.status(409).json({ error: { message: "Este e-mail já está em uso." } });
            } else {
                res.status(500).json({ error: { message: error.message || "Erro interno no servidor" } });
            }
        }
    });
});

export const notifyOnNewUserV2 = https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

        try {
            const { newUserName, congregationId } = req.body.data;
            if (!newUserName || !congregationId) {
                res.status(400).json({ error: { message: "Dados insuficientes para notificação." } });
                return;
            }
            res.status(200).json({ data: { success: true, message: "Processo de notificação concluído (sem criar notificação no DB)." } });

        } catch (error: any) {
            logger.error("Erro no processo de notificação de novo usuário:", error);
            res.status(500).json({ error: { message: "Falha no processo de notificação." } });
        }
    });
});


export const requestPasswordResetV2 = https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
        
        try {
            const { email } = req.body.data;
            if (!email) {
                res.status(400).json({ error: { message: 'O e-mail é obrigatório.' } });
                return;
            }

            const user = await admin.auth().getUserByEmail(email);
            const token = crypto.randomUUID();
            const expires = Date.now() + 3600 * 1000; // 1 hora

            await db.collection("resetTokens").doc(token).set({
                uid: user.uid,
                expires: admin.firestore.Timestamp.fromMillis(expires),
            });
            res.status(200).json({ data: { success: true, token } });

        } catch (error: any) {
            if (error.code === "auth/user-not-found") {
                res.status(200).json({ data: { success: true, token: null, message: "Se o e-mail existir, um link será enviado." } });
            } else {
                logger.error("Erro ao gerar token de redefinição:", error);
                res.status(500).json({ error: { message: "Erro ao iniciar o processo de redefinição." } });
            }
        }
    });
});


export const resetPasswordWithTokenV2 = https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

        try {
            const { token, newPassword } = req.body.data;
            if (!token || !newPassword) {
                res.status(400).json({ error: { message: "Token e nova senha são obrigatórios." } });
                return;
            }

            const tokenRef = db.collection("resetTokens").doc(token);
            const tokenDoc = await tokenRef.get();

            if (!tokenDoc.exists) {
                res.status(404).json({ error: { message: "Token inválido ou já utilizado." } });
                return;
            }
            if (tokenDoc.data()?.expires.toMillis() < Date.now()) {
                await tokenRef.delete();
                res.status(410).json({ error: { message: "O token de redefinição expirou." } });
                return;
            }

            const uid = tokenDoc.data()?.uid;
            await admin.auth().updateUser(uid, { password: newPassword });
            await tokenRef.delete();
            res.status(200).json({ data: { success: true } });

        } catch (error: any) {
            logger.error("Erro ao redefinir senha com token:", error);
            res.status(500).json({ error: { message: "Falha ao atualizar a senha." } });
        }
    });
});

export const completeUserProfileV2 = https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        try {
            const idToken = req.headers.authorization?.split('Bearer ')[1];
            if (!idToken) {
                res.status(401).json({ error: { message: "Ação não autorizada. Token ausente." } });
                return;
            }

            const decodedToken = await admin.auth().verifyIdToken(idToken);
            const uid = decodedToken.uid;
            const name = decodedToken.name || 'Nome não encontrado';
            const email = decodedToken.email;

            const { congregationId, whatsapp } = req.body.data;

            if (!congregationId || !whatsapp || !email) {
                res.status(400).json({ error: { message: "Dados insuficientes para criar o perfil." } });
                return;
            }

            const userDocRef = db.collection("users").doc(uid);
            const userDoc = await userDocRef.get();

            if (userDoc.exists) {
                res.status(200).json({ data: { success: true, message: "Perfil já existe." } });
                return;
            }

            await userDocRef.set({
                name: name,
                email: email,
                whatsapp: whatsapp,
                congregationId: congregationId,
                role: "Publicador",
                status: "pendente",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                lastSeen: admin.firestore.FieldValue.serverTimestamp()
            });

            res.status(200).json({ data: { success: true, message: "Perfil de usuário criado com sucesso." } });

        } catch (error: any) {
            logger.error(`Erro ao completar perfil:`, error);
            if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
                 res.status(401).json({ error: { message: "Token de autenticação inválido ou expirado." } });
            } else {
                 res.status(500).json({ error: { message: error.message || "Falha ao criar perfil de usuário." } });
            }
        }
    });
});

export const deleteUserAccountV2 = https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        try {
            const idToken = req.headers.authorization?.split('Bearer ')[1];
            if (!idToken) {
                res.status(401).json({ error: { message: "Ação não autorizada. Token ausente." } });
                return;
            }
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            const callingUserUid = decodedToken.uid;
            
            const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
            const callingUserData = callingUserSnap.data();

            if (!callingUserData) {
                res.status(404).json({ error: { message: 'Usuário requisitante não encontrado.' } });
                return;
            }
            
            const { userIdToDelete } = req.body.data;
            if (!userIdToDelete) {
                res.status(400).json({ error: { message: 'ID do usuário a ser deletado é obrigatório.' } });
                return;
            }

            const isCallingUserAdmin = callingUserData.role === "Administrador";
            const isSelfDelete = callingUserUid === userIdToDelete;
            const isAdminDeletingOther = isCallingUserAdmin && !isSelfDelete;

            if (isCallingUserAdmin && isSelfDelete) {
                 res.status(403).json({ error: { message: 'Admin não pode se autoexcluir por esta função.' } });
                return;
            }

            if (!isSelfDelete && !isAdminDeletingOther) {
                res.status(403).json({ error: { message: 'Sem permissão para esta ação.' } });
                return;
            }

            await admin.auth().deleteUser(userIdToDelete);

            const userDocRef = db.collection("users").doc(userIdToDelete);
            if ((await userDocRef.get()).exists) {
                await userDocRef.delete();
            }

            res.status(200).json({ data: { success: true } });

        } catch (error: any) {
            logger.error("Erro ao excluir usuário:", error);
            if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
                 res.status(401).json({ error: { message: "Token de autenticação inválido ou expirado." } });
            } else {
                 res.status(500).json({ error: { message: error.message || "Falha na exclusão." } });
            }
        }
    });
});

// ========================================================================
//   GATILHOS FIRESTORE
// ========================================================================

export const onDeleteTerritory = onDocumentDeleted(
  "congregations/{congregationId}/territories/{territoryId}",
  async (event) => {
    if (!event.data) {
      logger.warn(
        `[onDeleteTerritory] Evento de deleção para ${event.params.territoryId} sem dados. Ignorando.`
      );
      return null;
    }
    const ref = event.data.ref;
    try {
      await admin.firestore().recursiveDelete(ref);
      logger.log(
        `[onDeleteTerritory] Território ${event.params.territoryId} e subcoleções deletadas.`
      );
      return { success: true };
    } catch (error) {
      logger.error(
        `[onDeleteTerritory] Erro ao deletar ${event.params.territoryId}:`,
        error
      );
      throw new https.HttpsError(
        "internal",
        "Falha ao deletar território recursivamente."
      );
    }
  }
);


export const onDeleteQuadra = onDocumentDeleted(
  "congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}",
  async (event) => {
    if (!event.data) {
      logger.warn(
        `[onDeleteQuadra] Evento de deleção para ${event.params.quadraId} sem dados. Ignorando.`
      );
      return null;
    }
    const ref = event.data.ref;
    try {
      await admin.firestore().recursiveDelete(ref);
      logger.log(
        `[onDeleteQuadra] Quadra ${event.params.quadraId} e subcoleções deletadas.`
      );
      return { success: true };
    } catch (error) {
      logger.error(
        `[onDeleteQuadra] Erro ao deletar ${event.params.quadraId}:`,
        error
      );
      throw new https.HttpsError(
        "internal",
        "Falha ao deletar quadra recursivamente."
      );
    }
  }
);


// ============================================================================
//   SISTEMA DE PRESENÇA (RTDB -> FIRESTORE)
// ============================================================================

export const mirrorUserStatus = onValueWritten(
  {
    ref: "/status/{uid}",
    region: "us-central1", // O sistema de presença funciona melhor na região padrão
  },
  async (event) => {
    const eventStatus = event.data.after.val();
    const uid = event.params.uid;
    const userDocRef = db.doc(`users/${uid}`);

    try {
        const userDoc = await userDocRef.get();
        if (!userDoc.exists) return null; // Usuário não existe no Firestore

        const updateData: { isOnline: boolean, lastSeen: admin.firestore.FieldValue } = {
            isOnline: false,
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (eventStatus && eventStatus.state === "online") {
            updateData.isOnline = true;
        }

        await userDocRef.update(updateData);
        
    } catch (err: any) {
        if (err.code !== 5) { 
            logger.error(`[Presence Mirror] Falha para o UID ${uid}:`, err);
        }
    }
    return null;
  }
);
