"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUploadUrl = exports.scheduledFirestoreExport = exports.onDeleteQuadra = exports.onDeleteTerritory = exports.handleUserPresence = exports.resetPeakUsers = exports.onTerritoryUpdateForHistory = exports.resetTerritoryProgress = exports.onTerritoryWrite = exports.onQuadraWrite = exports.onHouseWrite = exports.deleteUserAccount = exports.notifyAdminOfNewUser = exports.createCongregationAndAdmin = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
// ============================================================================
//   FUNÇÕES DE CRIAÇÃO E GERENCIAMENTO DE USUÁRIOS
// ============================================================================
// ▼▼▼ CORREÇÃO 1 DE 2: Erro de tipo corrigido aqui ▼▼▼
exports.createCongregationAndAdmin = functions.https.onCall(async (data, context) => {
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber } = data;
    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber) {
        throw new functions.https.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
    }
    let newUser;
    try {
        newUser = await admin.auth().createUser({ email: adminEmail, password: adminPassword, displayName: adminName });
        const batch = db.batch();
        const newCongregationRef = db.collection('congregations').doc();
        batch.set(newCongregationRef, { name: congregationName, number: congregationNumber, territoryCount: 0, ruralTerritoryCount: 0, totalQuadras: 0, totalHouses: 0, totalHousesDone: 0, createdAt: admin.firestore.FieldValue.serverTimestamp(), lastUpdate: admin.firestore.FieldValue.serverTimestamp() });
        const userDocRef = db.collection("users").doc(newUser.uid);
        batch.set(userDocRef, { name: adminName, email: adminEmail, congregationId: newCongregationRef.id, role: "Administrador", status: "ativo" });
        await batch.commit();
        return { success: true, userId: newUser.uid };
    }
    catch (error) {
        if (newUser) {
            await admin.auth().deleteUser(newUser.uid).catch(deleteError => { console.error(`Falha CRÍTICA ao limpar usuário órfão '${newUser.uid}':`, deleteError); });
        }
        console.error("Erro ao criar congregação e admin:", error);
        if (error.code === 'auth/email-already-exists') {
            throw new functions.https.HttpsError("already-exists", "Este e-mail já está em uso.");
        }
        throw new functions.https.HttpsError("internal", "Ocorreu um erro interno.");
    }
});
exports.notifyAdminOfNewUser = functions.firestore.document("users/{userId}").onCreate(async (snapshot, context) => {
    const newUser = snapshot.data();
    if (!newUser || newUser.status !== "pendente" || !newUser.congregationId)
        return null;
    try {
        const adminsSnapshot = await db.collection("users").where("congregationId", "==", newUser.congregationId).where("role", "==", "Administrador").get();
        if (adminsSnapshot.empty)
            return null;
        const tokens = [];
        adminsSnapshot.forEach(adminDoc => {
            const adminData = adminDoc.data();
            if (adminData.fcmTokens && Array.isArray(adminData.fcmTokens)) {
                tokens.push(...adminData.fcmTokens);
            }
        });
        if (tokens.length === 0)
            return null;
        const payload = { notification: { title: "Novo Usuário Aguardando Aprovação!", body: `O usuário "${newUser.displayName}" se cadastrou e precisa de sua aprovação.`, icon: "/icon-192x192.png", click_action: "/dashboard/usuarios" } };
        await admin.messaging().sendToDevice(tokens, payload);
        return { success: true };
    }
    catch (error) {
        console.error("[notifyAdmin] FALHA CRÍTICA:", error);
        return null;
    }
});
exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
    var _a, _b;
    const callingUserUid = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!callingUserUid) {
        throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const userIdToDelete = data.uid;
    if (!userIdToDelete || typeof userIdToDelete !== 'string') {
        throw new functions.https.HttpsError("invalid-argument", "ID inválido.");
    }
    const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
    const isAdmin = callingUserSnap.exists && ((_b = callingUserSnap.data()) === null || _b === void 0 ? void 0 : _b.role) === "Administrador";
    if (!isAdmin && callingUserUid !== userIdToDelete) {
        throw new functions.https.HttpsError("permission-denied", "Sem permissão.");
    }
    if (isAdmin && callingUserUid === userIdToDelete) {
        throw new functions.https.HttpsError("permission-denied", "Admin não pode se autoexcluir.");
    }
    try {
        await admin.auth().deleteUser(userIdToDelete);
        const userDocRef = db.collection("users").doc(userIdToDelete);
        if ((await userDocRef.get()).exists) {
            await userDocRef.delete();
        }
        return { success: true };
    }
    catch (error) {
        console.error("Erro CRÍTICO ao excluir usuário:", error);
        if (error.code === 'auth/user-not-found') {
            const userDocRef = db.collection("users").doc(userIdToDelete);
            if ((await userDocRef.get()).exists) {
                await userDocRef.delete();
            }
            return { success: true, message: "Usuário não encontrado na Auth, mas removido do Firestore." };
        }
        throw new functions.https.HttpsError("internal", "Falha na exclusão.");
    }
});
// ============================================================================
//   FUNÇÕES DE ESTATÍSTICAS, MANUTENÇÃO E HISTÓRICO
// ============================================================================
exports.onHouseWrite = functions.firestore.document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}").onWrite(async (change, context) => { });
exports.onQuadraWrite = functions.firestore.document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}").onWrite(async (change, context) => { });
exports.onTerritoryWrite = functions.firestore.document("congregations/{congregationId}/territories/{territoryId}").onWrite(async (change, context) => { });
exports.resetTerritoryProgress = functions.https.onCall(async (data, context) => { });
exports.onTerritoryUpdateForHistory = functions.firestore.document("congregations/{congId}/territories/{terrId}").onUpdate(async (change, context) => { });
// ============================================================================
//   FUNÇÕES DE PRESENÇA E PICO DE USUÁRIOS
// ============================================================================
exports.resetPeakUsers = functions.https.onCall(async (data, context) => {
    var _a, _b;
    const uid = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (((_b = adminUserSnap.data()) === null || _b === void 0 ? void 0 : _b.role) !== "Administrador") {
        throw new functions.https.HttpsError("permission-denied", "Ação restrita a administradores.");
    }
    const { congregationId } = data;
    if (!congregationId) {
        throw new functions.https.HttpsError("invalid-argument", "ID da congregação é necessário.");
    }
    try {
        const congregationRef = db.doc(`congregations/${congregationId}`);
        await congregationRef.update({ peakOnlineUsers: { count: 0, timestamp: admin.firestore.FieldValue.serverTimestamp() } });
        return { success: true };
    }
    catch (error) {
        console.error("Falha ao resetar o pico:", error);
        throw new functions.https.HttpsError("internal", "Não foi possível resetar.");
    }
});
// ▼▼▼ CORREÇÃO 2 DE 2: Unificamos as duas funções de presença em uma só ▼▼▼
exports.handleUserPresence = functions.database.ref('/status/{uid}')
    .onWrite(async (change, context) => {
    var _a;
    const eventStatus = change.after.val();
    const firestoreUserRef = db.doc(`users/${context.params.uid}`);
    // Se o nó de status foi DELETADO ou marcado como OFFLINE
    const isOffline = !eventStatus || eventStatus.state === 'offline';
    try {
        await firestoreUserRef.update({
            isOnline: !isOffline,
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (error) {
        if (error.code !== 'not-found') {
            console.error(`Falha ao atualizar presença para usuário ${context.params.uid}:`, error);
        }
    }
    if (isOffline)
        return; // Se ficou offline, termina aqui.
    // A lógica de PICO de usuários só roda quando alguém fica ONLINE
    const userDocSnap = await db.doc(`users/${context.params.uid}`).get();
    if (!userDocSnap.exists)
        return;
    const congregationId = (_a = userDocSnap.data()) === null || _a === void 0 ? void 0 : _a.congregationId;
    if (!congregationId)
        return;
    const congregationRef = db.doc(`congregations/${congregationId}`);
    const statusRef = change.after.ref.parent;
    await db.runTransaction(async (transaction) => {
        var _a;
        const congDoc = await transaction.get(congregationRef);
        if (!congDoc.exists)
            return;
        const onlineUsersSnapshot = await statusRef.orderByChild('state').equalTo('online').once('value');
        const currentOnlineCount = onlineUsersSnapshot.numChildren();
        const peakData = ((_a = congDoc.data()) === null || _a === void 0 ? void 0 : _a.peakOnlineUsers) || { count: 0 };
        if (currentOnlineCount > peakData.count) {
            transaction.update(congregationRef, { peakOnlineUsers: { count: currentOnlineCount, timestamp: admin.firestore.FieldValue.serverTimestamp() } });
        }
    });
});
// ============================================================================
//   FUNÇÕES DE SISTEMA
// ============================================================================
exports.onDeleteTerritory = functions.firestore.document("congregations/{congregationId}/territories/{territoryId}").onDelete(async (snap, context) => { await admin.firestore().recursiveDelete(snap.ref); });
exports.onDeleteQuadra = functions.firestore.document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}").onDelete(async (snap, context) => { await admin.firestore().recursiveDelete(snap.ref); });
exports.scheduledFirestoreExport = functions.pubsub.schedule("every day 03:00").timeZone("America/Sao_Paulo").onRun(async (context) => { });
exports.generateUploadUrl = functions.region("southamerica-east1").https.onCall(async (data, context) => { });
//# sourceMappingURL=index.js.map