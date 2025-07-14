"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logDailyWork = exports.scheduledFirestoreExport = exports.onDeleteQuadra = exports.onDeleteTerritory = exports.onTerritoryWrite = exports.onQuadraWrite = exports.onHouseWrite = exports.resetTerritoryProgress = exports.deleteUserAccount = exports.notifyAdminOfNewUser = exports.createCongregationAndAdmin = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
// ========================================================================
//   SUAS FUNÇÕES EXISTENTES E CORRIGIDAS
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
            await admin.auth().deleteUser(newUser.uid).catch(deleteError => {
                console.error(`Falha CRÍTICA ao limpar usuário órfão '${newUser.uid}':`, deleteError);
            });
        }
        console.error("Erro ao criar congregação e admin:", error);
        if (error.code === 'auth/email-already-exists') {
            throw new functions.https.HttpsError("already-exists", "Este e-mail já está em uso.");
        }
        throw new functions.https.HttpsError("internal", "Ocorreu um erro interno ao processar a criação.");
    }
});
exports.notifyAdminOfNewUser = functions.firestore.document("users/{userId}").onCreate(async (snapshot, context) => {
    const newUser = snapshot.data();
    if (!newUser || newUser.status !== "pendente" || !newUser.congregationId) {
        return null;
    }
    try {
        const adminsSnapshot = await db.collection("users").where("congregationId", "==", newUser.congregationId).where("role", "==", "Administrador").get();
        if (adminsSnapshot.empty) {
            return null;
        }
        const tokens = [];
        adminsSnapshot.forEach(adminDoc => {
            const adminData = adminDoc.data();
            if (adminData.fcmTokens && Array.isArray(adminData.fcmTokens)) {
                tokens.push(...adminData.fcmTokens);
            }
        });
        if (tokens.length === 0) {
            return null;
        }
        const payload = { notification: { title: "Novo Usuário Aguardando Aprovação!", body: `O usuário "${newUser.name}" se cadastrou e precisa de sua aprovação.`, icon: "/icon-192x192.png", click_action: "/dashboard/usuarios" } };
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
exports.resetTerritoryProgress = functions.https.onCall(async (data, context) => {
    var _a, _b;
    const uid = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const { congregationId, territoryId } = data;
    if (!congregationId || !territoryId) {
        throw new functions.https.HttpsError("invalid-argument", "IDs faltando.");
    }
    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (((_b = adminUserSnap.data()) === null || _b === void 0 ? void 0 : _b.role) !== "Administrador") {
        throw new functions.https.HttpsError("permission-denied", "Ação restrita a administradores.");
    }
    try {
        const quadrasRef = db.collection(`congregations/${congregationId}/territories/${territoryId}/quadras`);
        const quadrasSnapshot = await quadrasRef.get();
        const batch = db.batch();
        let housesUpdatedCount = 0;
        for (const quadraDoc of quadrasSnapshot.docs) {
            const casasSnapshot = await quadraDoc.ref.collection("casas").where('status', '==', true).get();
            if (casasSnapshot.empty) {
                continue;
            }
            casasSnapshot.forEach(casaDoc => { batch.update(casaDoc.ref, { status: false }); housesUpdatedCount++; });
        }
        if (housesUpdatedCount > 0) {
            await batch.commit();
        }
        const historyPath = `congregations/${congregationId}/territories/${territoryId}/activityHistory`;
        await admin.firestore().recursiveDelete(db.collection(historyPath));
        return { success: true };
    }
    catch (error) {
        console.error(`[resetTerritory] FALHA CRÍTICA:`, error);
        throw new functions.https.HttpsError("internal", "Falha ao limpar território.");
    }
});
exports.onHouseWrite = functions.firestore.document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}").onWrite(async (change, context) => {
    const { congregationId, territoryId, quadraId } = context.params;
    const quadraRef = db.doc(`congregations/${congregationId}/territories/${territoryId}/quadras/${quadraId}`);
    try {
        await db.runTransaction(async (transaction) => {
            const casasSnapshot = await transaction.get(quadraRef.collection("casas"));
            transaction.update(quadraRef, {
                totalHouses: casasSnapshot.size,
                housesDone: casasSnapshot.docs.filter(doc => doc.data().status === true).length,
                lastUpdate: admin.firestore.FieldValue.serverTimestamp()
            });
        });
    }
    catch (error) {
        console.error(`[Stats] FALHA ao atualizar quadra ${quadraId}:`, error);
    }
});
exports.onQuadraWrite = functions.firestore.document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}").onWrite(async (change, context) => {
    const territoryRef = db.doc(`congregations/${context.params.congregationId}/territories/${context.params.territoryId}`);
    try {
        await db.runTransaction(async (transaction) => {
            const quadrasSnapshot = await transaction.get(territoryRef.collection("quadras"));
            let totalHouses = 0, housesDone = 0;
            quadrasSnapshot.forEach(doc => {
                totalHouses += doc.data().totalHouses || 0;
                housesDone += doc.data().housesDone || 0;
            });
            transaction.update(territoryRef, {
                totalHouses,
                housesDone,
                progress: totalHouses > 0 ? (housesDone / totalHouses) : 0,
                quadraCount: quadrasSnapshot.size,
                lastUpdate: admin.firestore.FieldValue.serverTimestamp()
            });
        });
    }
    catch (error) {
        console.error(`[onQuadraWrite] FALHA ao atualizar território ${territoryRef.id}: `, error);
    }
});
exports.onTerritoryWrite = functions.firestore.document("congregations/{congregationId}/territories/{territoryId}").onWrite(async (change, context) => {
    const congregationRef = db.collection("congregations").doc(context.params.congregationId);
    try {
        const territoriesRef = congregationRef.collection("territories");
        const urbanSnapshot = await territoriesRef.where("type", "in", ["urban", null]).get();
        const ruralSnapshot = await territoriesRef.where("type", "==", "rural").get();
        let totalQuadras = 0, totalHouses = 0, totalHousesDone = 0;
        urbanSnapshot.forEach(doc => {
            totalQuadras += doc.data().quadraCount || 0;
            totalHouses += doc.data().totalHouses || 0;
            totalHousesDone += doc.data().housesDone || 0;
        });
        await congregationRef.update({
            territoryCount: urbanSnapshot.size,
            ruralTerritoryCount: ruralSnapshot.size,
            totalQuadras, totalHouses, totalHousesDone,
            lastUpdate: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    catch (error) {
        console.error(`[onTerritoryWrite] FALHA ao atualizar congregação:`, error);
    }
});
exports.onDeleteTerritory = functions.firestore.document("congregations/{congregationId}/territories/{territoryId}").onDelete(async (snap, context) => { await admin.firestore().recursiveDelete(snap.ref); });
exports.onDeleteQuadra = functions.firestore.document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}").onDelete(async (snap, context) => { await admin.firestore().recursiveDelete(snap.ref); });
exports.scheduledFirestoreExport = functions.pubsub.schedule("every day 03:00").timeZone("America/Sao_Paulo").onRun(async (context) => {
    const firestore = require("@google-cloud/firestore");
    const client = new firestore.v1.FirestoreAdminClient();
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    if (!projectId) {
        throw new Error("GCP Project ID não encontrado.");
    }
    const databaseName = client.databasePath(projectId, "(default)");
    const bucketName = `gs://${process.env.GCLOUD_PROJECT}.appspot.com`;
    const timestamp = new Date().toISOString().split('T')[0];
    const outputUriPrefix = `${bucketName}/backups/${timestamp}`;
    try {
        await client.exportDocuments({ name: databaseName, outputUriPrefix, collectionIds: [] });
    }
    catch (error) {
        console.error("[Backup] FALHA CRÍTICA:", error);
        throw new functions.https.HttpsError("internal", "Exportação falhou.");
    }
});
// ========================================================================
//   FUNÇÃO FINAL E CORRIGIDA PARA REGISTRO DIÁRIO DE TRABALHO
// ========================================================================
exports.logDailyWork = functions.region("southamerica-east1")
    .firestore.document("congregations/{congId}/territories/{terrId}/quadras/{quadraId}/casas/{casaId}")
    .onWrite(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    if ((!beforeData || beforeData.status === false) && (afterData === null || afterData === void 0 ? void 0 : afterData.status) === true) {
        const { congId, terrId } = context.params;
        const historyCollectionRef = db.doc(`congregations/${congId}/territories/${terrId}`).collection("activityHistory");
        try {
            // ▼▼▼ LÓGICA DE DATA CORRIGIDA E À PROVA DE FALHAS ▼▼▼
            const TIME_ZONE = "America/Sao_Paulo";
            // Pega a data e hora ATUAIS no fuso horário correto.
            const nowInTimeZone = new Date(new Date().toLocaleString("en-US", { timeZone: TIME_ZONE }));
            // Converte para uma string YYYY-MM-DD para comparação.
            const todayString = nowInTimeZone.toISOString().split('T')[0];
            const recentHistorySnapshot = await historyCollectionRef.orderBy("activityDate", "desc").limit(1).get();
            if (!recentHistorySnapshot.empty) {
                const lastRecord = recentHistorySnapshot.docs[0].data();
                const lastRecordDateInUTC = lastRecord.activityDate.toDate();
                // Converte a data do último registro para o MESMO fuso horário para comparar.
                const lastRecordDateInTimeZone = new Date(lastRecordDateInUTC.toLocaleString("en-US", { timeZone: TIME_ZONE }));
                const lastRecordDateString = lastRecordDateInTimeZone.toISOString().split('T')[0];
                if (lastRecordDateString === todayString) {
                    return null; // Já registrou hoje.
                }
            }
            // ▼▼▼ MUDANÇA NO TEXTO E NO NOME DO USUÁRIO ▼▼▼
            return historyCollectionRef.add({
                activityDate: admin.firestore.FieldValue.serverTimestamp(),
                notes: `Primeiro trabalho do dia registrado.`,
                userName: "Sistema",
                userId: "system",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        catch (error) {
            console.error(`[History] Erro ao registrar trabalho diário para o território ${terrId}:`, error);
            return null;
        }
    }
    return null;
});
//# sourceMappingURL=index.js.map