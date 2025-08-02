// functions/src/index.ts
import * as admin from "firebase-admin";

// **IMPORTANTE:** Remover importações antigas como `import * as functions from "firebase-functions";`

// Importar funções HTTPS diretamente da v2
import { onRequest, onCall, CallableRequest, HttpsError } from "firebase-functions/v2/https";
// Importar funções Firestore diretamente
import { onDocumentWritten, onDocumentUpdated, onDocumentCreated, onDocumentDeleted, DocumentSnapshot } from "firebase-functions/v2/firestore";
// Importar funções Pub/Sub DE AGENDAMENTO (Scheduler) - CORRIGIDO AQUI
import { onSchedule } from "firebase-functions/v2/scheduler";
// Importar funções Realtime Database diretamente, sem `ref` - CORRIGIDO AQUI
import { onValueWritten, DataSnapshot } from "firebase-functions/v2/database";


// `Change` ainda é útil para typagem de `onDocumentWritten`/`onDocumentUpdated`
import { Change } from "firebase-functions/lib/v1/cloud-functions";
import type { GetSignedUrlConfig } from "@google-cloud/storage";


// eslint-disable-next-line @typescript-eslint/no-var-requires
const cors = require('cors')({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// ========================================================================
//   FUNÇÕES HTTPS (onCall e onRequest)
// ========================================================================

// createCongregationAndAdmin - Função onRequest
// **CORRIGIDO:** Usando `onRequest` importado da v2, e garantindo que os retornos sejam `void`
export const createCongregationAndAdmin = onRequest((req, res) => {
  // O middleware `cors` deve ser o primeiro a lidar com a requisição
  // O callback passado para `cors` deve ser assíncrono para operações de banco de dados/autenticação
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método não permitido' });
      return; // Apenas retornar para finalizar a execução após enviar a resposta
    }

    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber } = req.body;

    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber) {
      res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
      return; // Apenas retornar
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

      res.status(200).json({ success: true, userId: newUser.uid, message: 'Congregação criada com sucesso!' });
      return; // Apenas retornar

    } catch (error: any) {
      if (newUser) {
        await admin.auth().deleteUser(newUser.uid).catch(deleteError => {
          console.error(`Falha CRÍTICA ao limpar usuário órfão '${newUser?.uid}':`, deleteError);
        });
      }

      console.error("Erro ao criar congregação e admin:", error);
      if (error.code === 'auth/email-already-exists') {
        res.status(409).json({ error: "Este e-mail já está em uso." });
        return; // Apenas retornar
      }
      res.status(500).json({ error: error.message || 'Erro interno no servidor' });
      return; // Apenas retornar
    }
    // Não há necessidade de um `return` externo aqui, pois todos os caminhos internos já o possuem.
  });
});

interface DeleteUserAccountData {
  uid: string;
}

export const deleteUserAccount = onCall(async (req: CallableRequest<DeleteUserAccountData>) => {
  const callingUserUid = req.auth?.uid;
  if (!callingUserUid) {
    throw new HttpsError("unauthenticated", "Ação não autorizada.");
  }
  const userIdToDelete = req.data.uid;
  if (!userIdToDelete || typeof userIdToDelete !== 'string') {
    throw new HttpsError("invalid-argument", "ID inválido.");
  }
  const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
  const isAdmin = callingUserSnap.exists && callingUserSnap.data()?.role === "Administrador";
  if (!isAdmin && callingUserUid !== userIdToDelete) {
      throw new HttpsError("permission-denied", "Sem permissão.");
  }
  if (isAdmin && callingUserUid === userIdToDelete) {
    throw new HttpsError("permission-denied", "Admin não pode se autoexcluir.");
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
    throw new HttpsError("internal", `Falha na exclusão: ${error.message}`);
  }
});

interface ResetTerritoryProgressData {
  congregationId: string;
  territoryId: string;
}

export const resetTerritoryProgress = onCall(async (req: CallableRequest<ResetTerritoryProgressData>) => {
    const uid = req.auth?.uid;
    if (!uid) { throw new HttpsError("unauthenticated", "Ação não autorizada."); }

    const { congregationId, territoryId } = req.data;
    if (!congregationId || !territoryId) { throw new HttpsError("invalid-argument", "IDs faltando."); }

    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (adminUserSnap.data()?.role !== "Administrador") {
        throw new HttpsError("permission-denied", "Ação restrita a administradores.");
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
        throw new HttpsError("internal", "Falha ao processar a limpeza.");
    }
});

interface GenerateUploadUrlData {
  filePath: string;
  contentType: string;
}

export const generateUploadUrl = onCall(
  { region: "southamerica-east1" },
  async (req: CallableRequest<GenerateUploadUrlData>) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'Ação não autorizada.');
    }
    const { filePath, contentType } = req.data;
    if (!filePath || typeof filePath !== 'string') {
      throw new HttpsError('invalid-argument', 'O nome do arquivo é necessário.');
    }

    const options: GetSignedUrlConfig = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutos
        contentType: contentType,
    };
    try {
        const [url] = await admin.storage().bucket().file(filePath).getSignedUrl(options);
        return { url };
    } catch (error) {
        console.error("Erro ao gerar URL assinada:", error);
        throw new HttpsError('internal', 'Falha ao criar URL.');
    }
});

