import * as admin from "firebase-admin";
admin.initializeApp();
const db = admin.firestore();

// --- IMPORTAÇÕES DA NOVA SINTAXE (V2) ---
import { https, logger } from "firebase-functions/v2";
import { onDocumentWritten, onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onValueCreated, onValueDeleted } from "firebase-functions/v2/database";
import { onSchedule } from "firebase-functions/v2/scheduler";
import type { UserData, CreateCongregationData } from "./types";


// ============================================================================
//   FUNÇÕES HTTPS (onCall) - AGORA USANDO A SINTAXE V2
// ============================================================================

const regionalOnCall = (handler: (request: https.CallableRequest<any>) => any | Promise<any>) => {
    return https.onCall({ 
        region: "southamerica-east1",
        cors: true // Habilita o CORS
    }, handler);
};

export const createCongregationAndAdmin = regionalOnCall(async (request) => {
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber } = request.data as CreateCongregationData;

    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber) {
        throw new https.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
    }

    let newUser: admin.auth.UserRecord | undefined;
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
            territoryCount: 0,
            ruralTerritoryCount: 0,
            totalQuadras: 0,
            totalHouses: 0,
            totalHousesDone: 0,
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
        return { success: true, userId: newUser.uid };

    } catch (error: any) {
        if (newUser) {
            await admin.auth().deleteUser(newUser.uid).catch(deleteError => {
                logger.error(`Falha CRÍTICA ao limpar usuário órfão '${newUser!.uid}':`, deleteError);
            });
        }
        
        logger.error("Erro ao criar congregação e admin:", error);
        
        if (error.code === 'auth/email-already-exists') {
             throw new https.HttpsError("already-exists", "Este e-mail já está em uso.");
        }
        throw new https.HttpsError("internal", "Ocorreu um erro interno.");
    }
});

export const deleteUserAccount = regionalOnCall(async (request) => {
  const callingUserUid = request.auth?.uid;
  if (!callingUserUid) {
    throw new https.HttpsError("unauthenticated", "Ação não autorizada. Requer autenticação.");
  }

  const userIdToDelete = request.data.uid;
  if (!userIdToDelete || typeof userIdToDelete !== 'string') {
    throw new https.HttpsError("invalid-argument", "O ID do usuário a ser excluído não foi fornecido.");
  }

  const callingUserDoc = await db.collection("users").doc(callingUserUid).get();
  const callingUserData = callingUserDoc.data();
  
  if (!callingUserData || callingUserData.role !== "Administrador") {
    throw new https.HttpsError("permission-denied", "Apenas administradores podem excluir usuários.");
  }
  
  if (callingUserUid === userIdToDelete) {
    throw new https.HttpsError("permission-denied", "Um administrador não pode se autoexcluir.");
  }

  try {
    await admin.auth().deleteUser(userIdToDelete);
    const userDocRef = db.collection("users").doc(userIdToDelete);
    await userDocRef.delete();
    return { success: true, message: `Usuário ${userIdToDelete} excluído com sucesso.` };

  } catch (error: any) {
    logger.error(`[Delete] FALHA CRÍTICA ao tentar excluir o usuário ${userIdToDelete}:`, error);
    if (error.code === 'auth/user-not-found') {
      const userDocRef = db.collection("users").doc(userIdToDelete);
      if ((await userDocRef.get()).exists) {
        await userDocRef.delete();
      }
      return { success: true, message: "Usuário não encontrado na autenticação, mas documento do Firestore limpo." };
    }
    throw new https.HttpsError("internal", `Falha na exclusão: ${error.message}`);
  }
});

export const resetTerritoryProgress = regionalOnCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) { throw new https.HttpsError("unauthenticated", "Ação não autorizada."); }
    
    const { congregationId, territoryId } = request.data;
    if (!congregationId || !territoryId) { throw new https.HttpsError("invalid-argument", "IDs faltando."); }
    
    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (adminUserSnap.data()?.role !== "Administrador") {
        throw new https.HttpsError("permission-denied", "Ação restrita a administradores.");
    }
    
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
    } else {
        return { success: true, message: "Nenhuma alteração necessária." };
    }
});

