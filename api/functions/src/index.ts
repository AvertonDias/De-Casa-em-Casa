// src/functions/src/index.ts

import { https, setGlobalOptions, logger } from "firebase-functions/v2";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import admin from "firebase-admin";
import * as crypto from "crypto";
import cors from "cors";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Configuração Global para a região correta
setGlobalOptions({ region: "southamerica-east1" });

// Middleware de CORS manual para máxima compatibilidade com ambientes de dev
const corsHandler = cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
});

// ========================================================================
//   HTTPS onRequest Functions (Com suporte manual a CORS)
// ========================================================================

export const deleteUserAccountV2 = https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        // 1. Tratar Preflight
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        try {
            // 2. Extrair Dados
            const body = req.body?.data || req.body;
            const { userIdToDelete } = body;

            if (!userIdToDelete) {
                res.status(400).json({ error: { message: "ID do usuário a ser deletado é obrigatório." } });
                return;
            }

            // 3. Validar Autenticação (Token do Admin)
            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                res.status(401).json({ error: { message: "Ação não autorizada. Cabeçalho de autorização ausente." } });
                return;
            }

            const idToken = authHeader.split('Bearer ')[1];
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            const callingUserUid = decodedToken.uid;

            // 4. Verificar permissões de Administrador no Firestore
            const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
            const callingUserData = callingUserSnap.data();

            if (!callingUserData || callingUserData.role !== "Administrador") {
                res.status(403).json({ error: { message: "Apenas administradores podem excluir usuários permanentemente." } });
                return;
            }

            // 5. Impedir auto-exclusão
            if (callingUserUid === userIdToDelete) {
                res.status(403).json({ error: { message: "Um administrador não pode excluir a própria conta através desta ferramenta." } });
                return;
            }

            // 6. Executar Exclusão no Auth
            try {
                await admin.auth().deleteUser(userIdToDelete);
                logger.info(`Usuário ${userIdToDelete} removido do Auth.`);
            } catch (authError: any) {
                if (authError.code !== 'auth/user-not-found') {
                    throw authError;
                }
                logger.warn(`Usuário ${userIdToDelete} não existia no Auth, prosseguindo com limpeza do DB.`);
            }

            // 7. Executar Exclusão no Firestore
            const userDocRef = db.collection("users").doc(userIdToDelete);
            await userDocRef.delete();
            logger.info(`Dados do usuário ${userIdToDelete} removidos do Firestore.`);

            res.status(200).json({ data: { success: true, message: "Usuário e dados excluídos com sucesso." } });

        } catch (error: any) {
            logger.error("Erro em deleteUserAccountV2:", error);
            res.status(500).json({ error: { message: error.message || "Erro interno no servidor" } });
        }
    });
});

export const getCongregationIdByNumberV2 = https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
        try {
            const data = req.body?.data || req.body;
            const { congregationNumber } = data;
            if (!congregationNumber) {
                res.status(400).json({ error: { message: "O número da congregação é obrigatório." } });
                return;
            }
            const congQuery = await db.collection("congregations").where("number", "==", congregationNumber).limit(1).get();
            if (congQuery.empty) {
                res.status(404).json({ error: { message: "Congregação não encontrada." } });
                return;
            }
            res.status(200).json({ data: { success: true, congregationId: congQuery.docs[0].id } });
        } catch (error) {
            res.status(500).json({ error: { message: "Erro interno." } });
        }
    });
});

export const createCongregationAndAdminV2 = https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
        try {
            const data = req.body?.data || req.body;
            const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp } = data;

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
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            const userDocRef = db.collection("users").doc(newUser.uid);
            batch.set(userDocRef, {
                name: adminName,
                email: adminEmail,
                whatsapp: whatsapp,
                congregationId: newCongregationRef.id,
                role: "Administrador",
                status: "ativo",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            
            await batch.commit();
            res.status(200).json({ data: { success: true, userId: newUser.uid } });

        } catch (error: any) {
            if (error.code === 'auth/email-already-exists') {
                res.status(409).json({ error: { message: "Este e-mail já está em uso." } });
            } else {
                res.status(500).json({ error: { message: error.message || "Erro interno" } });
            }
        }
    });
});

