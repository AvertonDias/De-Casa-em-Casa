
import * as admin from "firebase-admin";
admin.initializeApp();
const db = admin.firestore();

// --- IMPORTAÇÕES DA NOVA SINTAXE (V2) ---
import { https, logger, region } from "firebase-functions/v2";
import { onDocumentWritten, onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { HttpsError } from "firebase-functions/v2/https";
import { GetSignedUrlConfig } from "firebase-admin/storage";


// Opções padrão para as funções
const regionalFunctions = region("southamerica-east1");
const firestoreOptions = { region: "southamerica-east1" as const };

// ========================================================================
//   1. ATUALIZAÇÃO DA QUADRA (QUANDO UMA CASA MUDA)
// ========================================================================
export const updateQuadraStats = onDocumentWritten({ document: "congregations/{congId}/territories/{terrId}/quadras/{quadraId}/casas/{casaId}", ...firestoreOptions }, async (event) => {
    const { congId, terrId, quadraId } = event.params;
    const quadraRef = db.doc(`congregations/${congId}/territories/${terrId}/quadras/${quadraId}`);
    try {
        const casasSnapshot = await quadraRef.collection("casas").get();
        const totalHouses = casasSnapshot.size;
        const housesDone = casasSnapshot.docs.filter(doc => doc.data().status === true).length;
        // Esta escrita irá acionar a função 'updateTerritoryStats'
        return quadraRef.update({ totalHouses, housesDone });
    } catch (error) {
        logger.error(`[Stats-Quadra] FALHA ao atualizar ${quadraId}:`, error);
        return null;
    }
});

// ========================================================================
//   2. ATUALIZAÇÃO DO TERRITÓRIO (QUANDO UMA QUADRA MUDA) - CORRIGIDA
// ========================================================================
export const updateTerritoryStats = onDocumentWritten({ document: "congregations/{congId}/territories/{terrId}/quadras/{quadraId}", ...firestoreOptions }, async (event) => {
    const { congId, terrId } = event.params;
    const territoryRef = db.doc(`congregations/${congId}/territories/${terrId}`);
    
    // Usamos uma transação para garantir a consistência dos dados
    return db.runTransaction(async (transaction) => {
        const quadrasSnapshot = await transaction.get(territoryRef.collection("quadras"));
        
        let totalHouses = 0;
        let housesDone = 0;
        
        quadrasSnapshot.forEach(doc => {
            totalHouses += doc.data().totalHouses || 0;
            housesDone += doc.data().housesDone || 0;
        });

        const progress = totalHouses > 0 ? (housesDone / totalHouses) : 0;
        
        logger.info(`[Stats-Territory] Atualizando ${terrId}: Progresso=${progress * 100}%`);
        
        // Esta escrita irá acionar a função 'updateCongregationStats'
        transaction.update(territoryRef, {
            "stats.totalHouses": totalHouses,
            "stats.housesDone": housesDone,
            "stats.casasPendentes": totalHouses - housesDone,
            "stats.casasFeitas": housesDone,
            progress: progress,
            quadraCount: quadrasSnapshot.size,
        });
    });
});

// ========================================================================
//   3. ATUALIZAÇÃO DA CONGREGAÇÃO (QUANDO UM TERRITÓRIO MUDA)
// ========================================================================
export const updateCongregationStats = onDocumentWritten({ document: "congregations/{congId}/territories/{terrId}", ...firestoreOptions }, async (event) => {
    const { congId } = event.params;
    const congregationRef = db.doc(`congregations/${congId}`);
    const territoriesRef = congregationRef.collection("territories");
    
    return db.runTransaction(async (transaction) => {
        const territoriesSnapshot = await transaction.get(territoriesRef);
        let urbanCount = 0, ruralCount = 0, totalHouses = 0, totalHousesDone = 0, totalQuadras = 0;

        territoriesSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.type === 'rural') {
                ruralCount++;
            } else {
                urbanCount++;
                totalHouses += data.stats?.totalHouses || 0;
                totalHousesDone += data.stats?.housesDone || 0;
                totalQuadras += data.quadraCount || 0;
            }
        });
        
        transaction.update(congregationRef, {
            territoryCount: urbanCount,
            ruralTerritoryCount: ruralCount,
            totalQuadras, totalHouses, totalHousesDone,
        });
    });
});