export const resetPeakUsers = regionalOnCall(async (request) => {
    if (!request.auth) {
        logger.error("Chamada não autenticada para resetPeakUsersV2");
        throw new https.HttpsError('unauthenticated', 'Ação não autorizada.');
    }

    const uid = request.auth.uid;
    const { congregationId } = request.data;
    
    if (!congregationId) {
        throw new https.HttpsError('invalid-argument', 'ID da congregação é necessário.');
    }

    try {
        const adminUserSnap = await db.collection("users").doc(uid).get();
        if (adminUserSnap.data()?.role !== "Administrador") {
            throw new https.HttpsError('permission-denied', 'Ação restrita a administradores.');
        }
    } catch(error) {
        logger.error("Erro ao verificar permissões:", error);
        throw new https.HttpsError('internal', 'Falha ao verificar permissões.');
    }
    
    try {
        const congregationRef = db.doc(`congregations/${congregationId}`);
        await congregationRef.update({
            peakOnlineUsers: { count: 0, timestamp: admin.firestore.FieldValue.serverTimestamp() }
        });
        logger.info(`Pico de usuários resetado para ${congregationId} pelo admin ${uid}.`);
        return { success: true };
    } catch (error) {
        logger.error(`Falha ao resetar pico para ${congregationId}:`, error);
        throw new https.HttpsError('internal', 'Não foi possível resetar a estatística.');
    }
});

export const generateUploadUrl = regionalOnCall(async (request) => {
    if (!request.auth) {
        throw new https.HttpsError('unauthenticated', 'Ação não autorizada.');
    }
    
    const filePath = request.data.filePath;
    if (!filePath || typeof filePath !== 'string') {
        throw new https.HttpsError('invalid-argument', 'O nome do arquivo é necessário.');
    }

    const options: admin.storage.GetSignedUrlConfig = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType: request.data.contentType,
    };

    const [url] = await admin.storage().bucket().file(filePath).getSignedUrl(options);
    return { url };
});


// ============================================================================
//   FUNÇÕES DE GATILHO (onWrite, onDelete, onCreate) - AGORA COM A SINTAXE V2
// ============================================================================

const firestoreOptions = { region: "southamerica-east1" as const };

export const notifyAdminOfNewUser = onDocumentCreated({ ...firestoreOptions, document: "users/{userId}" }, async (event) => {
    const newUser = event.data?.data() as UserData;
    if (!newUser || newUser.status !== "pendente" || !newUser.congregationId) {
      return null;
    }
    const adminsSnapshot = await db.collection("users")
        .where("congregationId", "==", newUser.congregationId)
        .where("role", "==", "Administrador")
        .get();

    if (adminsSnapshot.empty) return null;
      
    const tokens: string[] = [];
    adminsSnapshot.forEach(adminDoc => {
        const adminData = adminDoc.data() as UserData;
        if (adminData.fcmTokens && Array.isArray(adminData.fcmTokens)) {
          tokens.push(...adminData.fcmTokens);
        }
    });
      
    if (tokens.length === 0) return null;
      
    const payload = {
        notification: {
          title: "Novo Usuário Aguardando Aprovação!",
          body: `O usuário "${newUser.displayName}" se cadastrou e precisa de sua aprovação.`,
          icon: "/icon-192x192.png",
          click_action: "/dashboard/usuarios",
        },
    };
    await admin.messaging().sendToDevice(tokens, payload);
    return { success: true };
});

