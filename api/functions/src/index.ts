
// src/functions/src/index.ts

import { https, setGlobalOptions, logger } from "firebase-functions/v2";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import admin from "firebase-admin";
import * as crypto from "crypto";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
setGlobalOptions({ region: "southamerica-east1" });


// ========================================================================
//   HTTPS onCall Functions
// ========================================================================

export const getCongregationIdByNumberV2 = https.onCall(async (request) => {
    const { congregationNumber } = request.data;
    if (!congregationNumber) {
        throw new https.HttpsError("invalid-argument", "O número da congregação é obrigatório.");
    }
    const congQuery = await db.collection("congregations").where("number", "==", congregationNumber).limit(1).get();
    if (congQuery.empty) {
        throw new https.HttpsError("not-found", "Congregação não encontrada.");
    }
    return { success: true, congregationId: congQuery.docs[0].id };
});

export const createCongregationAndAdminV2 = https.onCall(async (request) => {
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp } = request.data;

    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
        throw new https.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
    }

    const congQuery = await db.collection("congregations").where("number", "==", congregationNumber).get();
    if (!congQuery.empty) {
        throw new https.HttpsError("already-exists", "Uma congregação com este número já existe.");
    }

    try {
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
        return { success: true, userId: newUser.uid };

    } catch (error: any) {
        if (error.code === 'auth/email-already-exists') {
            throw new https.HttpsError("already-exists", "Este e-mail já está em uso.");
        }
        throw new https.HttpsError("internal", error.message || "Erro interno no servidor");
    }
});

export const completeUserProfileV2 = https.onCall(async (request) => {
    if (!request.auth) {
        throw new https.HttpsError("unauthenticated", "Ação não autorizada. Token ausente.");
    }
    const uid = request.auth.uid;
    const email = request.auth.token.email;
    const { congregationId, whatsapp, name } = request.data;
    
    // O nome vem do corpo da requisição, fallback para o nome no token.
    const finalName = name || request.auth.token.name;

    if (!congregationId || !whatsapp || !email || !finalName) {
        throw new https.HttpsError("invalid-argument", "Dados insuficientes para criar o perfil.");
    }

    const userDocRef = db.collection("users").doc(uid);
    const userDoc = await userDocRef.get();
    if (userDoc.exists) {
        return { success: true, message: "Perfil já existe." };
    }
    
    await userDocRef.set({
        name: finalName,
        email: email,
        whatsapp: whatsapp,
        congregationId: congregationId,
        role: "Publicador",
        status: "pendente",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSeen: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, message: "Perfil de usuário criado com sucesso." };
});


export const notifyOnNewUserV2 = https.onCall(async (request) => {
    logger.info("notifyOnNewUserV2 chamada com:", request.data);
    // Função agora é apenas um placeholder, não lança erros.
    return { success: true, message: "Notificação processada (simulação)." };
});


export const requestPasswordResetV2 = https.onCall(async (request) => {
    const { email } = request.data;
    if (!email) {
        throw new https.HttpsError("invalid-argument", 'O e-mail é obrigatório.');
    }
    try {
        const user = await admin.auth().getUserByEmail(email);
        const token = crypto.randomUUID();
        const expires = Date.now() + 3600 * 1000; // 1 hora

        await db.collection("resetTokens").doc(token).set({
            uid: user.uid,
            expires: admin.firestore.Timestamp.fromMillis(expires),
        });
        return { success: true, token };
    } catch (error: any) {
        if (error.code === "auth/user-not-found") {
            return { success: true, token: null };
        }
        throw new https.HttpsError("internal", "Erro ao iniciar o processo de redefinição.");
    }
});

export const resetPasswordWithTokenV2 = https.onCall(async (request) => {
    const { token, newPassword } = request.data;
    if (!token || !newPassword) {
        throw new https.HttpsError("invalid-argument", "Token e nova senha são obrigatórios.");
    }

    const tokenRef = db.collection("resetTokens").doc(token);
    const tokenDoc = await tokenRef.get();

    if (!tokenDoc.exists) {
        throw new https.HttpsError("not-found", "Token inválido ou já utilizado.");
    }
    if ((tokenDoc.data()?.expires.toMillis() || 0) < Date.now()) {
        await tokenRef.delete();
        throw new https.HttpsError("deadline-exceeded", "O token de redefinição expirou.");
    }

    const uid = tokenDoc.data()?.uid;
    await admin.auth().updateUser(uid, { password: newPassword });
    await tokenRef.delete();
    return { success: true };
});

export const deleteUserAccountV2 = https.onCall(async (request) => {
    if (!request.auth) {
        throw new https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const callingUserUid = request.auth.uid;
    const { userIdToDelete } = request.data;
    if (!userIdToDelete) {
        throw new https.HttpsError("invalid-argument", 'ID do usuário a ser deletado é obrigatório.');
    }
    
    const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
    const callingUserData = callingUserSnap.data();
    if (!callingUserData) {
        throw new https.HttpsError("not-found", 'Usuário requisitante não encontrado.');
    }
    
    const isCallingUserAdmin = callingUserData.role === "Administrador";
    const isSelfDelete = callingUserUid === userIdToDelete;

    if (isCallingUserAdmin && isSelfDelete) {
        throw new https.HttpsError("permission-denied", 'Admin não pode se autoexcluir por esta função.');
    }
    if (!isSelfDelete && !isCallingUserAdmin) {
        throw new https.HttpsError("permission-denied", 'Sem permissão para esta ação.');
    }

    await admin.auth().deleteUser(userIdToDelete);
    const userDocRef = db.collection("users").doc(userIdToDelete);
    if ((await userDocRef.get()).exists) {
        await userDocRef.delete();
    }
    return { success: true };
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
