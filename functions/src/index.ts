
// functions/src/index.ts
import { https, setGlobalOptions, pubsub } from "firebase-functions/v2";
import { onDocumentWritten, onDocumentDeleted, onDocumentCreated } from "firebase-functions/v2/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import * as admin from "firebase-admin";
import * as cors from "cors";
import { format } from 'date-fns';
import { GetSignedUrlConfig } from "@google-cloud/storage";
import { randomBytes } from 'crypto';
import { AppUser, Notification, Territory } from "./types";

const corsHandler = cors({ origin: true });

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: "southamerica-east1" });

// ========================================================================
//   HELPER FUNCTIONS
// ========================================================================

// Divide array em chunks
function chunkArray<T>(arr: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }
  return chunks;
}

// Cria notificação em batch, respeitando limite de 500 writes
async function createNotificationsBatch(userRefs: admin.firestore.DocumentReference[], notification: Omit<Notification, 'id'>) {
  const batches = chunkArray(userRefs, 500);
  for (const batchRefs of batches) {
    const batch = db.batch();
    batchRefs.forEach(ref => {
      batch.set(ref.collection('notifications').doc(), notification);
    });
    await batch.commit();
  }
}

// Envia FCM em chunks de 500 tokens
async function sendFcmNotification(tokens: string[], payload: admin.messaging.MessagingPayload) {
  const tokenChunks = chunkArray(tokens, 500);
  for (const chunk of tokenChunks) {
    const response = await admin.messaging().sendEachForMulticast({ tokens: chunk, ...payload });
    // Remove tokens inválidos
    const invalidTokens = response.responses
      .map((r, i) => (r.success ? null : chunk[i]))
      .filter((t): t is string => t !== null);
    if (invalidTokens.length > 0) {
      console.warn(`[FCM] Removendo ${invalidTokens.length} tokens inválidos.`);
      const validTokens = chunk.filter(t => !invalidTokens.includes(t));
      await db.collection("users").where("fcmTokens", "array-contains-any", chunk).get()
        .then(snap => snap.forEach(doc => doc.ref.update({ fcmTokens: validTokens })));
    }
  }
}

// Função para pegar admins/dirigentes/servos de uma congregação
async function getManagersOfCongregation(congregationId: string): Promise<admin.firestore.DocumentReference[]> {
  const roles = ['Administrador', 'Dirigente', 'Servo de Territórios'];
  const usersSnap = await db.collection("users")
    .where('congregationId', '==', congregationId)
    .where('role', 'in', roles)
    .get();
  return usersSnap.docs.map(doc => doc.ref);
}

// ========================================================================
//   FUNÇÕES HTTPS (onRequest) - Padrão Unificado com CORS
// ========================================================================

export const createCongregationAndAdmin = https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp } = req.body;
    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    let newUser: admin.auth.UserRecord | undefined;

    try {
      const existing = await db.collection('congregations').where('number', '==', congregationNumber).get();
      if (!existing.empty) return res.status(409).json({ error: 'Número da congregação já existe.' });

      newUser = await admin.auth().createUser({ email: adminEmail, password: adminPassword, displayName: adminName });

      const batch = db.batch();
      const congRef = db.collection('congregations').doc();
      batch.set(congRef, {
        name: congregationName,
        number: congregationNumber,
        territoryCount: 0, ruralTerritoryCount: 0, totalQuadras: 0, totalHouses: 0, totalHousesDone: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdate: admin.firestore.FieldValue.serverTimestamp()
      });

      batch.set(db.collection("users").doc(newUser.uid), {
        name: adminName,
        email: adminEmail,
        whatsapp,
        congregationId: congRef.id,
        role: "Administrador",
        status: "ativo"
      });

      await batch.commit();
      res.status(200).json({ success: true, userId: newUser.uid, message: 'Congregação criada com sucesso!' });

    } catch (error: any) {
      if (newUser) await admin.auth().deleteUser(newUser.uid).catch(console.error);
      console.error("Erro createCongregationAndAdmin:", error);
      const codeMap: Record<string,string> = { 'auth/email-already-exists': 'Este e-mail já está em uso.' };
      res.status(500).json({ error: codeMap[error.code] || error.message || 'Erro interno' });
    }
  });
});

