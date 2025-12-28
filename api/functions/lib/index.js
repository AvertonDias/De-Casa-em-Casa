
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mirrorUserStatus = exports.onDeleteQuadra = exports.onDeleteTerritory = exports.deleteUserAccountV2 = exports.resetPasswordWithTokenV2 = exports.requestPasswordResetV2 = exports.notifyOnNewUserV2 = exports.createCongregationAndAdminV2 = void 0;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-functions/v2/firestore");
const database_1 = require("firebase-functions/v2/database");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const cors_1 = __importDefault(require("cors"));
// Crie uma instância do CORS que permite requisições da sua aplicação
const corsHandler = (0, cors_1.default)({
    origin: [
        "https://de-casa-em-casa.web.app",
        "https://de-casa-em-casa.firebaseapp.com",
        "https://de-casa-em-casa.vercel.app",
        /https:\/\/de-casa-em-casa--pr-.*\.web\.app/,
        /https:\/\/.*\.vercel\.app/,
        /https:\/\/.*\.cloudworkstations\.dev/,
        "http://localhost:3000"
    ]
});
if (!firebase_admin_1.default.apps.length) {
    firebase_admin_1.default.initializeApp();
}
const db = firebase_admin_1.default.firestore();
(0, v2_1.setGlobalOptions)({ region: "southamerica-east1" });
// ========================================================================
//   FUNÇÕES HTTPS (onRequest)
// ========================================================================
// Wrapper para simplificar a aplicação de CORS
function createHttpsFunction(handler) {
    return v2_1.https.onRequest(async (req, res) => {
        // Envolve sua função com o corsHandler
        corsHandler(req, res, async () => {
            try {
                await handler(req, res);
            }
            catch (e) {
                v2_1.logger.error("Function Error:", e);
                // Garante que uma resposta seja enviada mesmo em caso de erro inesperado
                if (!res.headersSent) {
                    res.status(500).json({ success: false, error: "Internal Server Error", message: e.message });
                }
            }
        });
    });
}
exports.createCongregationAndAdminV2 = createHttpsFunction(async (req, res) => {
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp, } = req.body; // <-- DADOS VÊM DIRETAMENTE DO BODY AGORA
    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
        return res.status(400).json({ success: false, error: "Todos os campos são obrigatórios." });
    }
    try {
        const congQuery = await db.collection("congregations").where("number", "==", congregationNumber).get();
        if (!congQuery.empty) {
            return res.status(409).json({ success: false, error: "Uma congregação com este número já existe." });
        }
        const newUser = await firebase_admin_1.default.auth().createUser({
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
        return res.status(200).json({
            success: true,
            userId: newUser.uid,
            message: "Congregação criada com sucesso!",
        });
    }
    catch (error) {
        v2_1.logger.error("Erro em createCongregationAndAdmin:", error);
        if (error.code === "auth/email-already-exists") {
            return res.status(409).json({ success: false, error: "Este e-mail já está em uso." });
        }
        else {
            return res.status(500).json({ success: false, error: error.message || "Erro interno no servidor" });
        }
    }
});
exports.notifyOnNewUserV2 = createHttpsFunction(async (req, res) => {
    const { newUserName, congregationId } = req.body;
    if (!newUserName || !congregationId) {
        return res.status(400).json({ success: false, error: "Dados insuficientes para notificação." });
    }
    try {
        return res.status(200).json({ success: true, message: "Processo de notificação concluído (sem criar notificação no DB)." });
    }
    catch (error) {
        v2_1.logger.error("Erro no processo de notificação de novo usuário:", error);
        return res.status(500).json({ success: false, error: "Falha no processo de notificação." });
    }
});
exports.requestPasswordResetV2 = createHttpsFunction(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, error: "O e-mail é obrigatório." });
    }
    try {
        const user = await firebase_admin_1.default.auth().getUserByEmail(email);
        const token = crypto.randomUUID();
        const expires = Date.now() + 3600 * 1000; // 1 hora
        await db.collection("resetTokens").doc(token).set({
            uid: user.uid,
            expires: firebase_admin_1.default.firestore.Timestamp.fromMillis(expires),
        });
        return res.status(200).json({ success: true, token });
    }
    catch (error) {
        if (error.code === "auth/user-not-found") {
            // Não vaze a informação se o usuário existe ou não
            return res.status(200).json({
                success: true,
                token: null,
                message: "Se o e-mail existir, um link será enviado.",
            });
        }
        else {
            v2_1.logger.error("Erro ao gerar token de redefinição:", error);
            return res.status(500).json({ success: false, error: "Erro ao iniciar o processo de redefinição." });
        }
    }
});
exports.resetPasswordWithTokenV2 = createHttpsFunction(async (req, res) => {
    var _a, _b;
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ success: false, error: "Token e nova senha são obrigatórios." });
    }
    try {
        const tokenRef = db.collection("resetTokens").doc(token);
        const tokenDoc = await tokenRef.get();
        if (!tokenDoc.exists) {
            return res.status(404).json({ success: false, error: "Token inválido ou já utilizado." });
        }
        if (((_a = tokenDoc.data()) === null || _a === void 0 ? void 0 : _a.expires.toMillis()) < Date.now()) {
            await tokenRef.delete();
            return res.status(410).json({ success: false, error: "O token de redefinição expirou." });
        }
        const uid = (_b = tokenDoc.data()) === null || _b === void 0 ? void 0 : _b.uid;
        await firebase_admin_1.default.auth().updateUser(uid, { password: newPassword });
        await tokenRef.delete();
        return res.status(200).json({ success: true });
    }
    catch (error) {
        v2_1.logger.error("Erro ao redefinir senha com token:", error);
        return res.status(500).json({ success: false, error: "Falha ao atualizar a senha." });
    }
});
exports.deleteUserAccountV2 = v2_1.https.onCall(async (request) => {
    var _a;
    // A verificação do token de autenticação é feita automaticamente pelo onCall
    if (!request.auth) {
        throw new v2_1.https.HttpsError('unauthenticated', 'Ação não autorizada.');
    }
    const callingUserUid = request.auth.uid;
    const { userIdToDelete } = request.data;
    if (!userIdToDelete) {
        throw new v2_1.https.HttpsError('invalid-argument', 'ID do usuário a ser deletado é obrigatório.');
    }
    try {
        const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
        if (!callingUserSnap.exists) {
            throw new v2_1.https.HttpsError('not-found', 'Usuário requisitante não encontrado.');
        }
        const isCallingUserAdmin = ((_a = callingUserSnap.data()) === null || _a === void 0 ? void 0 : _a.role) === "Administrador";
        const isSelfDelete = callingUserUid === userIdToDelete;
        const isAdminDeletingOther = isCallingUserAdmin && !isSelfDelete;
        if (!isSelfDelete && !isAdminDeletingOther) {
            throw new v2_1.https.HttpsError('permission-denied', 'Sem permissão para esta ação.');
        }
        if (isCallingUserAdmin && isSelfDelete) {
            throw new v2_1.https.HttpsError('permission-denied', 'Admin não pode se autoexcluir por esta função.');
        }
        await firebase_admin_1.default.auth().deleteUser(userIdToDelete);
        const userDocRef = db.collection("users").doc(userIdToDelete);
        if ((await userDocRef.get()).exists) {
            await userDocRef.delete();
        }
        return { success: true };
    }
    catch (error) {
        v2_1.logger.error("Erro ao excluir usuário:", error);
        if (error instanceof v2_1.https.HttpsError) {
            throw error; // Re-throw HttpsError
        }
        throw new v2_1.https.HttpsError('internal', error.message || "Falha na exclusão.");
    }
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
        // Sempre atualiza o documento do Firestore se o usuário existir.
        // Isso garante que lastSeen seja atualizado mesmo se o estado isOnline não mudar.
        await userDocRef.update(updateData);
    }
    catch (err) {
        // Ignora o erro se o documento do usuário não for encontrado (código 5)
        // Isso pode acontecer se o usuário for excluído enquanto o listener de presença ainda estiver ativo.
        if (err.code !== 5) {
            v2_1.logger.error(`[Presence Mirror] Falha para o UID ${uid}:`, err);
        }
    }
    return null;
});
//# sourceMappingURL=index.js.map

    