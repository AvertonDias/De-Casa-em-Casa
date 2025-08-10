// functions/src/index.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { GetSignedUrlConfig } from "@google-cloud/storage";
import { format } from 'date-fns';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cors = require('cors')({ origin: true });

admin.initializeApp();
const db = admin.firestore();
const rtdb = admin.database();

// Helper para definir as opções de função padrão
const functionOptions = {
    region: "southamerica-east1",
    serviceAccount: "deploy-functions-sa@appterritorios-e5bb5.iam.gserviceaccount.com"
};

// ========================================================================
//   FUNÇÕES HTTPS (onCall e onRequest)
// ========================================================================

export const createCongregationAndAdmin = functions
  .region(functionOptions.region)
  .https.onRequest((req, res) => {
      cors(req, res, async () => {
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Método não permitido' });
        }

        const { adminName, adminEmail, adminPassword, congregationName, congregationNumber } = req.body;

        if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber) {
          return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
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
            territoryCount: 0, ruralTerritoryCount: 0, totalQuadras: 0, totalHouses: 0, totalHousesDone: 0,
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

          return res.status(200).json({ success: true, userId: newUser.uid, message: 'Congregação criada com sucesso!' });

        } catch (error: any) {
          if (newUser) {
            await admin.auth().deleteUser(newUser.uid).catch(deleteError => {
              console.error(`Falha CRÍTICA ao limpar usuário órfão '${newUser?.uid}':`, deleteError);
            });
          }

          console.error("Erro ao criar congregação e admin:", error);
          if (error.code === 'auth/email-already-exists') {
            return res.status(409).json({ error: "Este e-mail já está em uso." });
          }
          return res.status(500).json({ error: error.message || 'Erro interno no servidor' });
        }
    });
});


export const deleteUserAccount = functions
  .region(functionOptions.region)
  .https.onCall(async (data, context) => {
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


export const resetTerritoryProgress = functions
    .region(functionOptions.region)
    .runWith({ serviceAccount: functionOptions.serviceAccount })
    .https.onCall(async (data, context) => {
        const uid = context.auth?.uid;
        if (!uid) { throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada."); }

        const { congregationId, territoryId } = data;
        if (!congregationId || !territoryId) { throw new functions.https.HttpsError("invalid-argument", "IDs faltando."); }

        const adminUserSnap = await db.collection("users").doc(uid).get();
        if (adminUserSnap.data()?.role !== "Administrador") {
            throw new functions.https.HttpsError("permission-denied", "Ação restrita a administradores.");
        }

        const historyPath = `congregations/${congregationId}/territories/${territoryId}/activityHistory`;
        const quadrasRef = db.collection(`congregations/${congregationId}/territories/${territoryId}/quadras`);
        
        try {
            await admin.firestore().recursiveDelete(db.collection(historyPath));
            console.log(`[resetTerritory] Histórico para ${territoryId} deletado com sucesso.`);
        } catch (error) {
            console.error(`[resetTerritory] Falha ao deletar histórico para ${territoryId}:`, error);
            throw new functions.https.HttpsError("internal", "Falha ao limpar histórico do território.");
        }
        
        try {
            let housesUpdatedCount = 0;
            await db.runTransaction(async (transaction) => {
                const quadrasSnapshot = await transaction.get(quadrasRef);
                
                const housesToUpdate: { ref: FirebaseFirestore.DocumentReference, data: { status: boolean } }[] = [];

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
                return { success: true, message: `Sucesso! ${housesUpdatedCount} casas no território foram resetadas.` };
            } else {
                return { success: true, message: "Nenhuma alteração necessária, nenhuma casa estava marcada como 'feita'." };
            }
        } catch (error) {
            console.error(`[resetTerritory] FALHA CRÍTICA na transação ao limpar o território ${territoryId}:`, error);
            throw new functions.https.HttpsError("internal", "Falha ao processar a limpeza das casas do território.");
        }
    });

export const generateUploadUrl = functions
  .region(functionOptions.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Ação não autorizada.');
    }
    const { filePath, contentType } = data;
    if (!filePath || typeof filePath !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'O nome do arquivo é necessário.');
    }

    const options: GetSignedUrlConfig = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType: contentType,
    };
    try {
        const [url] = await admin.storage().bucket().file(filePath).getSignedUrl(options);
        return { url };
    } catch (error) {
        console.error("Erro ao gerar URL assinada:", error);
        throw new functions.https.HttpsError('internal', 'Falha ao criar URL.');
    }
});

export const sendFeedbackEmail = functions
  .region(functionOptions.region)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "O usuário deve estar autenticado para enviar feedback.");
    }
    try {
        const { name, email, subject, message } = data;
        if (!name || !email || !subject || !message) {
            throw new functions.https.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
        }
        console.log('--- NOVO FEEDBACK RECEBIDO ---');
        console.log(`De: ${name} (${email})`);
        console.log(`UID: ${context.auth.uid}`);
        console.log(`Assunto: ${subject}`);
        console.log(`Mensagem: ${message}`);
        console.log('------------------------------');
        return { success: true, message: 'Feedback enviado com sucesso!' };

    } catch (error: any) {
        console.error("Erro ao processar feedback:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError("internal", "Erro interno do servidor ao processar o feedback.");
    }
});


// ========================================================================
//   CASCATA DE ESTATÍSTICAS E LÓGICA DE NEGÓCIO
// ========================================================================

