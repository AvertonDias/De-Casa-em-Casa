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
exports.mirrorUserStatus = exports.notifyOnTerritoryAssigned = exports.onDeleteQuadra = exports.onDeleteTerritory = exports.onTerritoryChange = exports.onQuadraChange = exports.onHouseChange = exports.resetTerritoryProgress = exports.deleteUserAccount = exports.resetPasswordWithToken = exports.requestPasswordReset = exports.notifyOnNewUser = exports.getManagersForNotification = exports.createCongregationAndAdmin = void 0;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-functions/v2/firestore");
const database_1 = require("firebase-functions/v2/database");
const admin = __importStar(require("firebase-admin"));
const date_fns_1 = require("date-fns");
const cors = __importStar(require("cors"));
const crypto = __importStar(require("crypto"));
const corsHandler = cors({
    origin: [
        "https://de-casa-em-casa.vercel.app",
        "https://de-casa-em-casa.web.app",
        "https://de-casa-em-casa-e5bb5.web.app",
        /https:\/\/de-casa-em-casa--.*-e5bb5\.web\.app$/,
        /https:\/\/6000-firebase-studio-.*\.cloudworkstations\.dev$/
    ]
});
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
(0, v2_1.setGlobalOptions)({ region: "southamerica-east1" });
// ========================================================================
//   FUNÇÕES HTTPS (onCall e onRequest)
// ========================================================================
exports.createCongregationAndAdmin = v2_1.https.onCall(async (request) => {
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp, } = request.data;
    if (!adminName ||
        !adminEmail ||
        !adminPassword ||
        !congregationName ||
        !congregationNumber ||
        !whatsapp) {
        throw new v2_1.https.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
    }
    let newUser;
    try {
        const congQuery = await db
            .collection("congregations")
            .where("number", "==", congregationNumber)
            .get();
        if (!congQuery.empty) {
            throw new v2_1.https.HttpsError("already-exists", "Uma congregação com este número já existe.");
        }
        newUser = await admin.auth().createUser({
            email: adminEmail,
            password: adminPassword,
            displayName: adminName,
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
            lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
        });
        const userDocRef = db.collection("users").doc(newUser.uid);
        batch.set(userDocRef, {
            name: adminName,
            email: adminEmail,
            whatsapp: whatsapp,
            congregationId: newCongregationRef.id,
            role: "Administrador",
            status: "ativo",
        });
        await batch.commit();
        return {
            success: true,
            userId: newUser.uid,
            message: "Congregação criada com sucesso!",
        };
    }
    catch (error) {
        if (newUser) {
            await admin
                .auth()
                .deleteUser(newUser.uid)
                .catch((deleteError) => {
                v2_1.logger.error(`Falha CRÍTICA ao limpar usuário órfão '${newUser?.uid}':`, deleteError);
            });
        }
        if (error.code === "auth/email-already-exists") {
            throw new v2_1.https.HttpsError("already-exists", "Este e-mail já está em uso.");
        }
        v2_1.logger.error("Erro ao criar congregação e admin:", error);
        throw new v2_1.https.HttpsError("internal", error.message || "Erro interno no servidor");
    }
});
exports.getManagersForNotification = v2_1.https.onRequest({ cors: true }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Método não permitido." });
        }
        const idToken = req.headers.authorization?.split("Bearer ")[1];
        if (!idToken) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }
        try {
            await admin.auth().verifyIdToken(idToken);
        }
        catch (error) {
            return res.status(401).json({ error: "Token inválido ou expirado." });
        }
        const { congregationId } = req.body;
        if (!congregationId) {
            return res
                .status(400)
                .json({ error: "O ID da congregação é obrigatório." });
        }
        try {
            const rolesToFetch = ["Administrador", "Dirigente"];
            const queryPromises = rolesToFetch.map((role) => db
                .collection("users")
                .where("congregationId", "==", congregationId)
                .where("role", "==", role)
                .get());
            const results = await Promise.all(queryPromises);
            const managers = results.flatMap((snapshot) => snapshot.docs.map((doc) => {
                const { name, whatsapp } = doc.data();
                return { uid: doc.id, name, whatsapp };
            }));
            return res.status(200).json({ success: true, managers });
        }
        catch (error) {
            v2_1.logger.error("Erro ao buscar gerentes:", error);
            return res
                .status(500)
                .json({ error: "Falha ao buscar contatos dos responsáveis." });
        }
    });
});
exports.notifyOnNewUser = v2_1.https.onCall(async (request) => {
    const { newUserName, congregationId } = request.data;
    if (!newUserName || !congregationId) {
        throw new v2_1.https.HttpsError("invalid-argument", "Dados insuficientes para notificação.");
    }
    try {
        const rolesToNotify = ["Administrador", "Dirigente"];
        const notifications = [];
        for (const role of rolesToNotify) {
            const usersToNotifySnapshot = await db
                .collection("users")
                .where("congregationId", "==", congregationId)
                .where("role", "==", role)
                .get();
            usersToNotifySnapshot.forEach((userDoc) => {
                const notification = {
                    title: "Novo Usuário Aguardando Aprovação",
                    body: `O usuário "${newUserName}" solicitou acesso à congregação.`,
                    link: "/dashboard/usuarios",
                    type: "user_pending",
                    isRead: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                notifications.push(userDoc.ref.collection("notifications").add(notification));
            });
        }
        await Promise.all(notifications);
        return { success: true };
    }
    catch (error) {
        v2_1.logger.error("Erro ao criar notificações para novo usuário:", error);
        throw new v2_1.https.HttpsError("internal", "Falha ao enviar notificações.");
    }
});
exports.requestPasswordReset = v2_1.https.onRequest({ cors: true }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== "POST") {
            res.status(405).json({ error: "Método não permitido." });
            return;
        }
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ error: "O e-mail é obrigatório." });
            return;
        }
        try {
            const user = await admin.auth().getUserByEmail(email);
            const token = crypto.randomUUID();
            const expires = Date.now() + 3600 * 1000; // 1 hora
            await db.collection("resetTokens").doc(token).set({
                uid: user.uid,
                expires: admin.firestore.Timestamp.fromMillis(expires),
            });
            res.status(200).json({ success: true, token });
        }
        catch (error) {
            if (error.code === "auth/user-not-found") {
                res.status(200).json({
                    success: true,
                    token: null,
                    message: "Se o e-mail existir, um link será enviado.",
                });
                return;
            }
            v2_1.logger.error("Erro ao gerar token de redefinição:", error);
            res.status(500)
                .json({ error: "Erro ao iniciar o processo de redefinição." });
        }
    });
});
exports.resetPasswordWithToken = v2_1.https.onCall(async (request) => {
    const { token, newPassword } = request.data;
    if (!token || !newPassword) {
        throw new v2_1.https.HttpsError("invalid-argument", "Token e nova senha são obrigatórios.");
    }
    const tokenRef = db.collection("resetTokens").doc(token);
    const tokenDoc = await tokenRef.get();
    if (!tokenDoc.exists) {
        throw new v2_1.https.HttpsError("not-found", "Token inválido ou já utilizado.");
    }
    if (tokenDoc.data()?.expires.toMillis() < Date.now()) {
        await tokenRef.delete();
        throw new v2_1.https.HttpsError("deadline-exceeded", "O token de redefinição expirou.");
    }
    try {
        const uid = tokenDoc.data()?.uid;
        await admin.auth().updateUser(uid, { password: newPassword });
        await tokenRef.delete(); // Token é de uso único
        return { success: true, message: "Senha redefinida com sucesso." };
    }
    catch (error) {
        v2_1.logger.error("Erro ao redefinir senha com token:", error);
        throw new v2_1.https.HttpsError("internal", "Falha ao atualizar a senha do usuário.");
    }
});
exports.deleteUserAccount = v2_1.https.onCall(async (request) => {
    const callingUserUid = request.auth?.uid;
    if (!callingUserUid) {
        throw new v2_1.https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const { userIdToDelete } = request.data;
    if (!userIdToDelete || typeof userIdToDelete !== "string") {
        throw new v2_1.https.HttpsError("invalid-argument", "ID inválido.");
    }
    const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
    const isAdmin = callingUserSnap.exists &&
        callingUserSnap.data()?.role === "Administrador";
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
        v2_1.logger.error("Erro CRÍTICO ao excluir usuário:", error);
        if (error.code === "auth/user-not-found") {
            const userDocRef = db.collection("users").doc(userIdToDelete);
            if ((await userDocRef.get()).exists) {
                await userDocRef.delete();
            }
            return {
                success: true,
                message: "Usuário não encontrado na Auth, mas removido do Firestore.",
            };
        }
        throw new v2_1.https.HttpsError("internal", `Falha na exclusão: ${error.message}`);
    }
});
exports.resetTerritoryProgress = v2_1.https.onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new v2_1.https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const { congregationId, territoryId } = request.data;
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
        v2_1.logger.log(`[resetTerritory] Histórico para ${territoryId} deletado com sucesso.`);
    }
    catch (error) {
        v2_1.logger.error(`[resetTerritory] Falha ao deletar histórico para ${territoryId}:`, error);
        throw new v2_1.https.HttpsError("internal", "Falha ao limpar histórico do território.");
    }
    try {
        let housesUpdatedCount = 0;
        await db.runTransaction(async (transaction) => {
            const quadrasSnapshot = await transaction.get(quadrasRef);
            const housesToUpdate = [];
            for (const quadraDoc of quadrasSnapshot.docs) {
                const casasSnapshot = await transaction.get(quadraDoc.ref.collection("casas"));
                casasSnapshot.forEach((casaDoc) => {
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
            return {
                success: true,
                message: `Sucesso! ${housesUpdatedCount} casas no território foram resetadas.`,
            };
        }
        else {
            return {
                success: true,
                message: "Nenhuma alteração necessária, nenhuma casa estava marcada como 'feita'.",
            };
        }
    }
    catch (error) {
        v2_1.logger.error(`[resetTerritory] FALHA CRÍTICA na transação ao limpar o território ${territoryId}:`, error);
        throw new v2_1.https.HttpsError("internal", "Falha ao processar a limpeza das casas do território.");
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
    const quadraRef = db
        .collection("congregations")
        .doc(congregationId)
        .collection("territories")
        .doc(territoryId)
        .collection("quadras")
        .doc(quadraId);
    try {
        await db.runTransaction(async (transaction) => {
            const casasSnapshot = await transaction.get(quadraRef.collection("casas"));
            const totalHouses = casasSnapshot.size;
            const housesDone = casasSnapshot.docs.filter((doc) => doc.data().status === true).length;
            transaction.update(quadraRef, { totalHouses, housesDone });
        });
    }
    catch (e) {
        v2_1.logger.error("onHouseChange: Erro na transação de atualização de estatísticas da quadra:", e);
    }
    if (beforeData?.status === false && afterData?.status === true) {
        const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
        const today = (0, date_fns_1.format)(new Date(), "yyyy-MM-dd");
        const activityHistoryRef = territoryRef.collection("activityHistory");
        try {
            const todayActivitiesSnap = await activityHistoryRef
                .where("activityDateStr", "==", today)
                .where("type", "==", "work")
                .limit(1)
                .get();
            if (todayActivitiesSnap.empty) {
                const finalDescriptionForAutoLog = "Primeiro trabalho do dia registrado. (Registro Automático)";
                await activityHistoryRef.add({
                    type: "work",
                    activityDate: admin.firestore.FieldValue.serverTimestamp(),
                    activityDateStr: today,
                    description: finalDescriptionForAutoLog,
                    userId: "automatic_system_log",
                    userName: "Sistema",
                });
            }
        }
        catch (error) {
            v2_1.logger.error("onHouseChange: Erro ao processar ou adicionar log de atividade:", error);
        }
        await territoryRef.update({
            lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    return null;
});
exports.onQuadraChange = (0, firestore_1.onDocumentWritten)("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}", async (event) => {
    const { congregationId, territoryId } = event.params;
    const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
    const quadrasSnapshot = await territoryRef.collection("quadras").get();
    let totalHouses = 0;
    let housesDone = 0;
    quadrasSnapshot.forEach((doc) => {
        totalHouses += doc.data().totalHouses || 0;
        housesDone += doc.data().housesDone || 0;
    });
    const progress = totalHouses > 0 ? housesDone / totalHouses : 0;
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
    territoriesSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.type === "rural") {
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
        totalQuadras,
        totalHouses,
        totalHousesDone,
        lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
    });
});
// ============================================================================
//   OUTROS GATILHOS (Notificação, Exclusão)
// ============================================================================
exports.onDeleteTerritory = (0, firestore_1.onDocumentDeleted)("congregations/{congregationId}/territories/{territoryId}", async (event) => {
    if (!event.data) {
        v2_1.logger.warn(`[onDeleteTerritory] Evento de deleção para ${event.params.territoryId} sem dados. Ignorando.`);
        return null;
    }
    const ref = event.data.ref;
    try {
        await admin.firestore().recursiveDelete(ref);
        v2_1.logger.log(`[onDeleteTerritory] Território ${event.params.territoryId} e subcoleções deletadas.`);
        return { success: true };
    }
    catch (error) {
        v2_1.logger.error(`[onDeleteTerritory] Erro ao deletar ${event.params.territoryId}:`, error);
        throw new v2_1.https.HttpsError("internal", "Falha ao deletar território recursivamente.");
    }
});
exports.onDeleteQuadra = (0, firestore_1.onDocumentDeleted)("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}", async (event) => {
    if (!event.data) {
        v2_1.logger.warn(`[onDeleteQuadra] Evento de deleção para ${event.params.quadraId} sem dados. Ignorando.`);
        return null;
    }
    const ref = event.data.ref;
    try {
        await admin.firestore().recursiveDelete(ref);
        v2_1.logger.log(`[onDeleteQuadra] Quadra ${event.params.quadraId} e subcoleções deletadas.`);
        return { success: true };
    }
    catch (error) {
        v2_1.logger.error(`[onDeleteQuadra] Erro ao deletar ${event.params.quadraId}:`, error);
        throw new v2_1.https.HttpsError("internal", "Falha ao deletar quadra recursivamente.");
    }
});
exports.notifyOnTerritoryAssigned = v2_1.https.onCall(async (request) => {
    if (!request.auth) {
        throw new v2_1.https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const { territoryId, territoryName, assignedUid } = request.data;
    if (!territoryId || !territoryName || !assignedUid) {
        throw new v2_1.https.HttpsError("invalid-argument", "Dados insuficientes para enviar notificação.");
    }
    try {
        const userDoc = await db.collection("users").doc(assignedUid).get();
        if (!userDoc.exists) {
            throw new v2_1.https.HttpsError("not-found", "Usuário não encontrado.");
        }
        const notification = {
            title: "Você recebeu um novo território!",
            body: `O território "${territoryName}" foi designado para você.`,
            link: `/dashboard/territorios/${territoryId}`,
            type: 'territory_assigned',
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        const notificationRef = db.collection('users').doc(assignedUid).collection('notifications');
        await notificationRef.add(notification);
        return { success: true };
    }
    catch (error) {
        v2_1.logger.error(`[notifyOnTerritoryAssigned] Erro:`, error);
        throw new v2_1.https.HttpsError("internal", "Falha ao criar notificação no servidor.");
    }
});
// ============================================================================
//   SISTEMA DE PRESENÇA (RTDB -> FIRESTORE)
// ============================================================================
exports.mirrorUserStatus = (0, database_1.onValueWritten)({
    ref: "/status/{uid}",
    region: "us-central1",
}, async (event) => {
    const eventStatus = event.data.after.val();
    const uid = event.params.uid;
    const userDocRef = db.doc(`users/${uid}`);
    try {
        if (!eventStatus || eventStatus.state === "offline") {
            await userDocRef.update({
                isOnline: false,
                lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else if (eventStatus.state === "online") {
            await userDocRef.update({
                isOnline: true,
                lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
    catch (err) {
        if (err.code !== "not-found") {
            v2_1.logger.error(`[Presence Mirror] Falha para ${uid}:`, err);
        }
    }
    return null;
});
//# sourceMappingURL=index.js.map
