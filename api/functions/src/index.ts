// api/functions/src/index.ts

import { https, setGlobalOptions, logger } from "firebase-functions/v2";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const auth = admin.auth();

// Configuração Global para a região correta
setGlobalOptions({ region: "southamerica-east1" });

// ========================================================================
//   HTTPS onCall Functions
// ========================================================================

/**
 * Exclui um usuário do Authentication e do Firestore.
 * Apenas Administradores podem realizar esta ação.
 */
export const deleteUserAccountV2 = https.onCall({ 
    region: "southamerica-east1"
}, async (request) => {
    // 1. Validar Autenticação do Requisitante
    if (!request.auth) {
        throw new https.HttpsError('unauthenticated', 'Sessão expirada. Faça login novamente.');
    }

    const { userIdToDelete } = request.data;
    if (!userIdToDelete) {
        throw new https.HttpsError('invalid-argument', 'ID do usuário é obrigatório.');
    }

    const callingUserUid = request.auth.uid;

    try {
        logger.info(`[DeleteUser] Início: ${callingUserUid} excluindo ${userIdToDelete}`);

        // 2. Verificar permissões de Administrador
        const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
        const callingUserData = callingUserSnap.data();

        if (!callingUserData || callingUserData.role !== "Administrador") {
            logger.warn(`[DeleteUser] Negado: ${callingUserUid} não é Admin.`);
            throw new https.HttpsError('permission-denied', 'Apenas administradores podem excluir usuários.');
        }

        // 3. Impedir auto-exclusão por segurança nesta função
        if (callingUserUid === userIdToDelete) {
            throw new https.HttpsError('permission-denied', 'Para sua segurança, você não pode excluir sua própria conta por aqui.');
        }

        // 4. Limpeza no Firestore (Dados primeiro)
        const userDocRef = db.collection("users").doc(userIdToDelete);
        
        // Remove notificações do usuário
        const notifSnaps = await userDocRef.collection("notifications").get();
        if (!notifSnaps.empty) {
            const batch = db.batch();
            notifSnaps.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }

        // Remove o perfil
        await userDocRef.delete();
        logger.info(`[DeleteUser] Firestore limpo para ${userIdToDelete}.`);

        // 5. Excluir do Firebase Auth (Acesso por último)
        try {
            await auth.deleteUser(userIdToDelete);
            logger.info(`[DeleteUser] Auth removido para ${userIdToDelete}.`);
        } catch (authError: any) {
            // Se o usuário já não existir no Auth, ignoramos o erro
            if (authError.code !== 'auth/user-not-found') {
                logger.error(`[DeleteUser] Erro no Auth:`, authError);
                // Não travamos o processo se o Firestore já foi limpo
            }
        }

        return { success: true, message: "Usuário removido com sucesso." };

    } catch (error: any) {
        if (error instanceof https.HttpsError) throw error;
        logger.error("[DeleteUser] Erro crítico inesperado:", error);
        throw new https.HttpsError('internal', 'Ocorreu um erro no servidor ao tentar excluir o usuário. Tente novamente mais tarde.');
    }
});

export const getCongregationIdByNumberV2 = https.onCall({ region: "southamerica-east1" }, async (request) => {
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

export const createCongregationAndAdminV2 = https.onCall({ region: "southamerica-east1" }, async (request) => {
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp } = request.data;

    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
        throw new https.HttpsError('invalid-argument', "Todos os campos são obrigatórios.");
    }

    const congQuery = await db.collection("congregations").where("number", "==", congregationNumber).get();
    if (!congQuery.empty) {
        throw new https.HttpsError('already-exists', "Uma congregação com este número já existe.");
    }

    const newUser = await auth.createUser({ 
        email: adminEmail, 
        password: adminPassword, 
        displayName: adminName 
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
    });

    const userDocRef = db.collection("users").doc(newUser.uid);
    batch.set(userDocRef, {
        name: adminName,
        email: adminEmail.toLowerCase(),
        whatsapp: whatsapp,
        congregationId: newCongregationRef.id,
        role: "Administrador",
        status: "ativo",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    await batch.commit();
    return { success: true, userId: newUser.uid };
});

export const completeUserProfileV2 = https.onCall({ region: "southamerica-east1" }, async (request) => {
    if (!request.auth) throw new https.HttpsError('unauthenticated', 'Não autenticado.');
    
    const { congregationId, whatsapp, name } = request.data;
    
    await db.collection("users").doc(request.auth.uid).set({
        name: name || request.auth.token.name,
        email: request.auth.token.email.toLowerCase(),
        whatsapp: whatsapp,
        congregationId: congregationId,
        role: "Publicador",
        status: "pendente",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSeen: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
});

export const requestPasswordResetV2 = https.onCall({ region: "southamerica-east1" }, async (request) => {
    const { email } = request.data;
    if (!email) throw new https.HttpsError('invalid-argument', 'Email obrigatório.');
    
    try {
        const normalizedEmail = email.trim().toLowerCase();
        
        // Tenta encontrar o UID no Firestore primeiro (onde o e-mail é normalizado)
        const userQuery = await db.collection("users").where("email", "==", normalizedEmail).limit(1).get();
        
        let uid = '';
        if (!userQuery.empty) {
            uid = userQuery.docs[0].id;
        } else {
            // Fallback para buscar diretamente no Auth
            const user = await auth.getUserByEmail(normalizedEmail);
            uid = user.uid;
        }

        const token = crypto.randomUUID();
        await db.collection("resetTokens").doc(token).set({
            uid: uid,
            expires: admin.firestore.Timestamp.fromMillis(Date.now() + 3600000), // 1 hora
        });
        return { success: true, token };
    } catch (error) {
        // Por segurança, retorna sucesso sem token para não expor se o e-mail existe
        return { success: true, token: null };
    }
});

export const resetPasswordWithTokenV2 = https.onCall({ region: "southamerica-east1" }, async (request) => {
    const { token, newPassword } = request.data;
    if (!token || !newPassword) throw new https.HttpsError('invalid-argument', 'Token e senha obrigatórios.');
    
    const tokenRef = db.collection("resetTokens").doc(token);
    const tokenDoc = await tokenRef.get();
    
    if (!tokenDoc.exists || (tokenDoc.data()?.expires.toMillis() || 0) < Date.now()) {
        throw new https.HttpsError('failed-precondition', "Token inválido ou expirado.");
    }
    
    await auth.updateUser(tokenDoc.data()!.uid, { password: newPassword });
    await tokenRef.delete();
    return { success: true };
});


// ========================================================================
//   GATILHOS FIRESTORE
// ========================================================================

export const onDeleteTerritory = onDocumentDeleted(
  "congregations/{congregationId}/territories/{territoryId}",
  async (event) => {
    if (!event.data) return null;
    const ref = event.data.ref;
    try {
      await db.recursiveDelete(ref);
      logger.log(`[Trigger] Território e subcoleções deletadas.`);
      return { success: true };
    } catch (error) {
      logger.error(`[Trigger] Erro ao deletar território:`, error);
      return null;
    }
  }
);


export const onDeleteQuadra = onDocumentDeleted(
  "congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}",
  async (event) => {
    if (!event.data) return null;
    const ref = event.data.ref;
    try {
      await db.recursiveDelete(ref);
      logger.log(`[Trigger] Quadra e subcoleções deletadas.`);
      return { success: true };
    } catch (error) {
      logger.error(`[Trigger] Erro ao deletar quadra:`, error);
      return null;
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