// ========================================================================
//   4. REGISTRO DE HISTÓRICO E "TRABALHADO RECENTEMENTE"
// ========================================================================
export const logDailyWorkAndUpdateTimestamp = onDocumentWritten({ document: "congregations/{congId}/territories/{terrId}/quadras/{quadraId}/casas/{casaId}", ...firestoreOptions }, async (event) => {
    // Ignora criações e exclusões, focando apenas em atualizações
    if (!event.data?.before || !event.data?.after) return;
    
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    // Roda apenas se uma casa mudou de "não feita" para "feita"
    if (beforeData.status === false && afterData.status === true) {
        const { congId, terrId } = event.params;
        const territoryRef = db.doc(`congregations/${congId}/territories/${terrId}`);
        const historyCollectionRef = territoryRef.collection("activityHistory");
        
        // Atualiza a data do último trabalho (para a lista de "Recentemente Trabalhados")
        await territoryRef.update({
            lastWorkedTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // Lógica para adicionar no histórico apenas uma vez por dia
        const TIME_ZONE = "America/Sao_Paulo";
        const todayString = new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
        const recentHistorySnapshot = await historyCollectionRef.orderBy("activityDate", "desc").limit(1).get();

        if (!recentHistorySnapshot.empty) {
            const lastRecordDate = (recentHistorySnapshot.docs[0].data().activityDate as admin.firestore.Timestamp).toDate();
            if (lastRecordDate.toLocaleDateString("en-CA", { timeZone: TIME_ZONE }) === todayString) {
                return; // Já registrou hoje, não faz mais nada.
            }
        }
        
        logger.info(`[History] Registrando trabalho diário para o território ${terrId}.`);
        await historyCollectionRef.add({
            activityDate: admin.firestore.FieldValue.serverTimestamp(),
            notes: `Primeiro trabalho do dia registrado.`,
            userName: "Sistema",
            userId: "system"
        });
    }
});


// ============================================================================
//   FUNÇÕES HTTPS (onCall) - V2
// ============================================================================
export const createCongregationAndAdmin = regionalFunctions.https.onCall(async (request) => {
    if (!request.data.adminName || !request.data.adminEmail || !request.data.adminPassword || !request.data.congregationName || !request.data.congregationNumber) {
        throw new HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
    }
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber } = request.data;
    let newUser: admin.auth.UserRecord | undefined;
    try {
        newUser = await admin.auth().createUser({ email: adminEmail, password: adminPassword, displayName: adminName });
        const batch = db.batch();
        const newCongregationRef = db.collection('congregations').doc();
        batch.set(newCongregationRef, { name: congregationName, number: congregationNumber, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        batch.set(db.collection("users").doc(newUser.uid), { name: adminName, email: adminEmail, congregationId: newCongregationRef.id, role: "Administrador", status: "ativo" });
        await batch.commit();
        return { success: true, userId: newUser.uid };
    } catch (error: any) {
        if (newUser) { await admin.auth().deleteUser(newUser.uid); }
        logger.error("Erro ao criar congregação:", error);
        if (error.code === 'auth/email-already-exists') { throw new HttpsError("already-exists", "Este e-mail já está em uso."); }
        throw new HttpsError("internal", "Erro interno ao criar.");
    }
});

export const deleteUserAccount = regionalFunctions.https.onCall(async (request) => {
    const callingUserUid = request.auth?.uid;
    if (!callingUserUid) throw new HttpsError("unauthenticated", "Ação não autorizada.");
    const { uid: userIdToDelete } = request.data;
    if (!userIdToDelete || typeof userIdToDelete !== 'string') throw new HttpsError('invalid-argument', "ID do usuário inválido.");
    
    const callingUserDoc = await db.collection("users").doc(callingUserUid).get();
    if(callingUserDoc.data()?.role !== 'Administrador') throw new HttpsError("permission-denied", "Apenas administradores podem excluir.");
    if(callingUserUid === userIdToDelete) throw new HttpsError("permission-denied", "Administrador não pode se autoexcluir.");
    
    try {
        await admin.auth().deleteUser(userIdToDelete);
        await db.collection("users").doc(userIdToDelete).delete();
        return { success: true };
    } catch (error) {
        logger.error("Erro ao excluir usuário:", error);
        throw new HttpsError("internal", "Falha na exclusão.");
    }
});

export const resetTerritoryProgress = regionalFunctions.https.onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Ação não autorizada.");
    const { congregationId, territoryId } = request.data;
    if (!congregationId || !territoryId) throw new HttpsError("invalid-argument", "IDs faltando.");
    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (adminUserSnap.data()?.role !== "Administrador") throw new HttpsError("permission-denied", "Ação restrita a administradores.");

    try {
        const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
        const quadrasRef = territoryRef.collection("quadras");
        const quadrasSnapshot = await quadrasRef.get();
        const batch = db.batch();
        let housesUpdatedCount = 0;

        for (const quadraDoc of quadrasSnapshot.docs) {
            const casasSnapshot = await quadraDoc.ref.collection("casas").where('status', '==', true).get();
            if (casasSnapshot.empty) continue;
            casasSnapshot.forEach(casaDoc => {
                batch.update(casaDoc.ref, { status: false });
                housesUpdatedCount++;
            });
        }
        
        const territorySnap = await territoryRef.get();
        const totalHouses = territorySnap.data()?.stats?.totalHouses || 0;

        batch.update(territoryRef, {
            "stats.housesDone": 0, "stats.casasFeitas": 0, "stats.casasPendentes": totalHouses,
            progress: 0, lastWorkedTimestamp: null
        });
        
        await batch.commit();

        const historyPath = `congregations/${congregationId}/territories/${territoryId}/activityHistory`;
        await admin.firestore().recursiveDelete(db.collection(historyPath));

        return { success: true, message: `Sucesso! ${housesUpdatedCount} casas no território foram resetadas.` };
    } catch (error) {
        logger.error(`[resetTerritory] FALHA CRÍTICA ao limpar ${territoryId}:`, error);
        throw new HttpsError("internal", "Falha ao processar a limpeza.");
    }
});

export const resetPeakUsers = regionalFunctions.https.onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Ação não autorizada.");
    const { congregationId } = request.data;
    if (!congregationId) throw new HttpsError("invalid-argument", "ID da congregação é necessário.");
    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (adminUserSnap.data()?.role !== "Administrador") throw new HttpsError("permission-denied", "Ação restrita a administradores.");

    try {
        await db.doc(`congregations/${congregationId}`).update({
            peakOnlineUsers: { count: 0, timestamp: admin.firestore.FieldValue.serverTimestamp() }
        });
        return { success: true };
    } catch (error) {
        logger.error("Falha ao resetar o pico:", error);
        throw new HttpsError("internal", "Não foi possível resetar.");
    }
});


