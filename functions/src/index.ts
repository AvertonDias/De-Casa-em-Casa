import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// ============================================================================
//   DEFINIÇÃO DE TIPOS
// ============================================================================
interface UserData {
  uid: string;
  email: string;
  displayName: string;
  congregationId: string;
  role: 'Administrador' | 'Dirigente' | 'Publicador' | 'pendente';
  status: 'ativo' | 'inativo' | 'pendente';
  fcmTokens?: string[];
}

interface CreateCongregationData {
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    congregationName: string;
    congregationNumber: string;
}

// ============================================================================
//   ESTRUTURA DE FUNÇÕES HTTPS COM CORS MANUAL
// ============================================================================

// Opções de CORS para permitir a comunicação com o seu site.
const cors = require("cors")({
    origin: true, // Permite todas as origens (bom para desenvolvimento)
});

// Wrapper para emular onCall mas com CORS manual em onRequest
function onCallWithCors(handler: (data: any, context: functions.https.CallableContext) => any) {
    return functions.region("southamerica-east1").https.onRequest((req, res) => {
        cors(req, res, async () => {
            // Emula o comportamento de onCall
            if (req.method !== 'POST') {
                res.status(405).send('Method Not Allowed');
                return;
            }
            try {
                if (!req.headers.authorization?.startsWith('Bearer ')) {
                     res.status(401).send('Unauthorized');
                     return;
                }
                const idToken = req.headers.authorization.split('Bearer ')[1];
                const decodedIdToken = await admin.auth().verifyIdToken(idToken);
                
                const context: functions.https.CallableContext = {
                    auth: {
                        uid: decodedIdToken.uid,
                        token: decodedIdToken,
                    },
                    instanceIdToken: req.headers['firebase-instance-id-token'] as string | undefined,
                    rawRequest: req,
                };
                
                const data = req.body.data;
                const result = await handler(data, context);
                res.status(200).send({ data: result });

            } catch (error: any) {
                console.error("Erro na função onRequest:", error);
                if (error instanceof functions.https.HttpsError) {
                     res.status(error.httpErrorCode.status).send({ error: { code: error.code, message: error.message, details: error.details } });
                } else {
                     res.status(500).send({ error: { code: 'internal', message: 'An internal error occurred.' } });
                }
            }
        });
    });
}


// ============================================================================
//   FUNÇÕES HTTPS (onCall) REFEITAS COM O WRAPPER DE CORS
// ============================================================================

export const createCongregationAndAdmin = onCallWithCors(async (data, context) => {
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber } = data as CreateCongregationData;

    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber) {
        throw new functions.https.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
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
                console.error(`Falha CRÍTICA ao limpar usuário órfão '${newUser!.uid}':`, deleteError);
            });
        }
        
        console.error("Erro ao criar congregação e admin:", error);
        
        if (error.code === 'auth/email-already-exists') {
             throw new functions.https.HttpsError("already-exists", "Este e-mail já está em uso.");
        }
        throw new functions.https.HttpsError("internal", "Ocorreu um erro interno.");
    }
});


export const deleteUserAccount = onCallWithCors(async (data, context) => {
  const callingUserUid = context.auth?.uid;
  if (!callingUserUid) {
    throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada. Requer autenticação.");
  }

  const userIdToDelete = data.uid;
  if (!userIdToDelete || typeof userIdToDelete !== 'string') {
    throw new functions.https.HttpsError("invalid-argument", "O ID do usuário a ser excluído não foi fornecido.");
  }

  const callingUserDoc = await db.collection("users").doc(callingUserUid).get();
  const callingUserData = callingUserDoc.data();
  
  if (!callingUserData || callingUserData.role !== "Administrador") {
    throw new functions.https.HttpsError("permission-denied", "Apenas administradores podem excluir usuários.");
  }
  
  if (callingUserUid === userIdToDelete) {
    throw new functions.https.HttpsError("permission-denied", "Um administrador não pode se autoexcluir.");
  }

  try {
    await admin.auth().deleteUser(userIdToDelete);
    const userDocRef = db.collection("users").doc(userIdToDelete);
    await userDocRef.delete();
    return { success: true, message: `Usuário ${userIdToDelete} excluído com sucesso.` };

  } catch (error: any) {
    console.error(`[Delete] FALHA CRÍTICA ao tentar excluir o usuário ${userIdToDelete}:`, error);
    if (error.code === 'auth/user-not-found') {
      const userDocRef = db.collection("users").doc(userIdToDelete);
      if ((await userDocRef.get()).exists) {
        await userDocRef.delete();
      }
      return { success: true, message: "Usuário não encontrado na autenticação, mas documento do Firestore limpo." };
    }
    throw new functions.https.HttpsError("internal", `Falha na exclusão: ${error.message}`);
  }
});


