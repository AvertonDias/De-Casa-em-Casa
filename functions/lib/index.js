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
exports.mirrorUserStatus = exports.scheduledFirestoreExport = exports.onDeleteQuadra = exports.onDeleteTerritory = exports.notifyAdminOfNewUser = exports.onTerritoryAssigned = exports.onTerritoryChange = exports.onQuadraChange = exports.onHouseChange = exports.sendFeedbackEmail = exports.generateUploadUrl = exports.resetTerritoryProgress = exports.deleteUserAccount = exports.createCongregationAndAdmin = void 0;
// functions/src/index.ts
const admin = __importStar(require("firebase-admin"));
// **IMPORTANTE:** Remover importações antigas como `import * as functions from "firebase-functions";`
// Importar funções HTTPS diretamente da v2
const https_1 = require("firebase-functions/v2/https");
// Importar funções Firestore diretamente
const firestore_1 = require("firebase-functions/v2/firestore");
// Importar funções Pub/Sub DE AGENDAMENTO (Scheduler) - CORRIGIDO AQUI
const scheduler_1 = require("firebase-functions/v2/scheduler");
// Importar funções Realtime Database diretamente, sem `ref` - CORRIGIDO AQUI
const database_1 = require("firebase-functions/v2/database");
const date_fns_1 = require("date-fns");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cors = require('cors')({ origin: true });
admin.initializeApp();
const db = admin.firestore();
// ========================================================================
//   FUNÇÕES HTTPS (onCall e onRequest)
// ========================================================================
// createCongregationAndAdmin - Função onRequest
// **CORRIGIDO:** Usando `onRequest` importado da v2, e garantindo que os retornos sejam `void`
exports.createCongregationAndAdmin = (0, https_1.onRequest)((req, res) => {
    // O middleware `cors` deve ser o primeiro a lidar com a requisição
    // O callback passado para `cors` deve ser assíncrono para operações de banco de dados/autenticação
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Método não permitido' });
            return; // Apenas retornar para finalizar a execução após enviar a resposta
        }
        const { adminName, adminEmail, adminPassword, congregationName, congregationNumber } = req.body;
        if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber) {
            res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
            return; // Apenas retornar
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
            return; // Apenas retornar
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
                return; // Apenas retornar
            }
            res.status(500).json({ error: error.message || 'Erro interno no servidor' });
            return; // Apenas retornar
        }
        // Não há necessidade de um `return` externo aqui, pois todos os caminhos internos já o possuem.
    });
});
exports.deleteUserAccount = (0, https_1.onCall)(async (req) => {
    const callingUserUid = req.auth?.uid;
    if (!callingUserUid) {
        throw new https_1.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const userIdToDelete = req.data.uid;
    if (!userIdToDelete || typeof userIdToDelete !== 'string') {
        throw new https_1.HttpsError("invalid-argument", "ID inválido.");
    }
    const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
    const isAdmin = callingUserSnap.exists && callingUserSnap.data()?.role === "Administrador";
    if (!isAdmin && callingUserUid !== userIdToDelete) {
        throw new https_1.HttpsError("permission-denied", "Sem permissão.");
    }
    if (isAdmin && callingUserUid === userIdToDelete) {
        throw new https_1.HttpsError("permission-denied", "Admin não pode se autoexcluir.");
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
        throw new https_1.HttpsError("internal", `Falha na exclusão: ${error.message}`);
    }
});
exports.resetTerritoryProgress = (0, https_1.onCall)(async (req) => {
    const uid = req.auth?.uid;
    if (!uid) {
        throw new https_1.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const { congregationId, territoryId } = req.data;
    if (!congregationId || !territoryId) {
        throw new https_1.HttpsError("invalid-argument", "IDs faltando.");
    }
    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (adminUserSnap.data()?.role !== "Administrador") {
        throw new https_1.HttpsError("permission-denied", "Ação restrita a administradores.");
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
            await admin.firestore().recursiveDelete(db.collection(historyPath));
            return { success: true, message: `Sucesso! ${housesUpdatedCount} casas no território foram resetadas.` };
        }
        else {
            return { success: true, message: "Nenhuma alteração necessária." };
        }
    }
    catch (error) {
        console.error(`[resetTerritory] FALHA CRÍTICA ao limpar o território ${territoryId}:`, error);
        throw new https_1.HttpsError("internal", "Falha ao processar a limpeza.");
    }
});
exports.generateUploadUrl = (0, https_1.onCall)({ region: "southamerica-east1" }, async (req) => {
    if (!req.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Ação não autorizada.');
    }
    const { filePath, contentType } = req.data;
    if (!filePath || typeof filePath !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'O nome do arquivo é necessário.');
    }
    const options = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutos
        contentType: contentType,
    };
    try {
        const [url] = await admin.storage().bucket().file(filePath).getSignedUrl(options);
        return { url };
    }
    catch (error) {
        console.error("Erro ao gerar URL assinada:", error);
        throw new https_1.HttpsError('internal', 'Falha ao criar URL.');
    }
});
exports.sendFeedbackEmail = (0, https_1.onCall)(async (req) => {
    if (!req.auth) {
        throw new https_1.HttpsError("unauthenticated", "O usuário deve estar autenticado para enviar feedback.");
    }
    try {
        const { name, email, subject, message } = req.data;
        if (!name || !email || !subject || !message) {
            throw new https_1.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
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
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError("internal", "Erro interno do servidor ao processar o feedback.");
    }
});
// ========================================================================
//   CASCATA DE ESTATÍSTICAS E LÓGICA DE NEGÓCIO
// ========================================================================
exports.onHouseChange = (0, firestore_1.onDocumentWritten)({
    document: "congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}",
    region: "southamerica-east1"
}, async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    if (!afterData)
        return null; // Documento foi deletado.
    const { congregationId, territoryId, quadraId } = event.params;
    const quadraRef = db.collection('congregations').doc(congregationId)
        .collection('territories').doc(territoryId)
        .collection('quadras').doc(quadraId);
    // --- Lógica de atualização de estatísticas da quadra ---
    await db.runTransaction(async (transaction) => {
        const currentQuadraSnap = await transaction.get(quadraRef);
        if (!currentQuadraSnap.exists) {
            console.error("Quadra não encontrada para atualizar estatísticas:", quadraRef.path);
            return;
        }
        const casasSnapshot = await currentQuadraSnap.ref.collection("casas").get();
        const totalHouses = casasSnapshot.size;
        const housesDone = casasSnapshot.docs.filter(doc => doc.data().status === true).length;
        transaction.update(quadraRef, {
            totalHouses: totalHouses,
            housesDone: housesDone
        });
    });
    // --- Lógica para o histórico de atividade diária (modificada) ---
    if (beforeData?.status === false && afterData?.status === true) {
        const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
        const today = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd'); // Formato YYYY-MM-DD para fácil comparação
        const activityHistoryRef = db.collection(territoryRef.path + '/activityHistory');
        // Busca por uma entrada de "trabalho" já existente para hoje
        const todayActivitiesSnap = await activityHistoryRef
            .where('activityDateStr', '==', today)
            .where('type', '==', 'work')
            .limit(1)
            .get();
        if (todayActivitiesSnap.empty) {
            // Se não há registro de trabalho para hoje, crie um novo registro automático
            const automaticDescription = "Primeiro trabalho do dia registrado.(Registro Automático)";
            const registeredByText = "Registrado por: Sistema";
            const finalDescriptionForAutoLog = `${automaticDescription}\n${registeredByText}`;
            await activityHistoryRef.add({
                type: 'work',
                activityDate: admin.firestore.FieldValue.serverTimestamp(),
                activityDateStr: today,
                description: finalDescriptionForAutoLog, // Descrição formatada como pedido
                userId: 'automatic_system_log', // ID especial para logs automáticos do sistema
            });
        }
        // Sempre atualiza o lastUpdate do território quando uma casa é marcada como feita
        await territoryRef.update({ lastUpdate: admin.firestore.FieldValue.serverTimestamp() });
    }
    return null;
});
exports.onQuadraChange = (0, firestore_1.onDocumentWritten)({
    document: "congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}",
    region: "southamerica-east1"
}, async (event) => {
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
exports.onTerritoryChange = (0, firestore_1.onDocumentWritten)({
    document: "congregations/{congregationId}/territories/{territoryId}",
    region: "southamerica-east1"
}, async (event) => {
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
exports.onTerritoryAssigned = (0, firestore_1.onDocumentUpdated)({
    document: "congregations/{congId}/territories/{terrId}",
    region: "southamerica-east1"
}, async (event) => {
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
        if (!userDoc.exists) {
            return null;
        }
        const tokens = userDoc.data()?.fcmTokens;
        if (!tokens || tokens.length === 0) {
            return null;
        }
        const payload = {
            notification: {
                title: "Você recebeu um novo território!",
                body: `O território \"${territoryName}\" está sob sua responsabilidade. Devolver até ${formattedDueDate}.`,
                icon: "/icon-192x192.png",
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
exports.notifyAdminOfNewUser = (0, firestore_1.onDocumentCreated)({
    document: "users/{userId}",
    region: "southamerica-east1"
}, async (event) => {
    const newUser = event.data?.data();
    if (!newUser || newUser.status !== "pendente" || !newUser.congregationId) {
        return null;
    }
    const adminsSnapshot = await db.collection("users")
        .where("congregationId", "==", newUser.congregationId)
        .where("role", "in", ["Administrador", "Dirigente"])
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
exports.onDeleteTerritory = (0, firestore_1.onDocumentDeleted)({
    document: "congregations/{congregationId}/territories/{territoryId}",
    region: "southamerica-east1"
}, (event) => {
    if (!event.data)
        return null;
    return admin.firestore().recursiveDelete(event.data.ref);
});
exports.onDeleteQuadra = (0, firestore_1.onDocumentDeleted)({
    document: "congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}",
    region: "southamerica-east1"
}, (event) => {
    if (!event.data)
        return null;
    return admin.firestore().recursiveDelete(event.data.ref);
});
// scheduledFirestoreExport - Pub/Sub com Scheduler
exports.scheduledFirestoreExport = (0, scheduler_1.onSchedule)({
    schedule: "every day 03:00",
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1"
}, async (event) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
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
        return;
    }
    catch (error) {
        console.error("[Backup] FALHA CRÍTICA:", error);
        throw new https_1.HttpsError("internal", "A operação de exportação falhou.", error);
    }
});
// ============================================================================
//   SISTEMA DE PRESENÇA (RTDB -> FIRESTORE)
// ============================================================================
exports.mirrorUserStatus = (0, database_1.onValueWritten)({
    ref: "/status/{uid}",
    region: "us-central1"
}, async (event) => {
    const eventStatus = event.data.after.val();
    const uid = event.params.uid;
    const userDocRef = admin.firestore().doc(`users/${uid}`);
    try {
        if (!eventStatus || eventStatus.state === 'offline') {
            await userDocRef.update({ isOnline: false, lastSeen: admin.firestore.FieldValue.serverTimestamp() });
        }
        else if (eventStatus.state === 'online') {
            await userDocRef.update({ isOnline: true, lastSeen: admin.firestore.FieldValue.serverTimestamp() });
        }
    }
    catch (err) {
        if (err.code !== 'not-found')
            console.error(`[Presence Mirror] Falha para ${uid}:`, err);
    }
    return null;
});
//# sourceMappingURL=index.js.map