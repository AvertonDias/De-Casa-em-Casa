
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

setGlobalOptions({ region: "southamerica-east1" });

export const deleteUserAccountV2 = https.onCall({ 
    region: "southamerica-east1",
    cors: true
}, async (request) => {
    if (!request.auth) {
        throw new https.HttpsError('unauthenticated', 'Sessão expirada. Faça login novamente.');
    }

    const { userIdToDelete } = request.data;
    if (!userIdToDelete) {
        throw new https.HttpsError('invalid-argument', 'O ID do usuário é obrigatório.');
    }

    try {
        const callingUserSnap = await db.collection("users").doc(request.auth.uid).get();
        const callingUserData = callingUserSnap.data();

        if (!callingUserData || callingUserData.role !== "Administrador") {
            throw new https.HttpsError('permission-denied', 'Apenas administradores podem excluir usuários.');
        }

        if (request.auth.uid === userIdToDelete) {
            throw new https.HttpsError('permission-denied', 'Você não pode excluir sua própria conta por aqui.');
        }

        const userDocRef = db.collection("users").doc(userIdToDelete);
        await userDocRef.delete();
        await auth.deleteUser(userIdToDelete);

        return { success: true };
    } catch (error: any) {
        if (error instanceof https.HttpsError) throw error;
        logger.error("[DeleteUser] Erro fatal:", error);
        throw new https.HttpsError('internal', `Erro ao excluir usuário: ${error.message || 'Erro desconhecido'}`);
    }
});

export const getCongregationIdByNumberV2 = https.onCall({ 
    region: "southamerica-east1",
    cors: true 
}, async (request) => {
    const { congregationNumber } = request.data;
    if (!congregationNumber) {
        throw new https.HttpsError('invalid-argument', "O número é obrigatório.");
    }
    const congQuery = await db.collection("congregations").where("number", "==", congregationNumber).limit(1).get();
    if (congQuery.empty) {
        throw new https.HttpsError('not-found', "Congregação não encontrada.");
    }
    return { congregationId: congQuery.docs[0].id };
});

export const createCongregationAndAdminV2 = https.onCall({ 
    region: "southamerica-east1",
    cors: true 
}, async (request) => {
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp } = request.data;

    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
        throw new https.HttpsError('invalid-argument', "Campos incompletos.");
    }

    const congQuery = await db.collection("congregations").where("number", "==", congregationNumber).get();
    if (!congQuery.empty) {
        throw new https.HttpsError('already-exists', "Número de congregação já existe.");
    }

    const newUser = await auth.createUser({ 
        email: adminEmail.toLowerCase().trim(), 
        password: adminPassword, 
        displayName: adminName.trim() 
    });

    const batch = db.batch();
    const newCongregationRef = db.collection("congregations").doc();
    batch.set(newCongregationRef, {
        name: congregationName.trim(),
        number: congregationNumber.trim(),
        territoryCount: 0,
        ruralTerritoryCount: 0,
        totalQuadras: 0,
        totalHouses: 0,
        totalHousesDone: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const userDocRef = db.collection("users").doc(newUser.uid);
    batch.set(userDocRef, {
        name: adminName.trim(),
        email: adminEmail.toLowerCase().trim(),
        whatsapp: whatsapp,
        congregationId: newCongregationRef.id,
        role: "Administrador",
        status: "ativo",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    await batch.commit();
    return { success: true, userId: newUser.uid };
});

export const requestPasswordResetV2 = https.onCall({ 
    region: "southamerica-east1",
    cors: true 
}, async (request) => {
    const { email } = request.data;
    if (!email) throw new https.HttpsError('invalid-argument', 'Email obrigatório.');
    
    try {
        const normalizedEmail = email.trim().toLowerCase();
        const userQuery = await db.collection("users").where("email", "==", normalizedEmail).limit(1).get();
        
        let uid = '';
        if (!userQuery.empty) {
            uid = userQuery.docs[0].id;
        } else {
            const user = await auth.getUserByEmail(normalizedEmail);
            uid = user.uid;
        }

        const token = crypto.randomUUID();
        await db.collection("resetTokens").doc(token).set({
            uid: uid,
            expires: admin.firestore.Timestamp.fromMillis(Date.now() + 3600000), 
        });
        return { success: true, token };
    } catch (error) {
        return { success: true, token: null };
    }
});

export const resetPasswordWithTokenV2 = https.onCall({ 
    region: "southamerica-east1",
    cors: true 
}, async (request) => {
    const { token, newPassword } = request.data;
    if (!token || !newPassword) throw new https.HttpsError('invalid-argument', 'Dados incompletos.');
    
    const tokenRef = db.collection("resetTokens").doc(token);
    const tokenDoc = await tokenRef.get();
    
    if (!tokenDoc.exists || (tokenDoc.data()?.expires.toMillis() || 0) < Date.now()) {
        throw new https.HttpsError('failed-precondition', "Token inválido ou expirado.");
    }
    
    await auth.updateUser(tokenDoc.data()!.uid, { password: newPassword });
    await tokenRef.delete();
    return { success: true };
});

export const onDeleteTerritory = onDocumentDeleted("congregations/{congregationId}/territories/{territoryId}", async (event) => {
    if (!event.data) return null;
    try {
        await admin.firestore().recursiveDelete(event.data.ref);
        return { success: true };
    } catch (error) {
        logger.error(`[onDeleteTerritory] Erro ao deletar ${event.params.territoryId}:`, error);
        return null;
    }
});

export const onDeleteQuadra = onDocumentDeleted("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}", async (event) => {
    if (!event.data) return null;
    try {
        await admin.firestore().recursiveDelete(event.data.ref);
        return { success: true };
    } catch (error) {
        logger.error(`[onDeleteQuadra] Erro ao deletar ${event.params.quadraId}:`, error);
        return null;
    }
});

export const mirrorUserStatus = onValueWritten({
    ref: "/status/{uid}",
    region: "us-central1", 
}, async (event) => {
    const eventStatus = event.data.after.val();
    const uid = event.params.uid;
    const userDocRef = db.doc(`users/${uid}`);
    try {
        const userDoc = await userDocRef.get();
        if (!userDoc.exists) return null;
        
        const updateData: any = {
            isOnline: eventStatus?.state === "online",
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        };
        await userDocRef.update(updateData);
    } catch (err) {
        logger.error(`[Presence Mirror] Falha para o UID ${uid}:`, err);
    }
    return null;
});