export const onHouseChange = functions
    .region(functionOptions.region)
    .runWith({ serviceAccount: functionOptions.serviceAccount })
    .firestore.document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}")
    .onWrite(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    if (!afterData) {
      return null;
    }

    const { congregationId, territoryId, quadraId } = context.params;
    const quadraRef = db.collection('congregations').doc(congregationId)
                        .collection('territories').doc(territoryId)
                        .collection('quadras').doc(quadraId);

    try {
        await db.runTransaction(async (transaction) => {
            const currentQuadraSnap = await transaction.get(quadraRef);
            if (!currentQuadraSnap.exists) return;

            const casasSnapshot = await currentQuadraSnap.ref.collection("casas").get();
            const totalHouses = casasSnapshot.size;
            const housesDone = casasSnapshot.docs.filter(doc => doc.data().status === true).length;
            
            transaction.update(quadraRef, { totalHouses: totalHouses, housesDone: housesDone });
        });
    } catch (e) {
        console.error("onHouseChange: Erro na transação de atualização de estatísticas da quadra:", e);
    }

    if (beforeData?.status === false && afterData?.status === true) {
        const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
        const today = format(new Date(), 'yyyy-MM-dd');
        const activityHistoryRef = territoryRef.collection('activityHistory');

        try {
            const todayActivitiesSnap = await activityHistoryRef
                                            .where('activityDateStr', '==', today)
                                            .where('type', '==', 'work')
                                            .limit(1)
                                            .get();

            if (todayActivitiesSnap.empty) {
                const finalDescriptionForAutoLog = "Primeiro trabalho do dia registrado.(Registro Automático)\nRegistrado por: Sistema";
                await activityHistoryRef.add({
                    type: 'work',
                    activityDate: admin.firestore.FieldValue.serverTimestamp(),
                    activityDateStr: today,
                    description: finalDescriptionForAutoLog,
                    userId: 'automatic_system_log',
                    userName: 'Sistema'
                });
            }
        } catch (error) {
            console.error("onHouseChange: Erro ao processar ou adicionar log de atividade:", error);
        }
        await territoryRef.update({ lastUpdate: admin.firestore.FieldValue.serverTimestamp() });
    }
    return null;
  });

export const onQuadraChange = functions
    .region(functionOptions.region)
    .runWith({ serviceAccount: functionOptions.serviceAccount })
    .firestore.document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}")
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
    });
});

export const onTerritoryChange = functions
    .region(functionOptions.region)
    .runWith({ serviceAccount: functionOptions.serviceAccount })
    .firestore.document("congregations/{congregationId}/territories/{territoryId}")
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
//   OUTROS GATILHOS (Notificação, Exclusão)
// ============================================================================
export const onTerritoryAssigned = functions
    .region(functionOptions.region)
    .runWith({ serviceAccount: functionOptions.serviceAccount })
    .firestore.document("congregations/{congId}/territories/{terrId}")
    .onUpdate(async (change, context) => {
    const dataBefore = change.before.data();
    const dataAfter = change.after.data();

    if (!dataAfter?.assignment || dataBefore?.assignment?.uid === dataAfter.assignment?.uid) {
        return null;
    }

    const assignedUserUid = dataAfter.assignment.uid;
    const territoryName = dataAfter.name;
    const dueDate = (dataAfter.assignment.dueDate as admin.firestore.Timestamp).toDate();
    const formattedDueDate = dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    try {
        const userDoc = await db.collection("users").doc(assignedUserUid).get();
        if (!userDoc.exists) return null;

        const tokens = userDoc.data()?.fcmTokens;
        if (!tokens || tokens.length === 0) return null;

        const payload = {
            notification: {
                title: "Você recebeu um novo território!",
                body: `O território "${territoryName}" está sob sua responsabilidade. Devolver até ${formattedDueDate}.`,
                icon: "/icon-192x192.jpg",
                click_action: "/dashboard/meus-territorios",
            },
        };
        await admin.messaging().sendToDevice(tokens as string[], payload);
        return { success: true };
    } catch (error) {
        console.error(`[Notification] FALHA CRÍTICA ao enviar notificação:`, error);
        return { success: false, error };
    }
  });

export const onDeleteTerritory = functions
    .region(functionOptions.region)
    .runWith({ serviceAccount: functionOptions.serviceAccount })
    .firestore.document("congregations/{congregationId}/territories/{territoryId}")
    .onDelete((snap, context) => {
        return admin.firestore().recursiveDelete(snap.ref);
    });

export const onDeleteQuadra = functions
    .region(functionOptions.region)
    .runWith({ serviceAccount: functionOptions.serviceAccount })
    .firestore.document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}")
    .onDelete((snap, context) => {
        return admin.firestore().recursiveDelete(snap.ref);
    });

// ============================================================================
//   SISTEMA DE PRESENÇA (RTDB -> FIRESTORE)
// ============================================================================
export const mirrorUserStatus = functions
    .runWith({ serviceAccount: functionOptions.serviceAccount })
    .database.ref("/status/{uid}")
    .onWrite(async (change, context) => {
        const eventStatus = change.after.val();
        const uid = context.params.uid;
        const userDocRef = db.doc(`users/${uid}`);

        try {
            if (!eventStatus || eventStatus.state === 'offline') {
                await userDocRef.update({ isOnline: false, lastSeen: admin.firestore.FieldValue.serverTimestamp() });
            } else if (eventStatus.state === 'online') {
                await userDocRef.update({ isOnline: true, lastSeen: admin.firestore.FieldValue.serverTimestamp() });
            }
        } catch(err: any) {
            if (err.code !== 'not-found') console.error(`[Presence Mirror] Falha para ${uid}:`, err);
        }
        return null;
    });
