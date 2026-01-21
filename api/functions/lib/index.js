"use strict";
// src/functions/src/index.ts
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
exports.mirrorUserStatus = exports.onDeleteQuadra = exports.onDeleteTerritory = exports.deleteUserAccountV2 = exports.completeUserProfileV2 = exports.resetPasswordWithTokenV2 = exports.requestPasswordResetV2 = exports.notifyOnNewUserV2 = exports.createCongregationAndAdminV2 = exports.getCongregationIdByNumberV2 = void 0;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-functions/v2/firestore");
const database_1 = require("firebase-functions/v2/database");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const cors_1 = __importDefault(require("cors"));
if (!firebase_admin_1.default.apps.length) {
    firebase_admin_1.default.initializeApp();
}
const db = firebase_admin_1.default.firestore();
(0, v2_1.setGlobalOptions)({ region: "southamerica-east1" });
// Initialize CORS handler as per user instructions
const corsHandler = (0, cors_1.default)({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
});
// ========================================================================
//   HTTPS onRequest Functions (with CORS)
// ========================================================================
exports.getCongregationIdByNumberV2 = v2_1.https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }
        try {
            const { congregationNumber } = req.body.data;
            if (!congregationNumber) {
                res.status(400).json({ error: { message: "O número da congregação é obrigatório." } });
                return;
            }
            const congQuery = await db.collection("congregations").where("number", "==", congregationNumber).limit(1).get();
            if (congQuery.empty) {
                res.status(404).json({ error: { message: "Congregação não encontrada." } });
                return;
            }
            const congregationId = congQuery.docs[0].id;
            res.status(200).json({ data: { success: true, congregationId } });
        }
        catch (error) {
            v2_1.logger.error("Erro em getCongregationIdByNumberV2:", error);
            res.status(500).json({ error: { message: "Erro interno do servidor." } });
        }
    });
});
exports.createCongregationAndAdminV2 = v2_1.https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }
        try {
            const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp } = req.body.data;
            if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
                res.status(400).json({ error: { message: "Todos os campos são obrigatórios." } });
                return;
            }
            const congQuery = await db.collection("congregations").where("number", "==", congregationNumber).get();
            if (!congQuery.empty) {
                res.status(409).json({ error: { message: "Uma congregação com este número já existe." } });
                return;
            }
            const newUser = await firebase_admin_1.default.auth().createUser({ email: adminEmail, password: adminPassword, displayName: adminName });
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
            res.status(200).json({ data: { success: true, userId: newUser.uid, message: "Congregação criada com sucesso!" } });
        }
        catch (error) {
            v2_1.logger.error("Erro em createCongregationAndAdmin:", error);
            if (error.code === 'auth/email-already-exists') {
                res.status(409).json({ error: { message: "Este e-mail já está em uso." } });
            }
            else {
                res.status(500).json({ error: { message: error.message || "Erro interno no servidor" } });
            }
        }
    });
});
exports.notifyOnNewUserV2 = v2_1.https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }
        try {
            const { newUserName, congregationId } = req.body.data;
            if (!newUserName || !congregationId) {
                res.status(400).json({ error: { message: "Dados insuficientes para notificação." } });
                return;
            }
            res.status(200).json({ data: { success: true, message: "Processo de notificação concluído (sem criar notificação no DB)." } });
        }
        catch (error) {
            v2_1.logger.error("Erro no processo de notificação de novo usuário:", error);
            res.status(500).json({ error: { message: "Falha no processo de notificação." } });
        }
    });
});
exports.requestPasswordResetV2 = v2_1.https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }
        try {
            const { email } = req.body.data;
            if (!email) {
                res.status(400).json({ error: { message: 'O e-mail é obrigatório.' } });
                return;
            }
            const user = await firebase_admin_1.default.auth().getUserByEmail(email);
            const token = crypto.randomUUID();
            const expires = Date.now() + 3600 * 1000; // 1 hora
            await db.collection("resetTokens").doc(token).set({
                uid: user.uid,
                expires: firebase_admin_1.default.firestore.Timestamp.fromMillis(expires),
            });
            res.status(200).json({ data: { success: true, token } });
        }
        catch (error) {
            if (error.code === "auth/user-not-found") {
                res.status(200).json({ data: { success: true, token: null, message: "Se o e-mail existir, um link será enviado." } });
            }
            else {
                v2_1.logger.error("Erro ao gerar token de redefinição:", error);
                res.status(500).json({ error: { message: "Erro ao iniciar o processo de redefinição." } });
            }
        }
    });
});
exports.resetPasswordWithTokenV2 = v2_1.https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        var _a, _b;
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }
        try {
            const { token, newPassword } = req.body.data;
            if (!token || !newPassword) {
                res.status(400).json({ error: { message: "Token e nova senha são obrigatórios." } });
                return;
            }
            const tokenRef = db.collection("resetTokens").doc(token);
            const tokenDoc = await tokenRef.get();
            if (!tokenDoc.exists) {
                res.status(404).json({ error: { message: "Token inválido ou já utilizado." } });
                return;
            }
            if (((_a = tokenDoc.data()) === null || _a === void 0 ? void 0 : _a.expires.toMillis()) < Date.now()) {
                await tokenRef.delete();
                res.status(410).json({ error: { message: "O token de redefinição expirou." } });
                return;
            }
            const uid = (_b = tokenDoc.data()) === null || _b === void 0 ? void 0 : _b.uid;
            await firebase_admin_1.default.auth().updateUser(uid, { password: newPassword });
            await tokenRef.delete();
            res.status(200).json({ data: { success: true } });
        }
        catch (error) {
            v2_1.logger.error("Erro ao redefinir senha com token:", error);
            res.status(500).json({ error: { message: "Falha ao atualizar a senha." } });
        }
    });
});
exports.completeUserProfileV2 = v2_1.https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        var _a;
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }
        try {
            const idToken = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split('Bearer ')[1];
            if (!idToken) {
                res.status(401).json({ error: { message: "Ação não autorizada. Token ausente." } });
                return;
            }
            const decodedToken = await firebase_admin_1.default.auth().verifyIdToken(idToken);
            const uid = decodedToken.uid;
            const name = decodedToken.name || 'Nome não encontrado';
            const email = decodedToken.email;
            const { congregationId, whatsapp } = req.body.data;
            if (!congregationId || !whatsapp || !email) {
                res.status(400).json({ error: { message: "Dados insuficientes para criar o perfil." } });
                return;
            }
            const userDocRef = db.collection("users").doc(uid);
            const userDoc = await userDocRef.get();
            if (userDoc.exists) {
                res.status(200).json({ data: { success: true, message: "Perfil já existe." } });
                return;
            }
            await userDocRef.set({
                name: name,
                email: email,
                whatsapp: whatsapp,
                congregationId: congregationId,
                role: "Publicador",
                status: "pendente",
                createdAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
                lastSeen: firebase_admin_1.default.firestore.FieldValue.serverTimestamp()
            });
            res.status(200).json({ data: { success: true, message: "Perfil de usuário criado com sucesso." } });
        }
        catch (error) {
            v2_1.logger.error(`Erro ao completar perfil:`, error);
            if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
                res.status(401).json({ error: { message: "Token de autenticação inválido ou expirado." } });
            }
            else {
                res.status(500).json({ error: { message: error.message || "Falha ao criar perfil de usuário." } });
            }
        }
    });
});
exports.deleteUserAccountV2 = v2_1.https.onRequest({ region: "southamerica-east1" }, (req, res) => {
    corsHandler(req, res, async () => {
        var _a;
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }
        try {
            const idToken = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split('Bearer ')[1];
            if (!idToken) {
                res.status(401).json({ error: { message: "Ação não autorizada. Token ausente." } });
                return;
            }
            const decodedToken = await firebase_admin_1.default.auth().verifyIdToken(idToken);
            const callingUserUid = decodedToken.uid;
            const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
            const callingUserData = callingUserSnap.data();
            if (!callingUserData) {
                res.status(404).json({ error: { message: 'Usuário requisitante não encontrado.' } });
                return;
            }
            const { userIdToDelete } = req.body.data;
            if (!userIdToDelete) {
                res.status(400).json({ error: { message: 'ID do usuário a ser deletado é obrigatório.' } });
                return;
            }
            const isCallingUserAdmin = callingUserData.role === "Administrador";
            const isSelfDelete = callingUserUid === userIdToDelete;
            const isAdminDeletingOther = isCallingUserAdmin && !isSelfDelete;
            if (isCallingUserAdmin && isSelfDelete) {
                res.status(403).json({ error: { message: 'Admin não pode se autoexcluir por esta função.' } });
                return;
            }
            if (!isSelfDelete && !isAdminDeletingOther) {
                res.status(403).json({ error: { message: 'Sem permissão para esta ação.' } });
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
            if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
                res.status(401).json({ error: { message: "Token de autenticação inválido ou expirado." } });
            }
            else {
                res.status(500).json({ error: { message: error.message || "Falha na exclusão." } });
            }
        }
    });
});
// ========================================================================
//   GATILHOS FIRESTORE
// ========================================================================
exports.onDeleteTerritory = (0, firestore_1.onDocumentDeleted)("congregations/{congregationId}/territories/{territoryId}", async (event) => {
    if (!event.data) {
        v2_1.logger.warn(`[onDeleteTerritory] Evento de deleção para ${event.params.territoryId} sem dados. Ignorando.`);
        return null;
    }
    const ref = event.data.ref;
    try {
        await firebase_admin_1.default.firestore().recursiveDelete(ref);
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
        await firebase_admin_1.default.firestore().recursiveDelete(ref);
        v2_1.logger.log(`[onDeleteQuadra] Quadra ${event.params.quadraId} e subcoleções deletadas.`);
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
    region: "us-central1", // O sistema de presença funciona melhor na região padrão
}, async (event) => {
    const eventStatus = event.data.after.val();
    const uid = event.params.uid;
    const userDocRef = db.doc(`users/${uid}`);
    try {
        const userDoc = await userDocRef.get();
        if (!userDoc.exists)
            return null; // Usuário não existe no Firestore
        const updateData = {
            isOnline: false,
            lastSeen: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
        };
        if (eventStatus && eventStatus.state === "online") {
            updateData.isOnline = true;
        }
        await userDocRef.update(updateData);
    }
    catch (err) {
        if (err.code !== 5) {
            v2_1.logger.error(`[Presence Mirror] Falha para o UID ${uid}:`, err);
        }
    }
    return null;
});
//# sourceMappingURL=index.js.map