export const requestPasswordReset = https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mail obrigatório.' });

    try {
      await admin.auth().getUserByEmail(email);
      const token = randomBytes(32).toString("hex");
      const expires = admin.firestore.Timestamp.fromMillis(Date.now() + 3600*1000);

      await db.collection("resetTokens").doc(token).set({ email, expires });
      res.status(200).json({ success: true, token });
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') return res.status(200).json({ success: true, token: null });
      console.error("Erro requestPasswordReset:", error);
      res.status(500).json({ error: 'Falha ao processar pedido de redefinição.' });
    }
  });
});

export const resetPasswordWithToken = https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: "Token e nova senha são obrigatórios." });
    if (newPassword.length < 6) return res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres." });

    const tokenRef = db.collection("resetTokens").doc(token);
    try {
      const tokenDoc = await tokenRef.get();
      if (!tokenDoc.exists) return res.status(404).json({ error: "Token inválido ou já usado." });

      const tokenData = tokenDoc.data()!;
      if (tokenData.expires.toMillis() < Date.now()) {
        await tokenRef.delete();
        return res.status(410).json({ error: "Token expirado." });
      }

      const user = await admin.auth().getUserByEmail(tokenData.email);
      await admin.auth().updateUser(user.uid, { password: newPassword });
      await tokenRef.delete();
      res.status(200).json({ success: true, message: "Senha redefinida com sucesso." });
    } catch (error: any) {
      console.error("Erro resetPasswordWithToken:", error);
      res.status(500).json({ error: "Erro interno ao redefinir senha." });
    }
  });
});

export const deleteUserAccount = https.onCall(async (request) => {
    if (!request.auth) {
        throw new https.HttpsError('unauthenticated', 'Ação não autorizada.');
    }
    const callingUserUid = request.auth.uid;
    const userIdToDelete = request.data.userIdToDelete;

    if (!userIdToDelete) {
        throw new https.HttpsError('invalid-argument', 'O ID do usuário para exclusão é necessário.');
    }

    const callingUserSnap = await db.doc(`users/${callingUserUid}`).get();
    const callingUserData = callingUserSnap.data() as AppUser;

    if (callingUserData.role !== 'Administrador' && callingUserUid !== userIdToDelete) {
        throw new https.HttpsError('permission-denied', 'Você não tem permissão para excluir outros usuários.');
    }

    if (callingUserData.role === 'Administrador' && callingUserUid === userIdToDelete) {
        throw new https.HttpsError('permission-denied', 'Um administrador não pode se autoexcluir.');
    }

    try {
        await admin.auth().deleteUser(userIdToDelete);
        await db.doc(`users/${userIdToDelete}`).delete();
        return { success: true, message: 'Usuário excluído com sucesso.' };
    } catch (error: any) {
        console.error('Erro CRÍTICO ao excluir usuário:', error);
        // Tenta limpar o documento do Firestore mesmo se a exclusão da Auth falhar (ex: usuário já excluído)
        if (error.code === 'auth/user-not-found') {
            await db.doc(`users/${userIdToDelete}`).delete();
            return { success: true, message: 'Usuário não encontrado na Auth, mas removido do Firestore.' };
        }
        throw new https.HttpsError('internal', error.message || 'Falha ao excluir o usuário.');
    }
});


