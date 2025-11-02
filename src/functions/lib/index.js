"use strict";
// src/functions/index.ts
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mirrorUserStatus = exports.onDeleteQuadra = exports.onDeleteTerritory = exports.onWriteTerritoryData = exports.resetTerritoryProgress = exports.deleteUserAccount = exports.resetPasswordWithToken = exports.requestPasswordReset = exports.notifyOnNewUser = exports.getManagersForNotification = exports.createCongregationAndAdmin = void 0;
exports.withCors = withCors;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-functions/v2/firestore");
const database_1 = require("firebase-functions/v2/database");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const date_fns_1 = require("date-fns");
const crypto = __importStar(require("crypto"));
if (!firebase_admin_1.default.apps.length) {
    firebase_admin_1.default.initializeApp();
}
const db = firebase_admin_1.default.firestore();
(0, v2_1.setGlobalOptions)({ region: "southamerica-east1" });
// ========================================================================
//   CORS WRAPPER
// ========================================================================
function withCors(handler) {
    return (req, res) => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }
        handler(req, res);
    };
}
// ========================================================================
//   FUNÇÕES HTTPS (onCall transformadas em onRequest com withCors)
// ========================================================================
exports.createCongregationAndAdmin = v2_1.https.onRequest(withCors(async (req, res) => {
    try {
        const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp, } = req.body.data;
        if (!adminName ||
            !adminEmail ||
            !adminPassword ||
            !congregationName ||
            !congregationNumber ||
            !whatsapp) {
            res.status(400).json({ error: "Todos os campos são obrigatórios." });
            return;
        }
        let newUser;
        const congQuery = await db
            .collection("congregations")
            .where("number", "==", congregationNumber)
            .get();
        if (!congQuery.empty) {
            res
                .status(409)
                .json({ error: "Uma congregação com este número já existe." });
            return;
        }
        newUser = await firebase_admin_1.default.auth().createUser({
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
            createdAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
            lastUpdate: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
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
        res.status(200).json({
            data: {
                success: true,
                userId: newUser.uid,
                message: "Congregação criada com sucesso!",
            },
        });
    }
    catch (error) {
        if (error.code === "auth/email-already-exists") {
            res.status(409).json({ error: "Este e-mail já está em uso." });
        }
        else {
            v2_1.logger.error("Erro ao criar congregação e admin:", error);
            res
                .status(500)
                .json({ error: error.message || "Erro interno no servidor" });
        }
    }
}));
exports.getManagersForNotification = v2_1.https.onRequest(withCors(async (req, res) => {
    try {
        const { congregationId } = req.body.data;
        if (!congregationId) {
            res.status(400).json({ error: "O ID da congregação é obrigatório." });
            return;
        }
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
        const uniqueManagers = Array.from(new Map(managers.map((item) => [item["uid"], item])).values());
        res.status(200).json({ data: { success: true, managers: uniqueManagers } });
    }
    catch (error) {
        v2_1.logger.error("Erro ao buscar gerentes:", error);
        res
            .status(500)
            .json({ error: "Falha ao buscar contatos dos responsáveis." });
    }
}));
exports.notifyOnNewUser = v2_1.https.onRequest(withCors(async (req, res) => {
    try {
        const { newUserName, congregationId } = req.body.data;
        if (!newUserName || !congregationId) {
            res.status(400).json({ error: "Dados insuficientes para notificação." });
            return;
        }
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
                    createdAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
                };
                notifications.push(userDoc.ref.collection("notifications").add(notification));
            });
        }
        await Promise.all(notifications);
        res.status(200).json({ data: { success: true } });
    }
    catch (error) {
        v2_1.logger.error("Erro ao criar notificações para novo usuário:", error);
        res.status(500).json({ error: "Falha ao enviar notificações." });
    }
}));
exports.requestPasswordReset = v2_1.https.onRequest(withCors(async (req, res) => {
    try {
        const { email } = req.body.data;
        if (!email) {
            res.status(400).json({ error: "O e-mail é obrigatório." });
            return;
        }
        try {
            const user = await firebase_admin_1.default.auth().getUserByEmail(email);
            const token = crypto.randomUUID();
            const expires = Date.now() + 3600 * 1000; // 1 hora
            await db
                .collection("resetTokens")
                .doc(token)
                .set({
                uid: user.uid,
                expires: firebase_admin_1.default.firestore.Timestamp.fromMillis(expires),
            });
            res.status(200).json({ data: { success: true, token } });
        }
        catch (error) {
            if (error.code === "auth/user-not-found") {
                res.status(200).json({
                    data: {
                        success: true,
                        token: null,
                        message: "Se o e-mail existir, um link será enviado.",
                    },
                });
            }
            else {
                throw error;
            }
        }
    }
    catch (error) {
        v2_1.logger.error("Erro ao gerar token de redefinição:", error);
        res
            .status(500)
            .json({ error: "Erro ao iniciar o processo de redefinição." });
    }
}));
exports.resetPasswordWithToken = v2_1.https.onRequest(withCors(async (req, res) => {
    var _a, _b;
    try {
        const { token, newPassword } = req.body.data;
        if (!token || !newPassword) {
            res
                .status(400)
                .json({ error: "Token e nova senha são obrigatórios." });
            return;
        }
        const tokenRef = db.collection("resetTokens").doc(token);
        const tokenDoc = await tokenRef.get();
        if (!tokenDoc.exists) {
            res.status(404).json({ error: "Token inválido ou já utilizado." });
            return;
        }
        if (((_a = tokenDoc.data()) === null || _a === void 0 ? void 0 : _a.expires.toMillis()) < Date.now()) {
            await tokenRef.delete();
            res.status(410).json({ error: "O token de redefinição expirou." });
            return;
        }
        const uid = (_b = tokenDoc.data()) === null || _b === void 0 ? void 0 : _b.uid;
        await firebase_admin_1.default.auth().updateUser(uid, { password: newPassword });
        await tokenRef.delete();
        res.status(200).json({ data: { success: true } });
    }
    catch (error) {
        v2_1.logger.error("Erro ao redefinir senha com token:", error);
        res.status(500).json({ error: "Falha ao atualizar a senha." });
    }
}));
exports.deleteUserAccount = v2_1.https.onRequest(withCors(async (req, res) => {
    var _a;
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ error: "Ação não autorizada. Sem token." });
            return;
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await firebase_admin_1.default.auth().verifyIdToken(idToken);
        const callingUserUid = decodedToken.uid;
        const { userIdToDelete } = req.body.data;
        if (!userIdToDelete) {
            res.status(400).json({ error: "ID do usuário a ser deletado é obrigatório." });
            return;
        }
        const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
        const isAdmin = callingUserSnap.exists && ((_a = callingUserSnap.data()) === null || _a === void 0 ? void 0 : _a.role) === "Administrador";
        if (!isAdmin && callingUserUid !== userIdToDelete) {
            res.status(403).json({ error: "Sem permissão." });
            return;
        }
        if (isAdmin && callingUserUid === userIdToDelete) {
            res.status(403).json({ error: "Admin não pode se autoexcluir." });
            return;
        }
        await firebase_admin_1.default.auth().deleteUser(userIdToDelete);
        const userDocRef = db.collection("users").doc(userIdToDelete);
        if ((await userDocRef.get()).exists) {
            await userDocRef.delete();
        }
        res.status(200).json({ data: { success: true } });
    }
    catch (error) {
        v2_1.logger.error("Erro ao excluir usuário:", error);
        if (error.code === 'auth/id-token-expired') {
            res.status(401).json({ error: "Token expirado. Faça login novamente." });
        }
        else {
            res.status(500).json({ error: error.message || "Falha na exclusão." });
        }
    }
}));
exports.resetTerritoryProgress = v2_1.https.onRequest(withCors(async (req, res) => {
    try {
        const { congregationId, territoryId } = req.body.data;
        if (!congregationId || !territoryId) {
            res.status(400).json({ error: "IDs faltando." });
            return;
        }
        const historyPath = `congregations/${congregationId}/territories/${territoryId}/activityHistory`;
        const quadrasRef = db.collection(`congregations/${congregationId}/territories/${territoryId}/quadras`);
        await db.recursiveDelete(db.collection(historyPath));
        v2_1.logger.log(`[resetTerritory] Histórico para ${territoryId} deletado com sucesso.`);
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
            res.status(200).json({ data: { success: true, message: `Sucesso! ${housesUpdatedCount} casas no território foram resetadas.` } });
        }
        else {
            res.status(200).json({ data: { success: true, message: "Nenhuma alteração necessária, nenhuma casa estava marcada como 'feita'." } });
        }
    }
    catch (error) {
        v2_1.logger.error(`[resetTerritory] FALHA CRÍTICA ao limpar o território:`, error);
        res.status(500).json({ error: "Falha ao processar a limpeza do território." });
    }
}));
// ========================================================================
//   GATILHOS FIRESTORE (UNIFICADOS)
// ========================================================================
async function updateCongregationStats(congregationId) {
    const congregationRef = db.doc(`congregations/${congregationId}`);
    const territoriesRef = congregationRef.collection("territories");
    const territoriesSnapshot = await territoriesRef.get();
    let urbanCount = 0, ruralCount = 0, totalHouses = 0, totalHousesDone = 0, totalQuadras = 0;
    territoriesSnapshot.forEach((doc) => {
        var _a, _b;
        const data = doc.data();
        if (data.type === "rural") {
            ruralCount++;
        }
        else {
            urbanCount++;
            totalHouses += ((_a = data.stats) === null || _a === void 0 ? void 0 : _a.totalHouses) || 0;
            totalHousesDone += ((_b = data.stats) === null || _b === void 0 ? void 0 : _b.housesDone) || 0;
            totalQuadras += data.quadraCount || 0;
        }
    });
    return congregationRef.update({
        territoryCount: urbanCount,
        ruralTerritoryCount: ruralCount,
        totalQuadras,
        totalHouses,
        totalHousesDone,
        lastUpdate: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
    });
}
async function updateTerritoryStats(congregationId, territoryId) {
    const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
    const quadrasSnapshot = await territoryRef.collection("quadras").get();
    let totalHouses = 0;
    let housesDone = 0;
    quadrasSnapshot.forEach((doc) => {
        totalHouses += doc.data().totalHouses || 0;
        housesDone += doc.data().housesDone || 0;
    });
    const progress = totalHouses > 0 ? housesDone / totalHouses : 0;
    await territoryRef.update({
        stats: { totalHouses, housesDone },
        progress,
        quadraCount: quadrasSnapshot.size,
    });
    // Após atualizar o território, atualiza a congregação
    await updateCongregationStats(congregationId);
}
exports.onWriteTerritoryData = (0, firestore_1.onDocumentWritten)("congregations/{congId}/territories/{terrId}/{anyCollection}/{anyId}", async (event) => {
    var _a, _b, _c;
    const { congId, terrId, anyCollection } = event.params;
    // Se a mudança foi em uma casa (que está dentro de uma quadra)
    if (anyCollection === "quadras" && ((_a = event.data) === null || _a === void 0 ? void 0 : _a.after.ref.parent.parent)) {
        const quadraId = event.data.after.ref.parent.parent.id;
        const quadraRef = db.doc(`congregations/${congId}/territories/${terrId}/quadras/${quadraId}`);
        const casasSnapshot = await quadraRef.collection("casas").get();
        const totalHousesInQuadra = casasSnapshot.size;
        const housesDoneInQuadra = casasSnapshot.docs.filter((doc) => doc.data().status === true).length;
        await quadraRef.update({ totalHouses: totalHousesInQuadra, housesDone: housesDoneInQuadra });
        await updateTerritoryStats(congId, terrId);
        const beforeData = (_b = event.data) === null || _b === void 0 ? void 0 : _b.before.data();
        const afterData = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after.data();
        if ((beforeData === null || beforeData === void 0 ? void 0 : beforeData.status) === false && (afterData === null || afterData === void 0 ? void 0 : afterData.status) === true) {
            const territoryRef = db.doc(`congregations/${congId}/territories/${terrId}`);
            const today = (0, date_fns_1.format)(new Date(), "yyyy-MM-dd");
            const activityHistoryRef = territoryRef.collection("activityHistory");
            const todayActivitiesSnap = await activityHistoryRef
                .where("activityDateStr", "==", today)
                .where("type", "==", "work")
                .limit(1)
                .get();
            if (todayActivitiesSnap.empty) {
                await activityHistoryRef.add({
                    type: "work",
                    activityDate: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
                    activityDateStr: today,
                    description: "Primeiro trabalho do dia registrado. (Registro Automático)",
                    userId: "automatic_system_log",
                    userName: "Sistema",
                });
            }
            await territoryRef.update({ lastUpdate: firebase_admin_1.default.firestore.FieldValue.serverTimestamp() });
        }
    }
    // Se a mudança foi diretamente em uma quadra (criação/exclusão)
    else if (anyCollection === "quadras") {
        await updateTerritoryStats(congId, terrId);
    }
    // Se a mudança foi diretamente no território (ex. tipo mudou)
    else {
        await updateCongregationStats(congId);
    }
});
exports.onDeleteTerritory = (0, firestore_1.onDocumentDeleted)("congregations/{congregationId}/territories/{territoryId}", async (event) => {
    if (!event.data) {
        v2_1.logger.warn(`[onDeleteTerritory] Evento de deleção para ${event.params.territoryId} sem dados. Ignorando.`);
        return null;
    }
    const ref = event.data.ref;
    try {
        await firebase_admin_1.default.firestore().recursiveDelete(ref);
        v2_1.logger.log(`[onDeleteTerritory] Território ${event.params.territoryId} e subcoleções deletadas.`);
        // Dispara a atualização da congregação após a exclusão
        await updateCongregationStats(event.params.congregationId);
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
        await firebase_admin_1.default.firestore().recursiveDelete(ref);
        v2_1.logger.log(`[onDeleteQuadra] Quadra ${event.params.quadraId} e subcoleções deletadas.`);
        // Dispara a atualização do território após a exclusão da quadra
        await updateTerritoryStats(event.params.congregationId, event.params.territoryId);
        return { success: true };
    }
    catch (error) {
        v2_1.logger.error(`[onDeleteQuadra] Erro ao deletar ${event.params.quadraId}:`, error);
        throw new v2_1.https.HttpsError("internal", "Falha ao deletar quadra recursivamente.");
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
                lastSeen: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
            });
        }
        else if (eventStatus.state === "online") {
            await userDocRef.update({
                isOnline: true,
                lastSeen: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
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