export const completeUserProfileV2 = https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
        try {
            const idToken = req.headers.authorization?.split('Bearer ')[1];
            if (!idToken) {
                res.status(401).json({ error: { message: "Token ausente." } });
                return;
            }
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            const data = req.body?.data || req.body;
            const { congregationId, whatsapp, name } = data;
            
            await db.collection("users").doc(decodedToken.uid).set({
                name: name || decodedToken.name,
                email: decodedToken.email,
                whatsapp: whatsapp,
                congregationId: congregationId,
                role: "Publicador",
                status: "pendente",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                lastSeen: admin.firestore.FieldValue.serverTimestamp()
            });
            res.status(200).json({ data: { success: true } });
        } catch (error: any) {
            res.status(500).json({ error: { message: error.message } });
        }
    });
});

export const notifyOnNewUserV2 = https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        res.status(200).json({ data: { success: true } });
    });
});

export const requestPasswordResetV2 = https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
        try {
            const { email } = req.body?.data || req.body;
            const user = await admin.auth().getUserByEmail(email);
            const token = crypto.randomUUID();
            await db.collection("resetTokens").doc(token).set({
                uid: user.uid,
                expires: admin.firestore.Timestamp.fromMillis(Date.now() + 3600000),
            });
            res.status(200).json({ data: { success: true, token } });
        } catch (error) {
            res.status(200).json({ data: { success: true, token: null } });
        }
    });
});

export const resetPasswordWithTokenV2 = https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
        try {
            const { token, newPassword } = req.body?.data || req.body;
            const tokenRef = db.collection("resetTokens").doc(token);
            const tokenDoc = await tokenRef.get();
            if (!tokenDoc.exists || (tokenDoc.data()?.expires.toMillis() || 0) < Date.now()) {
                res.status(400).json({ error: { message: "Token inválido ou expirado." } });
                return;
            }
            await admin.auth().updateUser(tokenDoc.data()!.uid, { password: newPassword });
            await tokenRef.delete();
            res.status(200).json({ data: { success: true } });
        } catch (error) {
            res.status(500).json({ error: { message: "Erro ao resetar." } });
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
      logger.warn(`[onDeleteTerritory] Evento de deleção sem dados. Ignorando.`);
      return null;
    }
    const ref = event.data.ref;
    try {
      await admin.firestore().recursiveDelete(ref);
      logger.log(`[onDeleteTerritory] Território e subcoleções deletadas.`);
      return { success: true };
    } catch (error) {
      logger.error(`[onDeleteTerritory] Erro ao deletar:`, error);
      throw new https.HttpsError("internal", "Falha ao deletar território recursivamente.");
    }
  }
);


export const onDeleteQuadra = onDocumentDeleted(
  "congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}",
  async (event) => {
    if (!event.data) {
      logger.warn(`[onDeleteQuadra] Evento de deleção sem dados. Ignorando.`);
      return null;
    }
    const ref = event.data.ref;
    try {
      await admin.firestore().recursiveDelete(ref);
      logger.log(`[onDeleteQuadra] Quadra e subcoleções deletadas.`);
      return { success: true };
    } catch (error) {
      logger.error(`[onDeleteQuadra] Erro ao deletar:`, error);
      throw new https.HttpsError("internal", "Falha ao deletar quadra recursivamente.");
    }
  }
);


// ============================================================================
//   SISTEMA DE PRESENÇA (RTDB -> FIRESTORE)
// ============================================================================

export const mirrorUserStatus = onValueWritten(
  {
    ref: "/status/{uid}",
    region: "us-central1",
  },
  async (event) => {
    const eventStatus = event.data.after.val();
    const uid = event.params.uid;
    const userDocRef = db.doc(`users/${uid}`);

    try {
        const userDoc = await userDocRef.get();
        if (!userDoc.exists) return null;

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