export const onHouseWrite = onDocumentWritten({ ...firestoreOptions, document: "congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}"}, async (event) => {
    const { congregationId, territoryId, quadraId } = event.params;
    const quadraRef = db.doc(`congregations/${congregationId}/territories/${territoryId}/quadras/${quadraId}`);
    
    const casasSnapshot = await quadraRef.collection("casas").get();
    const totalHouses = casasSnapshot.size;
    const housesDone = casasSnapshot.docs.filter(doc => doc.data().status === true).length;
    await quadraRef.update({ totalHouses, housesDone, lastUpdate: admin.firestore.FieldValue.serverTimestamp() });
});


export const onQuadraWrite = onDocumentWritten({ ...firestoreOptions, document: "congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}"}, async (event) => {
    const territoryRef = db.doc(`congregations/${event.params.congregationId}/territories/${event.params.territoryId}`);
    const quadrasSnapshot = await territoryRef.collection("quadras").get();
      
    const quadraCount = quadrasSnapshot.size;
    let totalHouses = 0;
    let housesDone = 0;
      
    quadrasSnapshot.forEach(doc => {
        totalHouses += doc.data().totalHouses || 0;
        housesDone += doc.data().housesDone || 0;
    });

    const progress = totalHouses > 0 ? (housesDone / totalHouses) : 0;
    const stats = {
        totalHouses, housesDone,
        casasPendentes: totalHouses - housesDone,
        casasFeitas: housesDone,
    };
      
    await territoryRef.update({ 
        stats, progress, quadraCount, 
        lastUpdate: admin.firestore.FieldValue.serverTimestamp() 
    });
});


export const onTerritoryWrite = onDocumentWritten({ ...firestoreOptions, document: "congregations/{congregationId}/territories/{territoryId}"}, async (event) => {
    const { congregationId } = event.params;
    const congregationRef = db.collection("congregations").doc(congregationId);
    const territoriesRef = congregationRef.collection("territories");
            
    const urbanTerritoriesSnapshot = await territoriesRef.where("type", "in", ["urban", null]).get();
    const ruralTerritoriesSnapshot = await territoriesRef.where("type", "==", "rural").get();
            
    const territoryCount = urbanTerritoriesSnapshot.size;
    const ruralTerritoryCount = ruralTerritoriesSnapshot.size;

    let totalQuadras = 0;
    let totalHouses = 0;
    let totalHousesDone = 0;

    urbanTerritoriesSnapshot.forEach(doc => {
        totalQuadras += doc.data().quadraCount || 0;
        totalHouses += doc.data().stats?.totalHouses || 0;
        totalHousesDone += doc.data().stats?.housesDone || 0;
    });
            
    await congregationRef.update({ 
        territoryCount, ruralTerritoryCount,
        totalQuadras, totalHouses, totalHousesDone,
        lastUpdate: admin.firestore.FieldValue.serverTimestamp()
    });
});

