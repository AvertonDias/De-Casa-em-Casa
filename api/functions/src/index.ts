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

// Configuração Global para a região correta
setGlobalOptions({ region: "southamerica-east1" });

// ========================================================================
//   HTTPS onCall Functions (Gerenciamento automático de CORS e Auth)
// ========================================================================

export const deleteUserAccountV2 = https.onCall({ 
    region: "southamerica-east1",
    cors: true // Força o suporte a CORS para ambientes de desenvolvimento instáveis
}, async (request) => {
    // 1. Validar Autenticação
    if (!request.auth) {
        throw new https.HttpsError('unauthenticated', 'Ação não autorizada. Por favor, faça login.');
    }

    const { userIdToDelete } = request.data;
    if (!userIdToDelete) {
        throw new https.HttpsError('invalid-argument', 'ID do usuário a ser deletado é obrigatório.');
    }

    const callingUserUid = request.auth.uid;

    // 2. Verificar permissões de Administrador no Firestore
    const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
    const callingUserData = callingUserSnap.data();

    if (!callingUserData || callingUserData.role !== "Administrador") {
        throw new https.HttpsError('permission-denied', 'Apenas administradores podem excluir usuários permanentemente.');
    }

    // 3. Impedir auto-exclusão
    if (callingUserUid === userIdToDelete) {
        throw new https.HttpsError('permission-denied', 'Um administrador não pode excluir a própria conta através desta ferramenta.');
    }

    try {
        // 4. Executar Exclusão no Auth
        try {
            await admin.auth().deleteUser(userIdToDelete);
            logger.info(`Usuário ${userIdToDelete} removido do Auth.`);
        } catch (authError: any) {
            if (authError.code !== 'auth/user-not-found') {
                throw authError;
            }
            logger.warn(`Usuário ${userIdToDelete} não existia no Auth, prosseguindo com limpeza do DB.`);
        }

        // 5. Executar Exclusão no Firestore
        const userDocRef = db.collection("users").doc(userIdToDelete);
        await userDocRef.delete();
        logger.info(`Dados do usuário ${userIdToDelete} removidos do Firestore.`);

        return { success: true, message: "Usuário e dados excluídos com sucesso." };

    } catch (error: any) {
        logger.error("Erro interno em deleteUserAccountV2:", error);
        throw new https.HttpsError('internal', error.message || 'Falha ao processar a exclusão.');
    }
});

export const getCongregationIdByNumberV2 = https.onCall({ region: "southamerica-east1", cors: true }, async (request) => {
    const { congregationNumber } = request.data;
    if (!congregationNumber) {
        throw new https.HttpsError('invalid-argument', "O número da congregação é obrigatório.");
    }
    const congQuery = await db.collection("congregations").where("number", "==", congregationNumber).limit(1).get();
    if (congQuery.empty) {
        throw new https.HttpsError('not-found', "Congregação não encontrada.");
    }
    return { congregationId: congQuery.docs[0].id };
});

export const createCongregationAndAdminV2 = https.onCall({ region: "southamerica-east1", cors: true }, async (request) => {
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp } = request.data;

    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
        throw new https.HttpsError('invalid-argument', "Todos os campos são obrigatórios.");
    }

    const congQuery = await db.collection("congregations").where("number", "==", congregationNumber).get();
    if (!congQuery.empty) {
        throw new https.HttpsError('already-exists', "Uma congregação com este número já existe.");
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
    return { success: true, userId: newUser.uid };
});

export const completeUserProfileV2 = https.onCall({ region: "southamerica-east1", cors: true }, async (request) => {
    if (!request.auth) throw new https.HttpsError('unauthenticated', 'Não autenticado.');
    
    const { congregationId, whatsapp, name } = request.data;
    
    await db.collection("users").doc(request.auth.uid).set({
        name: name || request.auth.token.name,
        email: request.auth.token.email,
        whatsapp: whatsapp,
        congregationId: congregationId,
        role: "Publicador",
        status: "pendente",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSeen: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
});

export const requestPasswordResetV2 = https.onCall({ region: "southamerica-east1", cors: true }, async (request) => {
    const { email } = request.data;
    if (!email) throw new https.HttpsError('invalid-argument', 'Email obrigatório.');
    
    try {
        const user = await admin.auth().getUserByEmail(email);
        const token = crypto.randomUUID();
        await db.collection("resetTokens").doc(token).set({
            uid: user.uid,
            expires: admin.firestore.Timestamp.fromMillis(Date.now() + 3600000),
        });
        return { success: true, token };
    } catch (error) {
        return { success: true, token: null };
    }
});

export const resetPasswordWithTokenV2 = https.onCall({ region: "southamerica-east1", cors: true }, async (request) => {
    const { token, newPassword } = request.data;
    if (!token || !newPassword) throw new https.HttpsError('invalid-argument', 'Token e senha obrigatórios.');
    
    const tokenRef = db.collection("resetTokens").doc(token);
    const tokenDoc = await tokenRef.get();
    
    if (!tokenDoc.exists || (tokenDoc.data()?.expires.toMillis() || 0) < Date.now()) {
        throw new https.HttpsError('failed-precondition', "Token inválido ou expirado.");
    }
    
    await admin.auth().updateUser(tokenDoc.data()!.uid, { password: newPassword });
    await tokenRef.delete();
    return { success: true };
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