export const generateUploadUrl = regionalFunctions.https.onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Ação não autorizada.');
    const filePath = request.data.filePath;
    if (!filePath || typeof filePath !== 'string') throw new HttpsError('invalid-argument', 'O nome do arquivo é necessário.');

    const options: GetSignedUrlConfig = {
        version: 'v4', action: 'write', expires: Date.now() + 15 * 60 * 1000, contentType: request.data.contentType,
    };

    try {
        const [url] = await admin.storage().bucket().file(filePath).getSignedUrl(options);
        return { url };
    } catch (error) {
        logger.error("Erro ao gerar a URL assinada:", error);
        throw new HttpsError('internal', 'Não foi possível criar a URL de upload.');
    }
});


// ============================================================================
//   OUTRAS FUNÇÕES DE GATILHO - V2
// ============================================================================
export const onDeleteTerritory = onDocumentDeleted({ document: "congregations/{congId}/territories/{terrId}", ...firestoreOptions }, async (event) => {
    const snap = event.data;
    if (!snap) return;
    logger.info(`Excluindo subcoleções do território ${event.params.terrId}`);
    return admin.firestore().recursiveDelete(snap.ref);
});

export const onDeleteQuadra = onDocumentDeleted({ document: "congregations/{congId}/territories/{terrId}/quadras/{quadraId}", ...firestoreOptions }, async (event) => {
    const snap = event.data;
    if (!snap) return;
    logger.info(`Excluindo subcoleções da quadra ${event.params.quadraId}`);
    return admin.firestore().recursiveDelete(snap.ref);
});

