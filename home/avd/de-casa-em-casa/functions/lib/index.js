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
exports.sendFeedbackEmail = exports.mirrorUserStatus = exports.scheduledFirestoreExport = exports.onDeleteQuadra = exports.onDeleteTerritory = exports.notifyAdminOfNewUser = exports.onTerritoryChange = exports.onQuadraChange = exports.onHouseChange = exports.generateUploadUrl = exports.deleteUserAccount = exports.createCongregationAndAdmin = void 0;
// functions/src/index.ts
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cors = require('cors')({ origin: true });
admin.initializeApp();
const db = admin.firestore();
// ========================================================================
//   FUNÇÕES HTTPS (onCall e onRequest)
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
//   OUTROS GATILHOS (Notificação, Exclusão)
// ============================================================================
exports.notifyAdminOfNewUser = functions.firestore.document("users/{userId}").onCreate(async (snapshot, context) => {
    const newUser = snapshot.data();
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
exports.onDeleteTerritory = functions.firestore.document("congregations/{congregationId}/territories/{territoryId}").onDelete((snap) => {
    return admin.firestore().recursiveDelete(snap.ref);
});
exports.onDeleteQuadra = functions.firestore.document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}").onDelete((snap) => {
    return admin.firestore().recursiveDelete(snap.ref);
});
exports.scheduledFirestoreExport = functions.pubsub.schedule("every day 03:00").timeZone("America/Sao_Paulo").onRun(async () => {
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
        return null;
    }
    catch (error) {
        console.error("[Backup] FALHA CRÍTICA:", error);
        throw new functions.https.HttpsError("internal", "A operação de exportação falhou.", error);
    }
});
// ============================================================================
//   SISTEMA DE PRESENÇA (RTDB -> FIRESTORE)
// ============================================================================
exports.mirrorUserStatus = functions.database
    .ref("/status/{uid}")
    .onWrite(async (change, context) => {
    const eventStatus = change.after.val(); // Dados APÓS a mudança
    const uid = context.params.uid;
    const userDocRef = admin.firestore().doc(`users/${uid}`);
    // Se o nó foi deletado OU o estado é 'offline'
    if (!eventStatus || eventStatus.state === 'offline') {
        return userDocRef.update({
            isOnline: false,
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(err => {
            if (err.code !== 'not-found')
                console.error(`[Presence Mirror] Falha ao marcar OFFLINE para ${uid}:`, err);
        });
    }
    // Se o estado é 'online'
    else if (eventStatus.state === 'online') {
        return userDocRef.update({
            isOnline: true,
            lastSeen: admin.firestore.FieldValue.serverTimestamp(), // Usa timestamp do servidor
        }).catch(err => {
            if (err.code !== 'not-found')
                console.error(`[Presence Mirror] Falha ao marcar ONLINE para ${uid}:`, err);
        });
    }
    return null;
});
// ▼▼▼ FUNÇÃO sendFeedbackEmail COM CORS MANUAL ▼▼▼
exports.sendFeedbackEmail = functions.https.onRequest((req, res) => {
    // Envolve a função com o middleware do cors para responder corretamente ao navegador
    cors(req, res, async () => {
        // 1. Valida o método da requisição
        if (req.method !== 'POST') {
            res.status(405).send({ error: 'Método não permitido.' });
            return;
        }
        try {
            // 2. Extrai os dados do corpo da requisição
            const { name, email, subject, message } = req.body;
            // 3. Valida se os campos obrigatórios estão preenchidos
            if (!name || !email || !subject || !message) {
                res.status(400).send({ error: 'Todos os campos são obrigatórios.' });
                return;
            }
            // 4. Aqui você faria a lógica de envio de e-mail real.
            // Por enquanto, vamos apenas logar e simular sucesso.
            console.log('--- NOVO FEEDBACK RECEBIDO ---');
            console.log(`De: ${name} (${email})`);
            console.log(`Assunto: ${subject}`);
            console.log(`Mensagem: ${message}`);
            console.log('------------------------------');
            // 5. Envia uma resposta de sucesso
            res.status(200).send({ success: true, message: 'Feedback enviado com sucesso!' });
        }
        catch (error) {
            console.error("Erro ao processar feedback:", error);
            res.status(500).send({ success: false, error: 'Erro interno do servidor.' });
        }
    });
});
//# sourceMappingURL=index.js.map