interface SendFeedbackEmailData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export const sendFeedbackEmail = onCall(async (req: CallableRequest<SendFeedbackEmailData>) => {
    if (!req.auth) {
        throw new HttpsError("unauthenticated", "O usuário deve estar autenticado para enviar feedback.");
    }

    try {
        const { name, email, subject, message } = req.data;
        if (!name || !email || !subject || !message) {
            throw new HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
        }

        console.log('--- NOVO FEEDBACK RECEBIDO ---');
        console.log(`De: ${name} (${email})`);
        console.log(`UID: ${req.auth.uid}`);
        console.log(`Assunto: ${subject}`);
        console.log(`Mensagem: ${message}`);
        console.log('------------------------------');

        return { success: true, message: 'Feedback enviado com sucesso!' };

    } catch (error: any) {
        console.error("Erro ao processar feedback:", error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError("internal", "Erro interno do servidor ao processar o feedback.");
    }
});


// ========================================================================
//   CASCATA DE ESTATÍSTICAS E LÓGICA DE NEGÓCIO
// ========================================================================

export const onHouseChange = onDocumentWritten(
  "congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}",
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    const { congregationId, territoryId, quadraId } = event.params;

    const quadraRef = db.collection('congregations').doc(congregationId)
                        .collection('territories').doc(territoryId)
                        .collection('quadras').doc(quadraId);

    const casasSnapshot = await quadraRef.collection("casas").get();
    await quadraRef.update({
        totalHouses: casasSnapshot.size,
        housesDone: casasSnapshot.docs.filter(doc => doc.data().status === true).length
    });

    if (beforeData?.status === false && afterData?.status === true) {
        const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
        await territoryRef.update({ lastUpdate: admin.firestore.FieldValue.serverTimestamp() });
    }

    return null;
  });

export const onQuadraChange = onDocumentWritten(
  "congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}",
  async (event) => {
    const { congregationId, territoryId } = event.params;

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

export const onTerritoryChange = onDocumentWritten(
    "congregations/{congregationId}/territories/{territoryId}",
    async (event) => {
        const { congregationId } = event.params;
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
export const onTerritoryAssigned = onDocumentUpdated(
  "congregations/{congId}/territories/{terrId}",
  async (event) => {
    const dataBefore = event.data?.before.data();
    const dataAfter = event.data?.after.data();

    if (!dataAfter?.assignment || dataBefore?.assignment?.uid === dataAfter.assignment?.uid) {
        return null;
    }

    const assignedUserUid = dataAfter.assignment.uid;
    const territoryName = dataAfter.name;
    const dueDate = (dataAfter.assignment.dueDate as admin.firestore.Timestamp).toDate();

    const formattedDueDate = dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    try {
        const userDoc = await db.collection("users").doc(assignedUserUid).get();
        if (!userDoc.exists) {
            return null;
        }

        const tokens = userDoc.data()?.fcmTokens;
        if (!tokens || tokens.length === 0) {
            return null;
        }

        const payload: admin.messaging.MessagingPayload = {
            notification: {
                title: "Você recebeu um novo território!",
                body: `O território \"${territoryName}\" está sob sua responsabilidade. Devolver até ${formattedDueDate}.`,
                icon: "/icon-192x192.png",
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


export const notifyAdminOfNewUser = onDocumentCreated("users/{userId}", async (event) => {
    const newUser = event.data?.data();
    if (!newUser || newUser.status !== "pendente" || !newUser.congregationId) {
        return null;
    }
    const adminsSnapshot = await db.collection("users")
        .where("congregationId", "==", newUser.congregationId)
        .where("role", "in", ["Administrador", "Dirigente"])
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
    const payload: admin.messaging.MessagingPayload = {
        notification: {
            title: "Novo Usuário Aguardando Aprovação!",
            body: `O usuário "${newUser.name}" se cadastrou e precisa de sua aprovação.`,
            icon: "/icon-192x192.png",
            click_action: "/dashboard/usuarios",
        },
    };
    try {
        await admin.messaging().sendToDevice(tokens as string[], payload);
        return { success: true };
    } catch (error) {
        console.error("[notifyAdmin] FALHA CRÍTICA:", error);
        return null;
    }
});


export const onDeleteTerritory = onDocumentDeleted("congregations/{congregationId}/territories/{territoryId}", (event) => {
    if (!event.data) return null;
    return admin.firestore().recursiveDelete(event.data.ref);
});

export const onDeleteQuadra = onDocumentDeleted("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}", (event) => {
    if (!event.data) return null;
    return admin.firestore().recursiveDelete(event.data.ref);
});

// scheduledFirestoreExport - Pub/Sub com Scheduler
export const scheduledFirestoreExport = onSchedule({
    schedule: "every day 03:00",
    timeZone: "America/Sao_Paulo"
  }, async (event) => {
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
        return;
    } catch (error) {
        console.error("[Backup] FALHA CRÍTICA:", error);
        throw new HttpsError("internal", "A operação de exportação falhou.", error);
    }
});

// ============================================================================
//   SISTEMA DE PRESENÇA (RTDB -> FIRESTORE)
// ============================================================================
export const mirrorUserStatus = onValueWritten("/status/{uid}", async (event) => {
    const eventStatus = event.data.after.val();
    const uid = event.params.uid;
    const userDocRef = admin.firestore().doc(`users/${uid}`);

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
    