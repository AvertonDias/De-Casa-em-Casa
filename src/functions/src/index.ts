
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// ============================================================================
//   FUNÇÕES DE CRIAÇÃO E GERENCIAMENTO DE USUÁRIOS
// ============================================================================
export const createCongregationAndAdmin = functions.https.onCall(async (data, context) => {
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber } = data;
    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber) {
        throw new functions.https.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
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
    } catch (error) {
        if (newUser) {
            await admin.auth().deleteUser(newUser.uid).catch(deleteError => {
                console.error(`Falha CRÍTICA ao limpar usuário órfão '${newUser.uid}':`, deleteError);
            });
        }
        console.error("Erro ao criar congregação e admin:", error);
        if ((error as any).code === 'auth/email-already-exists') {
            throw new functions.https.HttpsError("already-exists", "Este e-mail já está em uso.");
        }
        throw new functions.https.HttpsError("internal", "Ocorreu um erro interno.");
    }
});

export const notifyAdminOfNewUser = functions.firestore.document("users/{userId}").onCreate(async (snapshot, context) => {
    const newUser = snapshot.data();
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
        const adminData = adminDoc.data();
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
    try {
        await admin.messaging().sendToDevice(tokens, payload);
        return { success: true };
    } catch (error) {
        console.error("[notifyAdmin] FALHA CRÍTICA:", error);
        return null;
    }
});

export const deleteUserAccount = functions.https.onCall(async (data, context) => {
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
        return { success: true };
    } catch (error) {
        console.error("Erro CRÍTICO ao excluir usuário:", error);
        if ((error as any).code === 'auth/user-not-found') {
            const userDocRef = db.collection("users").doc(userIdToDelete);
            if ((await userDocRef.get()).exists) {
                await userDocRef.delete();
            }
            return { success: true, message: "Usuário não encontrado na Auth, mas removido do Firestore." };
        }
        throw new functions.https.HttpsError("internal", "Falha na exclusão.");
    }
});

// ============================================================================
//   FUNÇÕES DE ESTATÍSTICAS, MANUTENÇÃO E HISTÓRICO
// ============================================================================

export const onHouseWrite = functions.firestore
  .document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}")
  .onWrite(async (change, context) => {
    const { congregationId, territoryId, quadraId } = context.params;
    const quadraRef = db.doc(`congregations/${congregationId}/territories/${territoryId}/quadras/${quadraId}`);
    try {
        const casasSnapshot = await quadraRef.collection("casas").get();
        const totalHouses = casasSnapshot.size;
        const housesDone = casasSnapshot.docs.filter(doc => doc.data().status === true).length;
        
        return quadraRef.update({
            totalHouses: totalHouses,
            housesDone: housesDone,
            lastUpdate: admin.firestore.FieldValue.serverTimestamp()
        });

    } catch (error) {
      console.error(`[Stats-Quadra] FALHA ao atualizar quadra ${quadraId}:`, error);
      return null;
    }
});

export const onQuadraWrite = functions.firestore
  .document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}")
  .onWrite(async (change, context) => {
    const territoryRef = db.doc(`congregations/${context.params.congregationId}/territories/${context.params.territoryId}`);
    try {
      const quadrasSnapshot = await territoryRef.collection("quadras").get();
      let totalHouses = 0;
      let housesDone = 0;
      quadrasSnapshot.forEach(doc => {
        totalHouses += doc.data().totalHouses || 0;
        housesDone += doc.data().housesDone || 0;
      });

      const progress = totalHouses > 0 ? (housesDone / totalHouses) : 0;
      
      return territoryRef.update({
          stats: {
              totalHouses: totalHouses,
              housesDone: housesDone,
              casasPendentes: totalHouses - housesDone,
              casasFeitas: housesDone,
          },
          progress: progress,
          quadraCount: quadrasSnapshot.size,
          lastUpdate: admin.firestore.FieldValue.serverTimestamp()
      });

    } catch (error) {
      console.error(`[Stats-Territory] FALHA ao atualizar o território ${context.params.territoryId}: `, error);
      return null;
    }
});