export const onTerritoryUpdateForHistory = onDocumentUpdated({ ...firestoreOptions, document: "congregations/{congId}/territories/{terrId}" }, async (event) => {
    const dataBefore = event.data?.before.data();
    const dataAfter = event.data?.after.data();

    if (!dataBefore?.stats || !dataAfter?.stats) return null;
    
    const statsBefore = dataBefore.stats;
    const statsAfter = dataAfter.stats;

    if (JSON.stringify(statsBefore) === JSON.stringify(statsAfter)) return null;

    const historyCollectionRef = event.data!.after.ref.collection("activityHistory");

    if (statsBefore.casasFeitas === 0 && statsAfter.casasFeitas > 0) {
      return historyCollectionRef.add({
        activityDate: admin.firestore.FieldValue.serverTimestamp(),
        notes: "O trabalho no território foi iniciado (registro automático).",
        userName: "Sistema", userId: "system",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    if (statsBefore.casasPendentes > 0 && statsAfter.casasPendentes === 0) {
       return historyCollectionRef.add({
        activityDate: admin.firestore.FieldValue.serverTimestamp(),
        notes: "Todas as casas do território foram trabalhadas (registro automático).",
        userName: "Sistema", userId: "system",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return null;
});

export const onDeleteTerritory = onDocumentDeleted({ ...firestoreOptions, document: "congregations/{congregationId}/territories/{territoryId}"}, async (event) => {
    if (event.data) {
        await admin.firestore().recursiveDelete(event.data.ref);
    }
});

export const onDeleteQuadra = onDocumentDeleted({ ...firestoreOptions, document: "congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}"}, async (event) => {
    if (event.data) {
        await admin.firestore().recursiveDelete(event.data.ref);
    }
});


// ========================================================================
//   FUNÇÕES DE PRESENÇA (RTDB) - SINTAXE V2
// ========================================================================

const rtdbOptions = { region: "southamerica-east1" as const };

export const onUserOnline = onValueCreated({ ...rtdbOptions, ref: "/status/{uid}" }, async (event) => {
    const uid = event.params.uid;
    const firestoreUserRef = db.doc(`users/${uid}`);

    try {
      await firestoreUserRef.update({ isOnline: true });
    } catch (error: any) {
      if (error.code !== 'not-found') logger.error(`[Presence] Falha ao marcar ONLINE para ${uid}:`, error);
    }

    const userDocSnap = await firestoreUserRef.get();
    if (!userDocSnap.exists()) return;
    
    const congregationId = userDocSnap.data()?.congregationId;
    if (!congregationId) return;

    const congregationRef = db.doc(`congregations/${congregationId}`);
    const statusRef = event.data.ref.parent;

    return db.runTransaction(async (transaction) => {
        const congDoc = await transaction.get(congregationRef);
        if (!congDoc.exists) return;

        const onlineUsersSnapshot = await statusRef!.orderByChild('state').equalTo('online').once('value');
        const currentOnlineCount = onlineUsersSnapshot.numChildren();
        
        const peakData = congDoc.data()?.peakOnlineUsers || { count: 0 };

        if (currentOnlineCount > peakData.count) {
            logger.info(`[PeakUsers] Novo pico de ${currentOnlineCount} na congregação ${congregationId}.`);
            transaction.update(congregationRef, {
                peakOnlineUsers: {
                    count: currentOnlineCount,
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                }
            });
        }
    });
});

export const onUserOffline = onValueDeleted({ ...rtdbOptions, ref: "/status/{uid}" }, async (event) => {
    const uid = event.params.uid;
    const firestoreUserRef = db.doc(`users/${uid}`);

    try {
      await firestoreUserRef.update({
        isOnline: false,
        lastSeen: admin.firestore.FieldValue.serverTimestamp()
      });
      logger.info(`[Presence] Usuário ${uid} ficou OFFLINE.`);
    } catch (error: any) {
      if (error.code !== 'not-found') logger.error(`[Presence] Falha ao marcar OFFLINE para ${uid}:`, error);
    }
});

// ============================================================================
//   FUNÇÃO AGENDADA (Scheduler) - SINTAXE V2
// ============================================================================
export const scheduledFirestoreExport = onSchedule({
    schedule: "every day 03:00",
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1"
}, async (event) => {
    const firestore = require("@google-cloud/firestore");
    const client = new firestore.v1.FirestoreAdminClient();
    
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    if (!projectId) {
      throw new Error("ID do Projeto Google Cloud não encontrado.");
    }

    const databaseName = client.databasePath(projectId, "(default)");
    const bucketName = `gs://${projectId}.appspot.com`; // Usa o bucket padrão do projeto
    const timestamp = new Date().toISOString().split('T')[0];
    const outputUriPrefix = `${bucketName}/backups/${timestamp}`;

    try {
      await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: outputUriPrefix,
        collectionIds: [],
      });
      logger.info(`Backup do Firestore concluído para ${outputUriPrefix}`);
      return null;
    } catch (error: any) {
      logger.error("[Backup] FALHA CRÍTICA:", error);
      throw new https.HttpsError("internal", "A operação de exportação falhou.", error);
    }
});