export const resetTerritoryProgress = https.onCall(async (request) => {
    if (!request.auth) {
        throw new https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const uid = request.auth.uid;
    const { congregationId, territoryId } = request.data;
    if (!congregationId || !territoryId) {
        throw new https.HttpsError("invalid-argument", "IDs faltando.");
    }

    const adminUserSnap = await db.doc(`users/${uid}`).get();
    if (adminUserSnap.data()?.role !== "Administrador") {
        throw new https.HttpsError("permission-denied", "Ação restrita a administradores.");
    }

    const historyPath = `congregations/${congregationId}/territories/${territoryId}/activityHistory`;
    const quadrasRef = db.collection(`congregations/${congregationId}/territories/${territoryId}/quadras`);
    
    try {
        await db.recursiveDelete(db.collection(historyPath));
    } catch (error) {
        console.error(`[resetTerritory] Falha ao deletar histórico para ${territoryId}:`, error);
        throw new https.HttpsError("internal", "Falha ao limpar histórico do território.");
    }

    try {
        let housesUpdatedCount = 0;
        await db.runTransaction(async (transaction) => {
            const quadrasSnapshot = await transaction.get(quadrasRef);
            const housesToUpdate: { ref: admin.firestore.DocumentReference, data: { status: boolean } }[] = [];

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

    } catch (error: any) {
        console.error(`[resetTerritory] FALHA CRÍTICA na transação ao limpar o território ${territoryId}:`, error);
        throw new https.HttpsError("internal", "Falha ao processar a limpeza das casas do território.");
    }
});


export const generateUploadUrl = https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (!idToken) {
            res.status(401).json({ error: 'Ação não autorizada.' });
            return;
        }
        
        const { filePath, contentType } = req.body;
        if (!filePath || typeof filePath !== 'string' || !contentType) {
            res.status(400).json({ error: 'Caminho do arquivo e tipo de conteúdo são necessários.' });
            return;
        }
        
        const options: GetSignedUrlConfig = {
            version: 'v4',
            action: 'write',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutos
            contentType: contentType,
        };

        try {
            const [url] = await admin.storage().bucket().file(filePath).getSignedUrl(options);
            res.status(200).json({ success: true, url });
        } catch (error: any) {
            console.error("Erro ao gerar URL assinada:", error);
            res.status(500).json({ error: 'Falha ao criar URL de upload.', details: error.message });
        }
    });
});


// ========================================================================
//   GATILHOS (TRIGGERS)
// ========================================================================

