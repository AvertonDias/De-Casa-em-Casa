
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
//   FUNÇÕES HTTPS (onRequest)
// ========================================================================

// Wrapper para simplificar a aplicação de CORS
function createHttpsFunction(handler: (req: Request, res: Response) => Promise<any>) {
    return https.onRequest(async (req: Request, res: Response) => {
        // Envolve sua função com o corsHandler
        corsHandler(req, res, async () => {
            try {
                await handler(req, res);
            } catch (e: any) {
                logger.error("Function Error:", e);
                // Garante que uma resposta seja enviada mesmo em caso de erro inesperado
                if (!res.headersSent) {
                    res.status(500).json({ success: false, error: "Internal Server Error", message: e.message });
                }
            }
        });
    });
}

export const createCongregationAndAdminV2 = createHttpsFunction(async (req, res) => {
    const {
      adminName,
      adminEmail,
      adminPassword,
      congregationName,
      congregationNumber,
      whatsapp,
    } = req.body; // <-- DADOS VÊM DIRETAMENTE DO BODY AGORA

    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
      return res.status(400).json({ success: false, error: "Todos os campos são obrigatórios." });
    }

    try {
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
    const { newUserName, congregationId } = req.body;
    if (!newUserName || !congregationId) {
        return res.status(400).json({ success: false, error: "Dados insuficientes para notificação." });
    }
    try {
        return res.status(200).json({ success: true, message: "Processo de notificação concluído (sem criar notificação no DB)." });
    } catch (error: any) {
        logger.error("Erro no processo de notificação de novo usuário:", error);
        return res.status(500).json({ success: false, error: "Falha no processo de notificação." });
    }
});

export const requestPasswordResetV2 = createHttpsFunction(async (req, res) => {
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
            // Não vaze a informação se o usuário existe ou não
            return res.status(200).json({
                success: true,
                token: null,
                message: "Se o e-mail existir, um link será enviado.",
            });
        } else {
            logger.error("Erro ao gerar token de redefinição:", error);
            return res.status(500).json({ success: false, error: "Erro ao iniciar o processo de redefinição." });
        }
    }
});

export const resetPasswordWithTokenV2 = createHttpsFunction(async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ success: false, error: "Token e nova senha são obrigatórios." });
    }

    try {
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

export const deleteUserAccountV2 = https.onCall(async (request) => {
    // 1. Em onCall, o contexto de autenticação já vem verificado
    if (!request.auth) {
        throw new https.HttpsError('unauthenticated', 'Ação não autorizada. Faça login novamente.');
    }
    const callingUserUid = request.auth.uid;

    try {
        // 2. Os dados vêm de `request.data`
        const { userIdToDelete } = request.data;
        if (!userIdToDelete) {
            throw new https.HttpsError('invalid-argument', 'ID do usuário a ser deletado é obrigatório.');
        }

        const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
        const callingUserData = callingUserSnap.data();
        
        if (!callingUserData) {
            throw new https.HttpsError('not-found', 'Usuário requisitante não encontrado.');
        }

        const isCallingUserAdmin = callingUserData.role === "Administrador";
        const isSelfDelete = callingUserUid === userIdToDelete;
        const isAdminDeletingOther = isCallingUserAdmin && !isSelfDelete;

        if (isCallingUserAdmin && isSelfDelete) {
            throw new https.HttpsError('permission-denied', 'Admin não pode se autoexcluir por esta função.');
        }
        
        if (!isSelfDelete && !isAdminDeletingOther) {
             throw new https.HttpsError('permission-denied', 'Sem permissão para esta ação.');
        }

        await admin.auth().deleteUser(userIdToDelete);
        
        const userDocRef = db.collection("users").doc(userIdToDelete);
        if ((await userDocRef.get()).exists) {
            await userDocRef.delete();
        }
        
        // 3. Retorna um objeto de sucesso
        return { success: true };

    } catch (error: any) {
        logger.error("Erro ao excluir usuário:", error);
        if (error instanceof https.HttpsError) {
            throw error; // Re-lança erros HttpsError para o cliente
        }
        // Para outros erros (ex: user-not-found no deleteUser), lança um erro genérico
        throw new https.HttpsError("internal", error.message || "Falha na exclusão.");
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
        if (!userDoc.exists) return null; // Usuário não existe no Firestore

        const updateData: { isOnline: boolean, lastSeen: admin.firestore.FieldValue } = {
            isOnline: false,
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (eventStatus && eventStatus.state === "online") {
            updateData.isOnline = true;
        }

        // Sempre atualiza o documento do Firestore se o usuário existir.
        // Isso garante que lastSeen seja atualizado mesmo se o estado isOnline não mudar.
        await userDocRef.update(updateData);
        
    } catch (err: any) {
        // Ignora o erro se o documento do usuário não for encontrado (código 5)
        // Isso pode acontecer se o usuário for excluído enquanto o listener de presença ainda estiver ativo.
        if (err.code !== 5) { 
            logger.error(`[Presence Mirror] Falha para o UID ${uid}:`, err);
        }
    }
    return null;
  }
);
