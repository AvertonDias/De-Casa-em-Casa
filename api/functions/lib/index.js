"use strict";
// src/functions/src/index.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mirrorUserStatus = exports.onDeleteQuadra = exports.onDeleteTerritory = exports.createCongregationAndAdminV2 = void 0;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-functions/v2/firestore");
const database_1 = require("firebase-functions/v2/database");
const firebase_admin_1 = __importDefault(require("firebase-admin"));
if (!firebase_admin_1.default.apps.length) {
    firebase_admin_1.default.initializeApp();
}
const db = firebase_admin_1.default.firestore();
(0, v2_1.setGlobalOptions)({ region: "southamerica-east1" });
// ========================================================================
//   CONFIGURAÇÃO DE CORS para Funções onCall
// ========================================================================
const corsOptions = [
    "https://de-casa-em-casa.web.app",
    "https://de-casa-em-casa.firebaseapp.com",
    "https://de-casa-em-casa.vercel.app",
    /https:\/\/de-casa-em-casa--pr-.*\.web\.app/,
    /https:\/\/.*\.vercel\.app/,
    /https:\/\/.*\.cloudworkstations\.dev/,
    "http://localhost:3000"
];
// ========================================================================
//   FUNÇÕES HTTPS (onCall)
// ========================================================================
exports.createCongregationAndAdminV2 = v2_1.https.onCall({ cors: corsOptions }, async (request) => {
    try {
        const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp, } = request.data;
        if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
            throw new v2_1.https.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
        }
        const congQuery = await db.collection("congregations").where("number", "==", congregationNumber).get();
        if (!congQuery.empty) {
            throw new v2_1.https.HttpsError("already-exists", "Uma congregação com este número já existe.");
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
        return {
            success: true,
            userId: newUser.uid,
            message: "Congregação criada com sucesso!",
        };
    }
    catch (error) {
        v2_1.logger.error("Erro em createCongregationAndAdmin:", error);
        if (error instanceof v2_1.https.HttpsError) {
            throw error;
        }
        if (error.code === "auth/email-already-exists") {
            throw new v2_1.https.HttpsError("already-exists", "Este e-mail já está em uso.");
        }
        throw new v2_1.https.HttpsError("internal", error.message || "Erro interno no servidor");
    }
});
// Nota: As outras funções HTTPS foram removidas no código anterior,
// se você ainda as utiliza, elas também devem ser convertidas para onCall.
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
    region: "us-central1",
}, async (event) => {
    var _a, _b;
    const eventStatus = event.data.after.val();
    const uid = event.params.uid;
    const userDocRef = db.doc(`users/${uid}`);
    try {
        const userDoc = await userDocRef.get();
        if (!userDoc.exists)
            return null;
        if (!eventStatus || eventStatus.state === "offline") {
            if (((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.isOnline) === true) {
                await userDocRef.update({
                    isOnline: false,
                    lastSeen: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
                });
            }
        }
        else if (eventStatus.state === "online") {
            if (((_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.isOnline) !== true) {
                await userDocRef.update({
                    isOnline: true,
                    lastSeen: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
                });
            }
        }
    }
    catch (err) {
        if (err.code !== 5) {
            v2_1.logger.error(`[Presence Mirror] Falha para ${uid}:`, err);
        }
    }
    return null;
});
//# sourceMappingURL=index.js.map