export const onHouseChange = onDocumentWritten("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}", async (event) => {
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();
  
  if (!event.data?.after.exists) return null; // Documento deletado, tratado por onDelete

  const { congregationId, territoryId, quadraId } = event.params;
  const quadraRef = db.collection('congregations').doc(congregationId)
                      .collection('territories').doc(territoryId)
                      .collection('quadras').doc(quadraId);
  
  try {
      await db.runTransaction(async (transaction) => {
          const casasSnapshot = await transaction.get(quadraRef.collection("casas"));
          const totalHouses = casasSnapshot.size;
          const housesDone = casasSnapshot.docs.filter(doc => doc.data().status === true).length;
          transaction.update(quadraRef, { totalHouses, housesDone });
      });
  } catch (e) {
      console.error("onHouseChange: Erro na transação de atualização de estatísticas da quadra:", e);
  }

  // Gera um log automático apenas na primeira casa trabalhada no dia
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
              const finalDescriptionForAutoLog = "Primeiro trabalho do dia registrado. (Registro Automático)";
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

export const onQuadraChange = onDocumentWritten("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}", async (event) => {
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

export const onTerritoryChange = onDocumentWritten("congregations/{congregationId}/territories/{territoryId}", async (event) => {
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


export const onNewUserPending = onDocumentCreated("users/{userId}", async (event) => {
    const newUser = event.data?.data();
    if (!newUser || newUser.status !== 'pendente' || !newUser.congregationId) {
        return null;
    }

    try {
        const rolesToQuery = ['Administrador', 'Dirigente', 'Servo de Territórios'];
        const adminQueries = rolesToQuery.map(role => 
            db.collection("users")
              .where('congregationId', '==', newUser.congregationId)
              .where('role', '==', role)
              .get()
        );

        const adminSnapshots = await Promise.all(adminQueries);
        const adminDocs = adminSnapshots.flatMap(snap => snap.docs);

        if (adminDocs.length === 0) {
            console.log(`[onNewUserPending] Nenhum administrador ou dirigente encontrado para a congregação ${newUser.congregationId}.`);
            return null;
        }

        const batch = db.batch();
        const notification: Omit<Notification, 'id'> = {
            title: "Novo Usuário Pendente",
            body: `O publicador "${newUser.name}" solicitou acesso à congregação.`,
            link: "/dashboard/usuarios",
            type: 'user_pending',
            isRead: false,
            createdAt: admin.firestore.Timestamp.now(),
        };
        
        const notifiedUserIds = new Set<string>();
        adminDocs.forEach(doc => {
            if (!notifiedUserIds.has(doc.id)) {
                const notificationsRef = doc.ref.collection('notifications').doc();
                batch.set(notificationsRef, notification);
                notifiedUserIds.add(doc.id);
            }
        });
        
        await batch.commit();

    } catch (error) {
        console.error(`[onNewUserPending] Falha ao criar notificações para admins:`, error);
    }
});


export const onTerritoryAssigned = onDocumentWritten("congregations/{congId}/territories/{terrId}", async (event) => {
    const beforeData = event.data?.before.data() as Territory | undefined;
    const afterData = event.data?.after.data() as Territory | undefined;

    // Condição para designação: O campo 'assignment' não existia antes e agora existe.
    const shouldNotify = !beforeData?.assignment && afterData?.assignment;

    if (!shouldNotify || !afterData || !afterData.assignment || afterData.assignment.uid.startsWith('custom_')) {
        return;
    }

    const { uid: assignedUid } = afterData.assignment;
    const { name: territoryName, id: territoryId } = afterData;

    // --- 1. Cria a notificação interna ---
    const notificationData: Omit<Notification, 'id'> = {
        title: "Novo Território Designado",
        body: `O território "${territoryName}" foi designado para você.`,
        link: `/dashboard/territorios/${territoryId}`,
        type: 'territory_assigned',
        isRead: false,
        createdAt: admin.firestore.Timestamp.now(),
    };

    try {
        await db.collection("users").doc(assignedUid).collection("notifications").add(notificationData);
        console.log(`[Notification] Notificação interna para DESIGNÇÃO criada para ${assignedUid}.`);
    } catch (err) {
        console.error(`[Notification] Falha ao gravar notificação no Firestore para ${assignedUid}:`, err);
        // Não retorna, para que o envio PUSH ainda possa ser tentado.
    }

    // --- 2. Tenta enviar a notificação PUSH (FCM) em um bloco separado ---
    try {
        const userDoc = await db.collection("users").doc(assignedUid).get();
        if (!userDoc.exists) {
            console.warn(`[Notification] Usuário ${assignedUid} não encontrado para notificação PUSH.`);
            return;
        }

        const tokens: string[] = userDoc.data()?.fcmTokens || [];
        console.log(`[onTerritoryAssigned] Tokens encontrados para ${userDoc.data()?.name}:`, tokens);

        if (tokens.length > 0) {
            const formattedDueDate = format(afterData.assignment!.dueDate.toDate(), 'dd/MM/yyyy');
            const payload: admin.messaging.MessagingPayload = {
                notification: {
                    title: "Novo Território Designado!",
                    body: `Você recebeu o território "${territoryName}". Devolver até ${formattedDueDate}.`,
                    icon: "/icon-192x192.jpg",
                },
                webpush: {
                    fcmOptions: { link: `/dashboard/territorios/${territoryId}` }
                }
            };
            
            const response = await admin.messaging().sendEachForMulticast({ tokens, ...payload });

            const invalidTokens = response.responses
                .map((r, i) => (r.success ? null : tokens[i]))
                .filter((t): t is string => t !== null);

            if (invalidTokens.length > 0) {
                console.warn(`[Notification] Removendo ${invalidTokens.length} tokens inválidos do usuário ${assignedUid}.`);
                const validTokens = tokens.filter((t) => !invalidTokens.includes(t));
                await userDoc.ref.update({ fcmTokens: validTokens });
            }
        }
    } catch (error) {
        console.warn(`[Notification] Erro (ignorado) ao enviar notificação PUSH para ${assignedUid}:`, error);
    }
});


export const onTerritoryReturned = onDocumentWritten("congregations/{congId}/territories/{terrId}", async (event) => {
  const beforeData = event.data?.before.data() as Territory | undefined;
  const afterData = event.data?.after.data() as Territory | undefined;

  // Condição para devolução: O campo 'assignment' existia antes e agora não existe mais.
  if (!beforeData?.assignment || afterData?.assignment) {
    return;
  }
  
  const returningUserUid = beforeData.assignment.uid;
  const territoryName = afterData!.name;
  const congregationId = event.params.congId;

  const batch = db.batch();

  // 1. Notificar o usuário que devolveu (se não for designação livre)
  if (!returningUserUid.startsWith('custom_')) {
      const userRef = db.collection("users").doc(returningUserUid);
      const userNotifRef = userRef.collection('notifications').doc();
      const userNotification: Omit<Notification, 'id'> = {
        title: "Território Devolvido",
        body: `Você devolveu o território "${territoryName}". Obrigado!`,
        link: `/dashboard/territorios/${event.params.terrId}`,
        type: 'territory_returned',
        isRead: false,
        createdAt: admin.firestore.Timestamp.now()
      };
      batch.set(userNotifRef, userNotification);
  }

  // 2. Notificar todos os administradores, dirigentes e servos de territórios
  const rolesToQuery = ['Administrador', 'Dirigente', 'Servo de Territórios'];
  
  try {
    const adminQueries = rolesToQuery.map(role => 
        db.collection("users")
          .where('congregationId', '==', congregationId)
          .where('role', '==', role)
          .get()
    );

    const adminSnapshots = await Promise.all(adminQueries);
    const adminDocs = adminSnapshots.flatMap(snap => snap.docs);

    if (adminDocs.length > 0) {
        const adminNotification: Omit<Notification, 'id'> = {
          title: "Território Disponível",
          body: `O território "${territoryName}" foi devolvido e está disponível para designação.`,
          link: '/dashboard/administracao',
          type: 'territory_available',
          isRead: false,
          createdAt: admin.firestore.Timestamp.now()
        };
        
        const notifiedUserIds = new Set<string>();
        adminDocs.forEach(doc => {
          if (!notifiedUserIds.has(doc.id)) {
            const notificationsRef = doc.ref.collection('notifications').doc();
            batch.set(notificationsRef, adminNotification);
            notifiedUserIds.add(doc.id);
          }
        });
    }
    
    await batch.commit();

  } catch (error) {
    console.error(`[onTerritoryReturned] Falha ao notificar admins:`, error);
  }
});

export const onDeleteTerritory = onDocumentDeleted("congregations/{congregationId}/territories/{territoryId}", async (event) => {
    if (!event.data) {
        console.warn(`[onDeleteTerritory] Evento de deleção para ${event.params.territoryId} sem dados. Ignorando.`);
        return null;
    }
    const ref = event.data.ref;
    try {
        await admin.firestore().recursiveDelete(ref);
        console.log(`[onDeleteTerritory] Território ${event.params.territoryId} e subcoleções deletadas.`);
        return { success: true };
    } catch (error) {
        console.error(`[onDeleteTerritory] Erro ao deletar ${event.params.territoryId}:`, error);
    }
});

export const onDeleteQuadra = onDocumentDeleted("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}", async (event) => {
    if (!event.data) {
        console.warn(`[onDeleteQuadra] Evento de deleção para ${event.params.quadraId} sem dados. Ignorando.`);
        return null;
    }
    const ref = event.data.ref;
    try {
        await admin.firestore().recursiveDelete(ref);
        console.log(`[onDeleteQuadra] Quadra ${event.params.quadraId} e subcoleções deletadas.`);
        return { success: true };
    } catch (error) {
        console.error(`[onDeleteQuadra] Erro ao deletar ${event.params.quadraId}:`, error);
    }
});


// ============================================================================
//   SISTEMA DE PRESENÇA (RTDB -> FIRESTORE)
// ============================================================================
export const mirrorUserStatus = onValueWritten(
  {
    ref: "/status/{uid}",
    region: "us-central1" // RTDB pode ter regiões diferentes
  },
  async (event) => {
    const eventStatus = event.data.after.val();
    const uid = event.params.uid;
    const userDocRef = db.doc(`users/${uid}`);

    try {
        if (!eventStatus || eventStatus.state === 'offline') {
            await userDocRef.update({ isOnline: false, lastSeen: admin.firestore.FieldValue.serverTimestamp() });
        } else if (eventStatus.state === 'online') {
            await userDocRef.update({ isOnline: true, lastSeen: admin.firestore.FieldValue.serverTimestamp() });
        }
    } catch(err: any) {
        if (err.code !== 'not-found') {
          console.error(`[Presence Mirror] Falha para ${uid}:`, err);
        }
    }
    return null;
});

// ============================================================================
//   FUNÇÕES AGENDADAS (Scheduled Functions)
// ============================================================================
export const checkInactiveUsers = pubsub.schedule("every 5 minutes").onRun(async (context) => {
    console.log("Executando verificação de usuários inativos...");

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    try {
        const inactiveUsersQuery = db.collection('users')
                                     .where('isOnline', '==', true)
                                     .where('lastSeen', '<', twoHoursAgo);

        const inactiveUsersSnap = await inactiveUsersQuery.get();
        
        if (inactiveUsersSnap.empty) {
            console.log("Nenhum usuário inativo encontrado.");
            return null;
        }

        const batch = db.batch();
        inactiveUsersSnap.forEach(doc => {
            console.log(`Marcando usuário ${doc.id} como offline.`);
            batch.update(doc.ref, { isOnline: false });
        });

        await batch.commit();
        console.log(`${inactiveUsersSnap.size} usuários inativos foram atualizados para offline.`);
        return null;

    } catch (error) {
        console.error("Erro ao verificar e atualizar usuários inativos:", error);
        return null;
    }
});


export const checkOverdueTerritories = pubsub.schedule("every 24 hours").onRun(async (context) => {
    console.log("Executando verificação de territórios vencidos...");
    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();

    try {
        const congregationsSnapshot = await db.collection('congregations').get();
        
        for (const congDoc of congregationsSnapshot.docs) {
            const overdueTerritoriesQuery = db.collection(`congregations/${congDoc.id}/territories`)
                .where('status', '==', 'designado')
                .where('assignment.dueDate', '<', now);
            
            const overdueSnapshot = await overdueTerritoriesQuery.get();
            if (overdueSnapshot.empty) continue;

            for (const terrDoc of overdueSnapshot.docs) {
                const territory = terrDoc.data();
                const assignment = territory.assignment;
                if (!assignment || !assignment.uid || assignment.uid.startsWith('custom_')) continue;

                const userRef = db.collection('users').doc(assignment.uid);
                const notificationRef = userRef.collection('notifications').doc();
                
                const notification: Omit<Notification, 'id'> = {
                    title: "Território Vencido!",
                    body: `Lembrete: O território "${territory.name}" está com o prazo de devolução vencido.`,
                    link: "/dashboard/meus-territorios",
                    type: 'territory_overdue',
                    isRead: false,
                    createdAt: admin.firestore.Timestamp.now(),
                };
                
                batch.set(notificationRef, notification);
            }
        }
        
        await batch.commit();
        console.log("Verificação de territórios vencidos concluída.");
    } catch (error) {
        console.error("Erro ao verificar territórios vencidos:", error);
    }
});

