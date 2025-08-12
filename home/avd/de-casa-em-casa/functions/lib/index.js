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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mirrorUserStatus = exports.onDeleteQuadra = exports.onDeleteTerritory = exports.onTerritoryAssigned = exports.onTerritoryChange = exports.onQuadraChange = exports.onHouseChange = exports.sendFeedbackEmail = exports.generateUploadUrl = exports.resetTerritoryProgress = exports.deleteUserAccount = exports.createCongregationAndAdmin = void 0;
// functions/src/index.ts
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-functions/v2/firestore");
const database_1 = require("firebase-functions/v2/database");
const admin = __importStar(require("firebase-admin"));
const date_fns_1 = require("date-fns");
admin.initializeApp();
const db = admin.firestore();
// Define as opções globais para todas as funções V2
(0, v2_1.setGlobalOptions)({
    region: "southamerica-east1",
    serviceAccount: "deploy-functions-sa@appterritorios-e5bb5.iam.gserviceaccount.com"
});
// ========================================================================
//   FUNÇÕES HTTPS (onCall e onRequest)
// ========================================================================
exports.createCongregationAndAdmin = v2_1.https.onRequest({ cors: true }, // Habilita CORS para a função
async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Método não permitido' });
        return;
    }
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber } = req.body;
    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber) {
        res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
        return;
    }
    let newUser;
    try {
        newUser = await admin.auth().createUser({
            email: adminEmail,
            password: adminPassword,
            displayName: adminName,
        });
        const batch = db.batch();
        const newCongregationRef = db.collection('congregations').doc();
        batch.set(newCongregationRef, {
            name: congregationName,
            number: congregationNumber,
            territoryCount: 0, ruralTerritoryCount: 0, totalQuadras: 0, totalHouses: 0, totalHousesDone: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdate: admin.firestore.FieldValue.serverTimestamp()
        });
        const userDocRef = db.collection("users").doc(newUser.uid);
        batch.set(userDocRef, {
            name: adminName,
            email: adminEmail,
            congregationId: newCongregationRef.id,
            role: "Administrador",
            status: "ativo"
        });
        await batch.commit();
        res.status(200).json({ success: true, userId: newUser.uid, message: 'Congregação criada com sucesso!' });
    }
    catch (error) {
        if (newUser) {
            await admin.auth().deleteUser(newUser.uid).catch(deleteError => {
                console.error(`Falha CRÍTICA ao limpar usuário órfão '${newUser?.uid}':`, deleteError);
            });
        }
        console.error("Erro ao criar congregação e admin:", error);
        if (error.code === 'auth/email-already-exists') {
            res.status(409).json({ error: "Este e-mail já está em uso." });
        }
        else {
            res.status(500).json({ error: error.message || 'Erro interno no servidor' });
        }
    }
});
exports.deleteUserAccount = v2_1.https.onCall(async (req) => {
    const callingUserUid = req.auth?.uid;
    if (!callingUserUid) {
        throw new v2_1.https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const userIdToDelete = req.data.uid;
    if (!userIdToDelete || typeof userIdToDelete !== 'string') {
        throw new v2_1.https.HttpsError("invalid-argument", "ID inválido.");
    }
    const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
    const isAdmin = callingUserSnap.exists && callingUserSnap.data()?.role === "Administrador";
    if (!isAdmin && callingUserUid !== userIdToDelete) {
        throw new v2_1.https.HttpsError("permission-denied", "Sem permissão.");
    }
    if (isAdmin && callingUserUid === userIdToDelete) {
        throw new v2_1.https.HttpsError("permission-denied", "Admin não pode se autoexcluir.");
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
        throw new v2_1.https.HttpsError("internal", `Falha na exclusão: ${error.message}`);
    }
});
exports.resetTerritoryProgress = v2_1.https.onCall(async (req) => {
    const uid = req.auth?.uid;
    if (!uid) {
        throw new v2_1.https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const { congregationId, territoryId } = req.data;
    if (!congregationId || !territoryId) {
        throw new v2_1.https.HttpsError("invalid-argument", "IDs faltando.");
    }
    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (adminUserSnap.data()?.role !== "Administrador") {
        throw new v2_1.https.HttpsError("permission-denied", "Ação restrita a administradores.");
    }
    const historyPath = `congregations/${congregationId}/territories/${territoryId}/activityHistory`;
    const quadrasRef = db.collection(`congregations/${congregationId}/territories/${territoryId}/quadras`);
    try {
        await db.recursiveDelete(db.collection(historyPath));
        console.log(`[resetTerritory] Histórico para ${territoryId} deletado com sucesso.`);
    }
    catch (error) {
        console.error(`[resetTerritory] Falha ao deletar histórico para ${territoryId}:`, error);
        throw new v2_1.https.HttpsError("internal", "Falha ao limpar histórico do território.");
    }
    try {
        let housesUpdatedCount = 0;
        await db.runTransaction(async (transaction) => {
            const quadrasSnapshot = await transaction.get(quadrasRef);
            const housesToUpdate = [];
            for (const quadraDoc of quadrasSnapshot.docs) {
                const casasSnapshot = await transaction.get(quadraDoc.ref.collection("casas"));
                casasSnapshot.forEach(casaDoc => {
                    if (casaDoc.data().status === true) {
                        housesToUpdate.push({ ref: casaDoc.ref, data: { status: false } });
                        housesUpdatedCount++;
                    }
                });
            }
            for (const houseUpdate of housesToUpdate) {
                transaction.update(houseUpdate.ref, houseUpdate.data);
            }
        });
        if (housesUpdatedCount > 0) {
            return { success: true, message: `Sucesso! ${housesUpdatedCount} casas no território foram resetadas.` };
        }
        else {
            return { success: true, message: "Nenhuma alteração necessária, nenhuma casa estava marcada como 'feita'." };
        }
    }
    catch (error) {
        console.error(`[resetTerritory] FALHA CRÍTICA na transação ao limpar o território ${territoryId}:`, error);
        throw new v2_1.https.HttpsError("internal", "Falha ao processar a limpeza das casas do território.");
    }
});
exports.generateUploadUrl = v2_1.https.onCall(async (req) => {
    if (!req.auth) {
        throw new v2_1.https.HttpsError('unauthenticated', 'Ação não autorizada.');
    }
    const { filePath, contentType } = req.data;
    if (!filePath || typeof filePath !== 'string' || !contentType) {
        throw new v2_1.https.HttpsError('invalid-argument', 'Caminho do arquivo e tipo de conteúdo são necessários.');
    }
    const options = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutos
        contentType: contentType,
    };
    try {
        const [url] = await admin.storage().bucket().file(filePath).getSignedUrl(options);
        return { success: true, url };
    }
    catch (error) {
        console.error("Erro ao gerar URL assinada:", error);
        throw new v2_1.https.HttpsError('internal', 'Falha ao criar URL de upload.', error.message);
    }
});
exports.sendFeedbackEmail = v2_1.https.onCall(async (req) => {
    if (!req.auth) {
        throw new v2_1.https.HttpsError("unauthenticated", "O usuário deve estar autenticado para enviar feedback.");
    }
    try {
        const { name, email, subject, message } = req.data;
        if (!name || !email || !subject || !message) {
            throw new v2_1.https.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
        }
        console.log('--- NOVO FEEDBACK RECEBIDO ---');
        console.log(`De: ${name} (${email})`);
        console.log(`UID: ${req.auth.uid}`);
        console.log(`Assunto: ${subject}`);
        console.log(`Mensagem: ${message}`);
        console.log('------------------------------');
        return { success: true, message: 'Feedback enviado com sucesso!' };
    }
    catch (error) {
        console.error("Erro ao processar feedback:", error);
        if (error instanceof v2_1.https.HttpsError) {
            throw error;
        }
        throw new v2_1.https.HttpsError("internal", "Erro interno do servidor ao processar o feedback.");
    }
});
// ========================================================================
//   CASCATA DE ESTATÍSTICAS E LÓGICA DE NEGÓCIO
// ========================================================================
exports.onHouseChange = (0, firestore_1.onDocumentWritten)("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}", async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    if (!event.data?.after.exists)
        return null; // Documento deletado, tratado por onDelete
    const { congregationId, territoryId, quadraId } = event.params;
    const quadraRef = db.collection('congregations').doc(congregationId)
        .collection('territories').doc(territoryId)
        .collection('quadras').doc(quadraId);
    try {
        await db.runTransaction(async (transaction) => {
            const casasSnapshot = await transaction.get(quadraRef.collection("casas"));
            const totalHouses = casasSnapshot.size;
            const housesDone = casasSnapshot.docs.filter(doc => doc.data().status === true).length;
            transaction.update(quadraRef, { totalHouses, housesDone });
        });
    }
    catch (e) {
        console.error("onHouseChange: Erro na transação de atualização de estatísticas da quadra:", e);
    }
    if (beforeData?.status === false && afterData?.status === true) {
        const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
        const today = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd');
        const activityHistoryRef = territoryRef.collection('activityHistory');
        try {
            const todayActivitiesSnap = await activityHistoryRef
                .where('activityDateStr', '==', today)
                .where('type', '==', 'work')
                .limit(1)
                .get();
            if (todayActivitiesSnap.empty) {
                const finalDescriptionForAutoLog = "Primeiro trabalho do dia registrado.(Registro Automático)\nRegistrado por: Sistema";
                await activityHistoryRef.add({
                    type: 'work',
                    activityDate: admin.firestore.FieldValue.serverTimestamp(),
                    activityDateStr: today,
                    description: finalDescriptionForAutoLog,
                    userId: 'automatic_system_log',
                    userName: 'Sistema'
                });
            }
        }
        catch (error) {
            console.error("onHouseChange: Erro ao processar ou adicionar log de atividade:", error);
        }
        await territoryRef.update({ lastUpdate: admin.firestore.FieldValue.serverTimestamp() });
    }
    return null;
});
exports.onQuadraChange = (0, firestore_1.onDocumentWritten)("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}", async (event) => {
    const { congregationId, territoryId } = event.params;
    const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
    const quadrasSnapshot = await territoryRef.collection("quadras").get();
    let totalHouses = 0;
    let housesDone = 0;
    quadrasSnapshot.forEach(doc => {
        totalHouses += doc.data().totalHouses || 0;
        housesDone += doc.data().housesDone || 0;
    });
    const progress = totalHouses > 0 ? (housesDone / totalHouses) : 0;
    return territoryRef.update({
        stats: { totalHouses, housesDone },
        progress,
        quadraCount: quadrasSnapshot.size,
    });
});
exports.onTerritoryChange = (0, firestore_1.onDocumentWritten)("congregations/{congregationId}/territories/{territoryId}", async (event) => {
    const { congregationId } = event.params;
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
//   OUTROS GATILHOS (Notificação, Exclusão)
// ============================================================================
exports.onTerritoryAssigned = (0, firestore_1.onDocumentWritten)("congregations/{congId}/territories/{terrId}", async (event) => {
    const dataBefore = event.data?.before.data();
    const dataAfter = event.data?.after.data();
    if (!dataAfter?.assignment || dataBefore?.assignment?.uid === dataAfter.assignment?.uid) {
        return null;
    }
    const assignedUserUid = dataAfter.assignment.uid;
    const territoryName = dataAfter.name;
    const dueDate = dataAfter.assignment.dueDate.toDate();
    const formattedDueDate = dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    try {
        const userDoc = await db.collection("users").doc(assignedUserUid).get();
        if (!userDoc.exists)
            return null;
        const tokens = userDoc.data()?.fcmTokens;
        if (!tokens || tokens.length === 0)
            return null;
        const payload = {
            notification: {
                title: "Você recebeu um novo território!",
                body: `O território "${territoryName}" está sob sua responsabilidade. Devolver até ${formattedDueDate}.`,
                icon: "/icon-192x192.jpg",
                click_action: "/dashboard/meus-territorios",
            },
        };
        await admin.messaging().sendToDevice(tokens, payload);
        return { success: true };
    }
    catch (error) {
        console.error(`[Notification] FALHA CRÍTICA ao enviar notificação:`, error);
        return { success: false, error };
    }
});
exports.onDeleteTerritory = (0, firestore_1.onDocumentDeleted)("congregations/{congregationId}/territories/{territoryId}", async (event) => {
    if (!event.data) {
        console.warn(`[onDeleteTerritory] Evento de deleção para ${event.params.territoryId} sem dados. Ignorando.`);
        return null;
    }
    const ref = event.data.ref;
    try {
        await admin.firestore().recursiveDelete(ref);
        console.log(`[onDeleteTerritory] Território ${event.params.territoryId} e subcoleções deletadas.`);
        return { success: true };
    }
    catch (error) {
        console.error(`[onDeleteTerritory] Erro ao deletar ${event.params.territoryId}:`, error);
        throw new v2_1.https.HttpsError("internal", "Falha ao deletar território recursivamente.");
    }
});
exports.onDeleteQuadra = (0, firestore_1.onDocumentDeleted)("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}", async (event) => {
    if (!event.data) {
        console.warn(`[onDeleteQuadra] Evento de deleção para ${event.params.quadraId} sem dados. Ignorando.`);
        return null;
    }
    const ref = event.data.ref;
    try {
        await admin.firestore().recursiveDelete(ref);
        console.log(`[onDeleteQuadra] Quadra ${event.params.quadraId} e subcoleções deletadas.`);
        return { success: true };
    }
    catch (error) {
        console.error(`[onDeleteQuadra] Erro ao deletar ${event.params.quadraId}:`, error);
        throw new v2_1.https.HttpsError("internal", "Falha ao deletar quadra recursivamente.");
    }
});
// ============================================================================
//   SISTEMA DE PRESENÇA (RTDB -> FIRESTORE)
// ============================================================================
exports.mirrorUserStatus = (0, database_1.onValueWritten)("/status/{uid}", async (event) => {
    const eventStatus = event.data.after.val();
    const uid = event.params.uid;
    const userDocRef = db.doc(`users/${uid}`);
    try {
        if (!eventStatus || eventStatus.state === 'offline') {
            await userDocRef.update({ isOnline: false, lastSeen: admin.firestore.FieldValue.serverTimestamp() });
        }
        else if (eventStatus.state === 'online') {
            await userDocRef.update({ isOnline: true, lastSeen: admin.firestore.FieldValue.serverTimestamp() });
        }
    }
    catch (err) {
        if (err.code !== 'not-found') {
            console.error(`[Presence Mirror] Falha para ${uid}:`, err);
        }
    }
    return null;
});
//# sourceMappingURL=index.js.map
