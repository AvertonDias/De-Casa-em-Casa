
// src/functions/src/index.ts

import { https, setGlobalOptions, logger } from "firebase-functions/v2";
import {
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import admin from "firebase-admin";
import * as crypto from "crypto";
import { AppUser } from "./types/types";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
setGlobalOptions({ region: "southamerica-east1" });

// ========================================================================
//   CORS WRAPPER
// ========================================================================
function withCors(handler: (req: https.Request, res: any) => void | Promise<void>) {
    return https.onRequest({ 
        cors: [
            "https://de-casa-em-casa.web.app",
            "https://de-casa-em-casa.firebaseapp.com",
            /https:\/\/de-casa-em-casa--pr-.*\.web\.app/,
            /https:\/\/.*\.cloudworkstations\.dev/
        ]
    }, async (req, res) => {
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Firebase-Instance-ID-Token');
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }
        await handler(req, res);
    });
}


// ========================================================================
//   FUNÇÕES HTTPS (onCall transformadas em onRequest com withCors)
// ========================================================================

export const createCongregationAndAdminV2 = withCors(async (req, res) => {
    try {
        const {
          adminName,
          adminEmail,
          adminPassword,
          congregationName,
          congregationNumber,
          whatsapp,
        } = req.body.data;

        if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
          res.status(400).json({ data: { success: false, error: "Todos os campos são obrigatórios." } });
          return;
        }

        const congQuery = await db.collection("congregations").where("number", "==", congregationNumber).get();
        if (!congQuery.empty) {
            res.status(409).json({ data: { success: false, error: "Uma congregação com este número já existe." } });
            return;
        }

        const newUser = await admin.auth().createUser({
            email: adminEmail,
            password: adminPassword,
            displayName: adminName,
        });

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
        res.status(200).json({
            data: {
                success: true,
                userId: newUser.uid,
                message: "Congregação criada com sucesso!",
            },
        });

    } catch (error: any) {
        logger.error("Erro em createCongregationAndAdmin:", error);
        if (error.code === "auth/email-already-exists") {
            res.status(409).json({ data: { success: false, error: "Este e-mail já está em uso." } });
        } else {
            res.status(500).json({ data: { success: false, error: error.message || "Erro interno no servidor" } });
        }
    }
});

export const notifyOnNewUserV2 = withCors(async (req, res) => {
    try {
        const { newUserName, congregationId } = req.body.data;
        if (!newUserName || !congregationId) {
            res.status(400).json({ data: { success: false, error: "Dados insuficientes para notificação." } });
            return;
        }
        
        // A lógica para criar notificações no Firestore foi removida.
        
        res.status(200).json({ data: { success: true, message: "Processo de notificação concluído (sem criar notificação no DB)." } });

    } catch (error: any) {
        logger.error("Erro no processo de notificação de novo usuário:", error);
        res.status(500).json({ data: { success: false, error: "Falha no processo de notificação." } });
    }
});


export const requestPasswordResetV2 = withCors(async (req, res) => {
    try {
        const { email } = req.body.data;
        if (!email) {
            res.status(400).json({ data: { success: false, error: "O e-mail é obrigatório." } });
            return;
        }

        try {
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
                res.status(200).json({
                    data: {
                        success: true,
                        token: null,
                        message: "Se o e-mail existir, um link será enviado.",
                    },
                });
            } else {
                throw error;
            }
        }
    } catch (error: any) {
        logger.error("Erro ao gerar token de redefinição:", error);
        res.status(500).json({ data: { success: false, error: "Erro ao iniciar o processo de redefinição." } });
    }
});


export const resetPasswordWithTokenV2 = withCors(async (req, res) => {
    try {
        const { token, newPassword } = req.body.data;
        if (!token || !newPassword) {
            res.status(400).json({ data: { success: false, error: "Token e nova senha são obrigatórios." } });
            return;
        }

        const tokenRef = db.collection("resetTokens").doc(token);
        const tokenDoc = await tokenRef.get();

        if (!tokenDoc.exists) {
            res.status(404).json({ data: { success: false, error: "Token inválido ou já utilizado." } });
            return;
        }
        if (tokenDoc.data()?.expires.toMillis() < Date.now()) {
            await tokenRef.delete();
            res.status(410).json({ data: { success: false, error: "O token de redefinição expirou." } });
            return;
        }

        const uid = tokenDoc.data()?.uid;
        await admin.auth().updateUser(uid, { password: newPassword });
        await tokenRef.delete();
        res.status(200).json({ data: { success: true } });
    } catch (error: any) {
        logger.error("Erro ao redefinir senha com token:", error);
        res.status(500).json({ data: { success: false, error: "Falha ao atualizar a senha." } });
    }
});


export const deleteUserAccountV2 = withCors(async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ data: { success: false, error: "Ação não autorizada. Sem token." } });
            return;
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const callingUserUid = decodedToken.uid;
        const { userIdToDelete } = req.body.data;

        if (!userIdToDelete) {
            res.status(400).json({ data: { success: false, error: "ID do usuário a ser deletado é obrigatório." } });
            return;
        }

        const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
        const isCallingUserAdmin = callingUserSnap.exists && callingUserSnap.data()?.role === "Administrador";

        // Regra 1: O usuário que está chamando é o mesmo que será deletado (autoexclusão)
        const isSelfDelete = callingUserUid === userIdToDelete;

        // Regra 2: O usuário que está chamando é admin E não está tentando se autoexcluir
        const isAdminDeletingOther = isCallingUserAdmin && !isSelfDelete;

        // Verifica se alguma das regras de permissão é atendida
        if (!isSelfDelete && !isAdminDeletingOther) {
             res.status(403).json({ data: { success: false, error: "Sem permissão." } });
             return;
        }

        // Se a autoexclusão for de um admin, impede
        if (isCallingUserAdmin && isSelfDelete) {
            res.status(403).json({ data: { success: false, error: "Admin não pode se autoexcluir por esta função." } });
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
        if (error.code === 'auth/id-token-expired' || error.code === 'auth/id-token-revoked') {
            res.status(401).json({ data: { success: false, error: "Token de autenticação inválido. Faça login novamente." } });
        } else {
            res.status(500).json({ data: { success: false, error: error.message || "Falha na exclusão." } });
        }
    }
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
        if (!userDoc.exists)
            return null; // Usuário não existe no Firestore

        if (!eventStatus || eventStatus.state === "offline") {
            // Apenas atualiza se o status atual for 'online'
            if (userDoc.data()?.isOnline === true) {
                await userDocRef.update({
                    isOnline: false,
                    lastSeen: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        } else if (eventStatus.state === "online") {
            // Apenas atualiza se o status atual for 'offline' ou indefinido
             if (userDoc.data()?.isOnline !== true) {
                await userDocRef.update({
                    isOnline: true,
                    lastSeen: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        }
    } catch (err: any) {
        if (err.code !== 5) { // 5 = NOT_FOUND, ignora se o doc do usuário foi deletado
            logger.error(`[Presence Mirror] Falha para ${uid}:`, err);
        }
    }
    return null;
  }
);