export const handleUserPresence = onValueWritten({ ref: "/status/{uid}", ...firestoreOptions }, async (event) => {
    const { uid } = event.params;
    const eventStatus = event.data.after.val();
    const firestoreUserRef = db.doc(`users/${uid}`);
    const isOffline = !eventStatus || eventStatus.state === 'offline';

    try {
        await firestoreUserRef.update({ isOnline: !isOffline, lastSeen: admin.firestore.FieldValue.serverTimestamp() });
    } catch (error: any) {
        if (error.code !== 'not-found') logger.error(`Falha ao atualizar presença para ${uid}:`, error);
    }
    
    if (isOffline) return;

    const userDocSnap = await db.doc(`users/${uid}`).get();
    if (!userDocSnap.exists() || !userDocSnap.data()?.congregationId) return;
    
    const congregationId = userDocSnap.data()!.congregationId;
    const congregationRef = db.doc(`congregations/${congregationId}`);

    return db.runTransaction(async (transaction) => {
        const congDoc = await transaction.get(congregationRef);
        if (!congDoc.exists) return;
        
        // Contagem de usuários online na mesma congregação
        const usersSnapshot = await db.collection('users')
            .where('congregationId', '==', congregationId)
            .where('isOnline', '==', true)
            .get();
        const currentOnlineCount = usersSnapshot.size;

        const peakData = congDoc.data()?.peakOnlineUsers || { count: 0 };
        if (currentOnlineCount > peakData.count) {
            transaction.update(congregationRef, { peakOnlineUsers: { count: currentOnlineCount, timestamp: admin.firestore.FieldValue.serverTimestamp() } });
        }
    });
});

// ============================================================================
//   FUNÇÃO AGENDADA (Scheduler) - V2
// ============================================================================
export const scheduledFirestoreExport = onSchedule({
    schedule: "every day 03:00",
    timeZone: "America/Sao_Paulo",
    ...firestoreOptions
}, async () => {
    const firestore = require("@google-cloud/firestore");
    const client = new firestore.v1.FirestoreAdminClient();
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    if (!projectId) { logger.error("Project ID não encontrado."); return; }
    const databaseName = client.databasePath(projectId, "(default)");
    const bucketName = `gs://${projectId}.appspot.com`;
    const timestamp = new Date().toISOString().split('T')[0];
    const outputUriPrefix = `${bucketName}/backups/${timestamp}`;
    logger.info(`Iniciando exportação para: ${outputUriPrefix}`);
    try {
      await client.exportDocuments({ name: databaseName, outputUriPrefix, collectionIds: [] });
      logger.log(`Backup do Firestore concluído para ${outputUriPrefix}`);
    } catch(error) {
      logger.error("[Backup] FALHA CRÍTICA:", error);
      throw new HttpsError("internal", "A operação de exportação falhou.", error);
    }
});
