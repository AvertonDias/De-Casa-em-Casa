// functions/src/index.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import type { GetSignedUrlConfig } from "@google-cloud/storage";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cors = require('cors')({origin: true}); 

admin.initializeApp();
const db = admin.firestore();

// ========================================================================
//   FUNÇÕES HTTPS (onCall e onRequest)
// ========================================================================

export const createCongregationAndAdmin = functions.https.onCall(async (data, context) => {
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber } = data;
    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber) {
        throw new functions.https.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
    }
    let newUser: admin.auth.UserRecord | undefined;
    try {
        newUser = await admin.auth().createUser({ email: adminEmail, password: adminPassword, displayName: adminName });
        const batch = db.batch();
        const newCongregationRef = db.collection('congregations').doc();
        batch.set(newCongregationRef, { name: congregationName, number: congregationNumber, territoryCount: 0, ruralTerritoryCount: 0, totalQuadras: 0, totalHouses: 0, totalHousesDone: 0, createdAt: admin.firestore.FieldValue.serverTimestamp(), lastUpdate: admin.firestore.FieldValue.serverTimestamp() });
        const userDocRef = db.collection("users").doc(newUser.uid);
        batch.set(userDocRef, { name: adminName, email: adminEmail, congregationId: newCongregationRef.id, role: "Administrador", status: "ativo" });
        await batch.commit();
        return { success: true, userId: newUser.uid };
    } catch (error: any) {
        if (newUser) { await admin.auth().deleteUser(newUser.uid).catch(deleteError => { console.error(`Falha CRÍTICA ao limpar usuário órfão '${newUser!.uid}':`, deleteError); }); }
        console.error("Erro ao criar congregação e admin:", error);
        if (error.code === 'auth/email-already-exists') { throw new functions.https.HttpsError("already-exists", "Este e-mail já está em uso."); }
        throw new functions.https.HttpsError("internal", "Ocorreu um erro interno.");
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
    return { success: true, message: "Operação de exclusão concluída." };
  } catch (error: any) {
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

    } catch (error) {
        console.error(`[resetTerritory] FALHA CRÍTICA ao limpar o território ${territoryId}:`, error);
        throw new functions.https.HttpsError("internal", "Falha ao processar a limpeza.");
    }
});

export const resetPeakUsers = functions.https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) { throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada."); }
    
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
        await congregationRef.update({
            peakOnlineUsers: { count: 0, timestamp: admin.firestore.FieldValue.serverTimestamp() }
        });
        return { success: true, message: "Pico de usuários resetado." };
    } catch (error) {
        console.error("Falha ao resetar o pico de usuários:", error);
        throw new functions.https.HttpsError("internal", "Não foi possível resetar a estatística.");
    }
});


export const generateUploadUrl = functions.region("southamerica-east1").https.onCall(async (data, context) => {
    if (!context.auth) { throw new functions.https.HttpsError('unauthenticated', 'Ação não autorizada.'); }
    const filePath = data.filePath;
    if (!filePath || typeof filePath !== 'string') { throw new functions.https.HttpsError('invalid-argument', 'O nome do arquivo é necessário.'); }
    
    const options: GetSignedUrlConfig = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType: data.contentType,
    };
    try {
        const [url] = await admin.storage().bucket().file(filePath).getSignedUrl(options);
        return { url };
    } catch (error) {
        console.error("Erro ao gerar URL assinada:", error);
        throw new functions.https.HttpsError('internal', 'Falha ao criar URL.');
    }
});


// ========================================================================
//   CASCATA DE ESTATÍSTICAS E LÓGICA DE NEGÓCIO
// ========================================================================

export const onHouseChange = functions.firestore
  .document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}")
  .onWrite(async (change, context) => {
    
    const quadraRef = change.after.ref.parent.parent!;
    const casasSnapshot = await quadraRef.collection("casas").get();
    await quadraRef.update({
        totalHouses: casasSnapshot.size,
        housesDone: casasSnapshot.docs.filter(doc => doc.data().status === true).length
    });

    const beforeData = change.before.data();
    const afterData = change.after.data();

    if (beforeData?.status === false && afterData?.status === true) {
        const { congregationId, territoryId } = context.params;
        const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
        const historyRef = territoryRef.collection("activityHistory");

        const now = admin.firestore.FieldValue.serverTimestamp();
        await territoryRef.update({ lastUpdate: now });

        const TIME_ZONE = "America/Sao_Paulo";
        const todayString = new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
        
        const lastHistorySnap = await historyRef.orderBy("activityDate", "desc").limit(1).get();
        
        if (lastHistorySnap.empty || lastHistorySnap.docs[0].data().activityDate.toDate().toLocaleDateString("en-CA", {timeZone: TIME_ZONE}) !== todayString) {
            return historyRef.add({
              activityDate: now,
              notes: "Primeiro trabalho do dia registrado. (Registro Automático)",
              userName: "Sistema",
              userId: "system",
              createdAt: now,
            });
        }
    }
    
    return null;
});


export const onQuadraChange = functions.firestore
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
    
    return territoryRef.update({
        stats: { totalHouses, housesDone },
        progress,
        quadraCount: quadrasSnapshot.size,
        lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
    });
});


