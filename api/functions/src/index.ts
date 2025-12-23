// src/functions/src/index.ts

import { https, setGlobalOptions, logger } from "firebase-functions/v2";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import admin from "firebase-admin";
import * as crypto from "crypto";
import type { AppUser } from "./types/types"; // Caminho relativo
import cors from "cors";
import type { Request, Response } from "express";

// Crie uma instância do CORS que permite requisições da sua aplicação
const corsHandler = cors({ 
    origin: [
        "https://de-casa-em-casa.web.app",
        "https://de-casa-em-casa.firebaseapp.com",
        "https://de-casa-em-casa.vercel.app",
        /https:\/\/de-casa-em-casa--pr-.*\.web\.app/,
        /https:\/\/.*\.vercel\.app/,
        /https:\/\/.*\.cloudworkstations\.dev/,
        "http://localhost:3000"
    ] 
});

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
setGlobalOptions({ region: "southamerica-east1" });

// ========================================================================
//   FUNÇÕES HTTPS (onCall)
// ========================================================================

// Wrapper para simplificar a aplicação de CORS
function createHttpsFunction(handler: (req: Request, res: Response) => Promise<void>) {
    return https.onRequest(async (req: Request, res: Response) => {
        return new Promise<void>((resolve) => {
            corsHandler(req, res, async (err) => {
                if (err) {
                    logger.error("CORS Error:", err);
                    res.status(500).json({ error: "CORS Configuration Error" });
                    resolve();
                    return;
                }
                try {
                    await handler(req, res);
                } catch (e: any) {
                    logger.error("Function Error:", e);
                    res.status(500).json({ error: "Internal Server Error", message: e.message });
                }
                resolve();
            });
        });
    });
}

export const createCongregationAndAdminV2 = createHttpsFunction(async (req, res) => {
    try {
        const {
          adminName,
          adminEmail,
          adminPassword,
          congregationName,
          congregationNumber,
          whatsapp,
        } = req.body; // Use req.body, o httpsCallable já faz o unwrap

        if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
          return res.status(400).json({ success: false, error: "Todos os campos são obrigatórios." });
        }

        const congQuery = await db.collection("congregations").where("number", "==", congregationNumber).get();
        if (!congQuery.empty) {
            return res.status(409).json({ success: false, error: "Uma congregação com este número já existe." });
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
        return res.status(200).json({
            success: true,
            userId: newUser.uid,
            message: "Congregação criada com sucesso!",
        });

    } catch (error: any) {
        logger.error("Erro em createCongregationAndAdmin:", error);
        if (error.code === "auth/email-already-exists") {
            return res.status(409).json({ success: false, error: "Este e-mail já está em uso." });
        } else {
            return res.status(500).json({ success: false, error: error.message || "Erro interno no servidor" });
        }
    }
});

export const notifyOnNewUserV2 = createHttpsFunction(async (req, res) => {
    try {
        const { newUserName, congregationId } = req.body;
        if (!newUserName || !congregationId) {
            return res.status(400).json({ success: false, error: "Dados insuficientes para notificação." });
        }
        return res.status(200).json({ success: true, message: "Processo de notificação concluído (sem criar notificação no DB)." });
    } catch (error: any) {
        logger.error("Erro no processo de notificação de novo usuário:", error);
        return res.status(500).json({ success: false, error: "Falha no processo de notificação." });
    }
});

export const requestPasswordResetV2 = createHttpsFunction(async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, error: "O e-mail é obrigatório." });
        }

        try {
            const user = await admin.auth().getUserByEmail(email);
            const token = crypto.randomUUID();
            const expires = Date.now() + 3600 * 1000; // 1 hora

            await db.collection("resetTokens").doc(token).set({
                uid: user.uid,
                expires: admin.firestore.Timestamp.fromMillis(expires),
            });
            return res.status(200).json({ success: true, token });
        } catch (error: any) {
            if (error.code === "auth/user-not-found") {
                return res.status(200).json({
                    success: true,
                    token: null,
                    message: "Se o e-mail existir, um link será enviado.",
                });
            } else {
                throw error;
            }
        }
    } catch (error: any) {
        logger.error("Erro ao gerar token de redefinição:", error);
        return res.status(500).json({ success: false, error: "Erro ao iniciar o processo de redefinição." });
    }
});

export const resetPasswordWithTokenV2 = createHttpsFunction(async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ success: false, error: "Token e nova senha são obrigatórios." });
        }

        const tokenRef = db.collection("resetTokens").doc(token);
        const tokenDoc = await tokenRef.get();

        if (!tokenDoc.exists) {
            return res.status(404).json({ success: false, error: "Token inválido ou já utilizado." });
        }
        if (tokenDoc.data()?.expires.toMillis() < Date.now()) {
            await tokenRef.delete();
            return res.status(410).json({ success: false, error: "O token de redefinição expirou." });
        }

        const uid = tokenDoc.data()?.uid;
        await admin.auth().updateUser(uid, { password: newPassword });
        await tokenRef.delete();
        return res.status(200).json({ success: true });
    } catch (error: any) {
        logger.error("Erro ao redefinir senha com token:", error);
        return res.status(500).json({ success: false, error: "Falha ao atualizar a senha." });
    }
});

export const deleteUserAccountV2 = createHttpsFunction(async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
             return res.status(401).json({ success: false, error: "Ação não autorizada. Sem token." });
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const callingUserUid = decodedToken.uid;
        const { userIdToDelete } = req.body;

        if (!userIdToDelete) {
            return res.status(400).json({ success: false, error: "ID do usuário a ser deletado é obrigatório." });
        }

        const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
        if (!callingUserSnap.exists) {
             return res.status(404).json({ success: false, error: "Usuário requisitante não encontrado." });
        }
        const isCallingUserAdmin = callingUserSnap.data()?.role === "Administrador";

        const isSelfDelete = callingUserUid === userIdToDelete;
        const isAdminDeletingOther = isCallingUserAdmin && !isSelfDelete;

        if (!isSelfDelete && !isAdminDeletingOther) {
             return res.status(403).json({ success: false, error: "Sem permissão." });
        }

        if (isCallingUserAdmin && isSelfDelete) {
            return res.status(403).json({ success: false, error: "Admin não pode se autoexcluir por esta função." });
        }

        await admin.auth().deleteUser(userIdToDelete);
        const userDocRef = db.collection("users").doc(userIdToDelete);
        if ((await userDocRef.get()).exists) {
            await userDocRef.delete();
        }
        return res.status(200).json({ success: true });

    } catch (error: any) {
        logger.error("Erro ao excluir usuário:", error);
        if (error.code === 'auth/id-token-expired' || error.code === 'auth/id-token-revoked') {
            return res.status(401).json({ success: false, error: "Token de autenticação inválido. Faça login novamente." });
        } else {
            return res.status(500).json({ success: false, error: error.message || "Falha na exclusão." });
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