export const resetTerritoryProgress = onCallWithCors(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) { throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada."); }
    
    const { congregationId, territoryId } = data;
    if (!congregationId || !territoryId) { throw new functions.https.HttpsError("invalid-argument", "IDs faltando."); }
    
    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (adminUserSnap.data()?.role !== "Administrador") {
        throw new functions.https.HttpsError("permission-denied", "Ação restrita a administradores.");
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


export const resetPeakUsers = onCallWithCors(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) {
        throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    
    const { congregationId } = data;
    if (!congregationId) {
        throw new functions.https.HttpsError("invalid-argument", "ID da congregação é necessário.");
    }
    
    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (adminUserSnap.data()?.role !== "Administrador") {
        throw new functions.https.HttpsError("permission-denied", "Ação restrita a administradores.");
    }
    
    const congregationRef = db.doc(`congregations/${congregationId}`);
    await congregationRef.update({
        peakOnlineUsers: {
            count: 0,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        }
    });
    return { success: true, message: "Pico de usuários resetado." };
});


export const generateUploadUrl = onCallWithCors(async (data, context) => {
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

    const [url] = await admin.storage().bucket().file(filePath).getSignedUrl(options);
    return { url };
});


// ============================================================================
//   FUNÇÕES DE GATILHO (onWrite, onDelete, etc.)
// ============================================================================

export const notifyAdminOfNewUser = functions.firestore
  .document("users/{userId}")
  .onCreate(async (snapshot, context) => {
    const newUser = snapshot.data() as UserData;
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

export const onHouseWrite = functions.firestore
  .document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}")
  .onWrite(async (change, context) => {
    const { congregationId, territoryId, quadraId } = context.params;
    const quadraRef = db.doc(`congregations/${congregationId}/territories/${territoryId}/quadras/${quadraId}`);
    
    const casasSnapshot = await quadraRef.collection("casas").get();
    const totalHouses = casasSnapshot.size;
    const housesDone = casasSnapshot.docs.filter(doc => doc.data().status === true).length;
    await quadraRef.update({ totalHouses, housesDone, lastUpdate: admin.firestore.FieldValue.serverTimestamp() });
});


export const onQuadraWrite = functions.firestore
  .document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}")
  .onWrite(async (change, context) => {
    const territoryRef = db.doc(`congregations/${context.params.congregationId}/territories/${context.params.territoryId}`);
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


export const onTerritoryWrite = functions.firestore
    .document("congregations/{congregationId}/territories/{territoryId}")
    .onWrite(async (change, context) => {
        const { congregationId } = context.params;
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

export const onTerritoryUpdateForHistory = functions.firestore
  .document("congregations/{congId}/territories/{terrId}")
  .onUpdate(async (change, context) => {
    const dataBefore = change.before.data();
    const dataAfter = change.after.data();

    if (!dataBefore?.stats || !dataAfter?.stats) return null;
    
    const statsBefore = dataBefore.stats;
    const statsAfter = dataAfter.stats;

    if (JSON.stringify(statsBefore) === JSON.stringify(statsAfter)) return null;

    const historyCollectionRef = change.after.ref.collection("activityHistory");

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

export const onDeleteTerritory = functions.firestore
    .document("congregations/{congregationId}/territories/{territoryId}")
    .onDelete(async (snap, context) => {
        await admin.firestore().recursiveDelete(snap.ref);
    });

export const onDeleteQuadra = functions.firestore
    .document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}")
    .onDelete(async (snap, context) => {
        await admin.firestore().recursiveDelete(snap.ref);
    });

export const onUserOnline = functions.database.ref('/status/{uid}')
  .onCreate(async (snapshot, context) => {
    const { uid } = context.params;
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
            transaction.update(congregationRef, {
                peakOnlineUsers: { count: currentOnlineCount, timestamp: admin.firestore.FieldValue.serverTimestamp() }
            });
        }
    });
  });

export const onUserOffline = functions.database.ref('/status/{uid}')
  .onDelete(async (snapshot, context) => {
    const { uid } = context.params;
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


export const scheduledFirestoreExport = functions
  .pubsub.schedule("every day 03:00") 
  .timeZone("America/Sao_Paulo")
  .onRun(async (context) => {
    const firestore = require("@google-cloud/firestore");
    const client = new firestore.v1.FirestoreAdminClient();
    
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    if (!projectId) {
      throw new Error("ID do Projeto Google Cloud não encontrado.");
    }

    const databaseName = client.databasePath(projectId, "(default)");
    const bucketName = "gs://appterritorios-e5bb5.appspot.com"; 
    const timestamp = new Date().toISOString().split('T')[0];
    const outputUriPrefix = `${bucketName}/backups/${timestamp}`;

    try {
      await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: outputUriPrefix,
        collectionIds: [],
      });
      return null;
    } catch (error) {
      console.error("[Backup] FALHA CRÍTICA:", error);
      throw new functions.https.HttpsError("internal", "A operação de exportação falhou.", error as any);
    }
});