export const onTerritoryWrite = functions.firestore
    .document("congregations/{congregationId}/territories/{territoryId}")
    .onWrite(async (change, context) => {
        const { congregationId } = context.params;
        const congregationRef = db.collection("congregations").doc(congregationId);
        const territoriesRef = congregationRef.collection("territories");
        
        try {
            const urbanTerritoriesSnapshot = await territoriesRef.where("type", "in", ["urban", null, ""]).get();
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
            
            return congregationRef.update({
                territoryCount, ruralTerritoryCount,
                totalQuadras, totalHouses, totalHousesDone,
                lastUpdate: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch(error) {
            console.error(`[Stats-Congregation] FALHA ao atualizar congregação ${congregationId}:`, error);
            return null;
        }
    });

export const resetTerritoryProgress = functions.https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) { throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada."); }
    
    const { congregationId, territoryId } = data;
    if (!congregationId || !territoryId) { throw new functions.https.HttpsError("invalid-argument", "IDs faltando."); }
    
    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (adminUserSnap.data()?.role !== "Administrador") {
        throw new functions.https.HttpsError("permission-denied", "Ação restrita a administradores.");
    }
    
    try {
        const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
        const quadrasRef = territoryRef.collection("quadras");
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

    } catch (error) {
        console.error(`[resetTerritory] FALHA CRÍTICA ao limpar o território ${territoryId}:`, error);
        throw new functions.https.HttpsError("internal", "Falha ao processar a limpeza.");
    }
});

// NOVA FUNÇÃO: Disparada quando uma casa é marcada, para registrar o trabalho diário.
export const logDailyWorkAndUpdateTimestamp = functions.firestore
  .document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}")
  .onWrite(async (change, context) => {
    const { congregationId, territoryId } = context.params;

    const dataAfter = change.after.data();
    const dataBefore = change.before.data();

    // Condição de saída: a função só roda se o status mudou para 'true'
    if (!dataAfter || dataAfter.status !== true || (dataBefore && dataBefore.status === true)) {
      return null;
    }
    
    const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
    const historyCollectionRef = territoryRef.collection("activityHistory");

    const TIME_ZONE = "America/Sao_Paulo";
    const todayString = new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
    
    try {
      const territorySnap = await territoryRef.get();
      if (!territorySnap.exists) {
        console.log(`[History] Território ${territoryId} não encontrado.`);
        return null;
      }
      const lastWorkedTimestamp = territorySnap.data()?.lastWorkedTimestamp;
      
      let lastWorkedDateString = '';
      if (lastWorkedTimestamp) {
        lastWorkedDateString = lastWorkedTimestamp.toDate().toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
      }

      // Se a última data trabalhada for a mesma de hoje, apenas atualiza o timestamp e sai.
      if (lastWorkedDateString === todayString) {
        return territoryRef.update({
            lastWorkedTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      
      // Se chegou aqui, é o primeiro trabalho do dia neste território. Registra!
      console.info(`[History] Registrando trabalho diário para o território ${territoryId}.`);
      
      const batch = db.batch();
      
      // 1. Adiciona o novo registro no histórico
      const newHistoryRef = historyCollectionRef.doc();
      batch.set(newHistoryRef, {
        activityDate: admin.firestore.FieldValue.serverTimestamp(),
        notes: `Trabalho registrado neste dia.`,
        userName: "Sistema",
        userId: "system",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      // 2. Atualiza o timestamp no documento do território
      batch.update(territoryRef, {
        lastWorkedTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      return batch.commit();

    } catch (error) {
      console.error(`[History] FALHA CRÍTICA ao registrar trabalho para território ${territoryId}:`, error);
      return null;
    }
});


// ============================================================================
//   FUNÇÕES DE PRESENÇA E PICO DE USUÁRIOS
// ============================================================================
export const resetPeakUsers = functions.https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) {
        throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (adminUserSnap.data()?.role !== "Administrador") {
        throw new functions.https.HttpsError("permission-denied", "Ação restrita a administradores.");
    }
    const { congregationId } = data;
    if (!congregationId) {
        throw new functions.https.HttpsError("invalid-argument", "ID da congregação é necessário.");
    }
    try {
        const congregationRef = db.doc(`congregations/${congregationId}`);
        await congregationRef.update({ peakOnlineUsers: { count: 0, timestamp: admin.firestore.FieldValue.serverTimestamp() } });
        return { success: true };
    } catch (error) {
        console.error("Falha ao resetar o pico:", error);
        throw new functions.https.HttpsError("internal", "Não foi possível resetar.");
    }
});

export const handleUserPresence = functions.database.ref('/status/{uid}')
    .onWrite(async (change, context) => {
    const eventStatus = change.after.val();
    const firestoreUserRef = db.doc(`users/${context.params.uid}`);
    
    const isOffline = !eventStatus || eventStatus.state === 'offline';
    
    try {
        await firestoreUserRef.update({
            isOnline: !isOffline,
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        if ((error as any).code !== 'not-found') {
            console.error(`Falha ao atualizar presença para usuário ${context.params.uid}:`, error);
        }
    }
    
    if (isOffline) return; 

    const userDocSnap = await db.doc(`users/${context.params.uid}`).get();
    if (!userDocSnap.exists()) return;

    const congregationId = userDocSnap.data()?.congregationId;
    if (!congregationId) return;

    const congregationRef = db.doc(`congregations/${congregationId}`);
    const statusRef = change.after.ref.parent; // Referência a /status
    
    return db.runTransaction(async (transaction) => {
        const congDoc = await transaction.get(congregationRef);
        if (!congDoc.exists) return;

        // Query RTDB for online users
        const onlineUsersSnapshot = await statusRef.orderByChild('state').equalTo('online').once('value');
        const currentOnlineCount = onlineUsersSnapshot.numChildren();
        
        const peakData = congDoc.data()?.peakOnlineUsers || { count: 0 };
        
        if (currentOnlineCount > peakData.count) {
            transaction.update(congregationRef, { peakOnlineUsers: { count: currentOnlineCount, timestamp: admin.firestore.FieldValue.serverTimestamp() } });
        }
    });
});

// ============================================================================
//   FUNÇÕES DE SISTEMA
// ============================================================================
export const onDeleteTerritory = functions.firestore
  .document("congregations/{congregationId}/territories/{territoryId}")
  .onDelete(async (snap, context) => {
    return admin.firestore().recursiveDelete(snap.ref);
});

export const onDeleteQuadra = functions.firestore
  .document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}")
  .onDelete(async (snap, context) => {
    return admin.firestore().recursiveDelete(snap.ref);
});

export const scheduledFirestoreExport = functions.pubsub.schedule("every day 03:00")
  .timeZone("America/Sao_Paulo")
  .onRun(async (context) => {
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
    } catch (error) {
        console.error("[Backup] FALHA CRÍTICA:", error);
        throw new functions.https.HttpsError("internal", "A operação de exportação falhou.", error);
    }
});

export const generateUploadUrl = functions.region("southamerica-east1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Ação não autorizada.');
    }
    const filePath = data.filePath;
    if (!filePath || typeof filePath !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'O nome do arquivo é necessário.');
    }
    const options: admin.storage.GetSignedUrlConfig = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, 
        contentType: data.contentType,
    };
    try {
        const [url] = await admin.storage().bucket().file(filePath).getSignedUrl(options);
        return { url };
    } catch (error) {
        console.error("Erro ao gerar a URL assinada:", error);
        throw new functions.https.HttpsError('internal', 'Não foi possível criar a URL de upload.');
    }
});
