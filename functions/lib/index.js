"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledFirestoreExport = exports.onDeleteQuadra = exports.onDeleteTerritory = exports.handleUserPresence = exports.notifyAdminOfNewUser = exports.onTerritoryChange = exports.onQuadraChange = exports.onHouseChange = exports.generateUploadUrl = exports.resetPeakUsers = exports.resetTerritoryProgress = exports.deleteUserAccount = exports.createCongregationAndAdmin = void 0;
// functions/src/index.ts
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
// ========================================================================
//   FUNÇÕES HTTPS (onCall)
// ========================================================================
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
exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
    const callingUserUid = context.auth?.uid;
    if (!callingUserUid) {
        throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const userIdToDelete = data.uid;
    if (!userIdToDelete || typeof userIdToDelete !== 'string') {
        throw new functions.https.HttpsError("invalid-argument", "ID inválido.");
    }
    const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
    const isAdmin = callingUserSnap.exists && callingUserSnap.data()?.role === "Administrador";
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
        return { success: true, message: "Operação de exclusão concluída." };
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
        throw new functions.https.HttpsError("internal", `Falha na exclusão: ${error.message}`);
    }
});
exports.resetTerritoryProgress = functions.https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) {
        throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const { congregationId, territoryId } = data;
    if (!congregationId || !territoryId) {
        throw new functions.https.HttpsError("invalid-argument", "IDs faltando.");
    }
    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (adminUserSnap.data()?.role !== "Administrador") {
        throw new functions.https.HttpsError("permission-denied", "Ação restrita a administradores.");
    }
    try {
        const quadrasRef = db.collection(`congregations/${congregationId}/territories/${territoryId}/quadras`);
        const quadrasSnapshot = await quadrasRef.get();
        if (quadrasSnapshot.empty) {
            return { success: true, message: "Nenhuma casa para limpar." };
        }
        const batch = db.batch();
        let housesUpdatedCount = 0;
        for (const quadraDoc of quadrasSnapshot.docs) {
            const casasSnapshot = await quadraDoc.ref.collection("casas").where('status', '==', true).get();
            casasSnapshot.forEach(casaDoc => {
                batch.update(casaDoc.ref, { status: false });
                housesUpdatedCount++;
            });
        }
        if (housesUpdatedCount > 0) {
            await batch.commit();
            const historyPath = `congregations/${congregationId}/territories/${territoryId}/activityHistory`;
            // Deleta a subcoleção de histórico de forma recursiva.
            await admin.firestore().recursiveDelete(db.collection(historyPath));
            return { success: true, message: `Sucesso! ${housesUpdatedCount} casas no território foram resetadas.` };
        }
        else {
            return { success: true, message: "Nenhuma alteração necessária." };
        }
    }
    catch (error) {
        console.error(`[resetTerritory] FALHA CRÍTICA ao limpar o território ${territoryId}:`, error);
        throw new functions.https.HttpsError("internal", "Falha ao processar a limpeza.");
    }
});
exports.resetPeakUsers = functions.https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) {
        throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (adminUserSnap.data()?.role !== "Administrador") {
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
exports.generateUploadUrl = functions.region("southamerica-east1").https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Ação não autorizada.');
    }
    const filePath = data.filePath;
    if (!filePath || typeof filePath !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'O nome do arquivo é necessário.');
    }
    // A tipagem correta agora vem da importação no topo do arquivo.
    const options = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType: data.contentType,
    };
    try {
        const [url] = await admin.storage().bucket().file(filePath).getSignedUrl(options);
        return { url };
    }
    catch (error) {
        console.error("Erro ao gerar URL assinada:", error);
        throw new functions.https.HttpsError('internal', 'Falha ao criar URL.');
    }
});
// ========================================================================
//   CASCATA DE ESTATÍSTICAS E LÓGICA DE NEGÓCIO
// ========================================================================
// FUNÇÃO 1: Acionada quando uma CASA muda.
exports.onHouseChange = functions.firestore
    .document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}")
    .onWrite(async (change, context) => {
    // ATUALIZA AS ESTATÍSTICAS DA QUADRA
    const quadraRef = change.after.ref.parent.parent;
    const casasSnapshot = await quadraRef.collection("casas").get();
    await quadraRef.update({
        totalHouses: casasSnapshot.size,
        housesDone: casasSnapshot.docs.filter(doc => doc.data().status === true).length
    });
    // ▼▼▼ A LÓGICA DE HISTÓRICO COMEÇA AQUI ▼▼▼
    const beforeData = change.before.data();
    const afterData = change.after.data();
    // Condição: Só continua se o status mudou de 'false' para 'true'.
    if (beforeData?.status === false && afterData?.status === true) {
        const { congregationId, territoryId } = context.params;
        const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
        const historyRef = territoryRef.collection("activityHistory");
        // Atualiza a data do último trabalho (para a lista de "Recentemente Trabalhados")
        await territoryRef.update({ lastUpdate: admin.firestore.FieldValue.serverTimestamp() });
        // Adiciona ao histórico apenas uma vez por dia
        const TIME_ZONE = "America/Sao_Paulo";
        const todayString = new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
        const lastHistorySnap = await historyRef.orderBy("activityDate", "desc").limit(1).get();
        // Se não há histórico ou o último registro não é de hoje, cria um novo.
        if (lastHistorySnap.empty || lastHistorySnap.docs[0].data().activityDate.toDate().toLocaleDateString("en-CA", { timeZone: TIME_ZONE }) !== todayString) {
            return historyRef.add({
                activityDate: admin.firestore.FieldValue.serverTimestamp(),
                notes: "Primeiro trabalho do dia registrado. (Registro Automático)",
                userName: "Sistema",
                userId: "system",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
    return null; // Encerra a função se a condição não for atendida
});
// FUNÇÃO 2: Acionada quando uma QUADRA muda (para atualizar o território)
exports.onQuadraChange = functions.firestore
    .document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}")
    .onWrite(async (change, context) => {
    const { congregationId, territoryId } = context.params;
    const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
    const quadrasSnapshot = await territoryRef.collection("quadras").get();
    let totalHouses = 0;
    let housesDone = 0;
    quadrasSnapshot.forEach(doc => {
        totalHouses += doc.data().totalHouses || 0;
        housesDone += doc.data().housesDone || 0;
    });
    const progress = totalHouses > 0 ? (housesDone / totalHouses) : 0;
    // Esta escrita irá acionar a onTerritoryChange
    return territoryRef.update({
        stats: { totalHouses, housesDone },
        progress,
        quadraCount: quadrasSnapshot.size,
    });
});
// FUNÇÃO 3: Acionada quando um TERRITÓRIO muda (para atualizar a congregação)
exports.onTerritoryChange = functions.firestore
    .document("congregations/{congregationId}/territories/{territoryId}")
    .onWrite(async (change, context) => {
    const { congregationId } = context.params;
    const congregationRef = db.doc(`congregations/${congregationId}`);
    const territoriesRef = congregationRef.collection("territories");
    const territoriesSnapshot = await territoriesRef.get();
    let urbanCount = 0, ruralCount = 0, totalHouses = 0, totalHousesDone = 0, totalQuadras = 0;
    territoriesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.type === 'rural') {
            ruralCount++;
        }
        else {
            urbanCount++;
            totalHouses += data.stats?.totalHouses || 0;
            totalHousesDone += data.stats?.housesDone || 0;
            totalQuadras += data.quadraCount || 0;
        }
    });
    return congregationRef.update({
        territoryCount: urbanCount,
        ruralTerritoryCount: ruralCount,
        totalQuadras, totalHouses, totalHousesDone,
        lastUpdate: admin.firestore.FieldValue.serverTimestamp()
    });
});
// ============================================================================
//   OUTROS GATILHOS (Notificação, Presença, Exclusão)
// ============================================================================
exports.notifyAdminOfNewUser = functions.firestore.document("users/{userId}").onCreate(async (snapshot, context) => {
    const newUser = snapshot.data();
    if (!newUser || newUser.status !== "pendente" || !newUser.congregationId) {
        return null;
    }
    const adminsSnapshot = await db.collection("users")
        .where("congregationId", "==", newUser.congregationId)
        .where("role", "==", "Administrador")
        .get();
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
    const payload = {
        notification: {
            title: "Novo Usuário Aguardando Aprovação!",
            body: `O usuário "${newUser.name}" se cadastrou e precisa de sua aprovação.`,
            icon: "/icon-192x192.png",
            click_action: "/dashboard/usuarios",
        },
    };
    try {
        await admin.messaging().sendToDevice(tokens, payload);
        return { success: true };
    }
    catch (error) {
        console.error("[notifyAdmin] FALHA CRÍTICA:", error);
        return null;
    }
});
exports.handleUserPresence = functions.database.ref('/status/{uid}')
    .onWrite(async (change, context) => {
    const eventStatus = change.after.val();
    const firestoreUserRef = db.doc(`users/${context.params.uid}`);
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
        return;
    const userDocSnap = await db.doc(`users/${context.params.uid}`).get();
    if (!userDocSnap.exists)
        return;
    const congregationId = userDocSnap.data()?.congregationId;
    if (!congregationId)
        return;
    const congregationRef = db.doc(`congregations/${congregationId}`);
    const statusRef = change.after.ref.parent;
    if (!statusRef)
        return;
    return db.runTransaction(async (transaction) => {
        const congDoc = await transaction.get(congregationRef);
        if (!congDoc.exists)
            return;
        const onlineUsersSnapshot = await statusRef.orderByChild('state').equalTo('online').once('value');
        const currentOnlineCount = onlineUsersSnapshot.numChildren();
        const peakData = congDoc.data()?.peakOnlineUsers || { count: 0 };
        if (currentOnlineCount > peakData.count) {
            transaction.update(congregationRef, { peakOnlineUsers: { count: currentOnlineCount, timestamp: admin.firestore.FieldValue.serverTimestamp() } });
        }
    });
});
exports.onDeleteTerritory = functions.firestore.document("congregations/{congregationId}/territories/{territoryId}").onDelete((snap) => {
    return admin.firestore().recursiveDelete(snap.ref);
});
exports.onDeleteQuadra = functions.firestore.document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}").onDelete((snap) => {
    return admin.firestore().recursiveDelete(snap.ref);
});
exports.scheduledFirestoreExport = functions.pubsub.schedule("every day 03:00").timeZone("America/Sao_Paulo").onRun(async () => {
    const firestore = require("@google-cloud/firestore");
    const client = new firestore.v1.FirestoreAdminClient();
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    if (!projectId) {
        throw new Error("ID do Projeto Google Cloud não encontrado.");
    }
    const databaseName = client.databasePath(projectId, "(default)");
    const bucketName = `gs://${projectId}.appspot.com`;
    const timestamp = new Date().toISOString().split('T')[0];
    const outputUriPrefix = `${bucketName}/backups/${timestamp}`;
    try {
        await client.exportDocuments({
            name: databaseName,
            outputUriPrefix: outputUriPrefix,
            collectionIds: [],
        });
        console.log(`Backup do Firestore concluído para ${outputUriPrefix}`);
        return null;
    }
    catch (error) {
        console.error("[Backup] FALHA CRÍTICA:", error);
        throw new functions.https.HttpsError("internal", "A operação de exportação falhou.", error);
    }
});
//# sourceMappingURL=index.js.map