export const onTerritoryChange = functions.firestore
    .document("congregations/{congregationId}/territories/{territoryId}")
    .onWrite(async (change, context) => {
        const { congregationId } = context.params;
        const congregationRef = db.doc(`congregations/${congregationId}`);
        const territoriesRef = congregationRef.collection("territories");
        
        const territoriesSnapshot = await territoriesRef.get();
        let urbanCount = 0, ruralCount = 0, totalHouses = 0, totalHousesDone = 0, totalQuadras = 0;
        territoriesSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.type === 'rural') { ruralCount++; }
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
//   SISTEMA DE PRESENÇA (NOVA VERSÃO)
// ============================================================================
export const onUserOnline = functions.database.ref('/status/{uid}')
  .onCreate(async (snapshot, context) => {
    const uid = context.params.uid;
    const firestoreUserRef = db.doc(`users/${uid}`);

    try {
      await firestoreUserRef.update({ isOnline: true });
    } catch (error) {
      if ((error as any).code !== 'not-found') console.error(`[Presence] Falha ao marcar ONLINE para ${uid}:`, error);
    }

    const userDocSnap = await firestoreUserRef.get();
    if (!userDocSnap.exists()) return;
    const congregationId = userDocSnap.data()?.congregationId;
    if (!congregationId) return;

    const congregationRef = db.doc(`congregations/${congregationId}`);
    const statusRef = snapshot.ref.parent; 

    return db.runTransaction(async (transaction) => {
        const congDoc = await transaction.get(congregationRef);
        if (!congDoc.exists) return;
        const onlineUsersSnapshot = await statusRef.orderByChild('state').equalTo('online').once('value');
        const currentOnlineCount = onlineUsersSnapshot.numChildren();
        const peakData = congDoc.data()?.peakOnlineUsers || { count: 0 };
        if (currentOnlineCount > peakData.count) {
            transaction.update(congregationRef, { peakOnlineUsers: { count: currentOnlineCount, timestamp: admin.firestore.FieldValue.serverTimestamp() } });
        }
    });
  });

export const onUserOffline = functions.database.ref('/status/{uid}')
  .onDelete(async (snapshot, context) => {
    const uid = context.params.uid;
    const firestoreUserRef = db.doc(`users/${uid}`);

    try {
      await firestoreUserRef.update({
        isOnline: false,
        lastSeen: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      if ((error as any).code !== 'not-found') console.error(`[Presence] Falha ao marcar OFFLINE para ${uid}:`, error);
    }
  });


// ============================================================================
//   OUTROS GATILHOS (Notificação, Exclusão)
// ============================================================================

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
            body: `O usuário "${newUser.name}" se cadastrou e precisa de sua aprovação.`,
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


export const onDeleteTerritory = functions.firestore.document("congregations/{congregationId}/territories/{territoryId}").onDelete((snap) => {
    return admin.firestore().recursiveDelete(snap.ref);
});

export const onDeleteQuadra = functions.firestore.document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}").onDelete((snap) => {
    return admin.firestore().recursiveDelete(snap.ref);
});

export const scheduledFirestoreExport = functions.pubsub.schedule("every day 03:00").timeZone("America/Sao_Paulo").onRun(async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const firestore = require("@google-cloud/firestore");
    const client = new firestore.v1.FirestoreAdminClient();
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    if (!projectId) { throw new Error("ID do Projeto Google Cloud não encontrado."); }
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

// ▼▼▼ FUNÇÃO FINAL PARA SINCRONIZAR A ÚLTIMA ATUALIZAÇÃO ▼▼▼

export const syncLastUpdateFromHistory = functions.firestore
  .document("congregations/{congId}/territories/{terrId}")
  .onUpdate(async (change, context) => {
    
    // Pega os dados do território ANTES e DEPOIS da mudança
    const dataBefore = change.before.data();
    const dataAfter = change.after.data();

    // Combina os históricos urbano (activityHistory) e rural (workLogs)
    const historyBefore = [...(dataBefore.activityHistory || []), ...(dataBefore.workLogs || [])];
    const historyAfter = [...(dataAfter.activityHistory || []), ...(dataAfter.workLogs || [])];

    // Se o histórico não mudou, não faz nada.
    if (historyBefore.length === historyAfter.length && JSON.stringify(historyBefore) === JSON.stringify(historyAfter)) {
        return null;
    }

    // Encontra a data mais recente no novo histórico
    if (historyAfter.length > 0) {
      // Ordena o histórico pela data, do mais novo para o mais antigo
      historyAfter.sort((a, b) => b.date.toMillis() - a.date.toMillis());
      const latestTimestamp = historyAfter[0].date;

      // Se a 'lastUpdate' do território for diferente do timestamp mais recente, corrige.
      if (dataAfter.lastUpdate.toMillis() !== latestTimestamp.toMillis()) {
        console.log(`[Sync] Corrigindo lastUpdate para o território ${context.params.terrId}`);
        return change.after.ref.update({ lastUpdate: latestTimestamp });
      }
    } else {
      // Se o histórico ficou vazio (todos os registros foram excluídos),
      // podemos resetar a lastUpdate para a data de criação do território.
      if (dataAfter.lastUpdate.toMillis() !== dataAfter.createdAt.toMillis()) {
          return change.after.ref.update({ lastUpdate: dataAfter.createdAt });
      }
    }

    return null;
  });
