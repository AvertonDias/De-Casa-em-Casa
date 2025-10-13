
// functions/src/index.ts
import { https, setGlobalOptions, pubsub } from "firebase-functions/v2";
import { onDocumentWritten, onDocumentDeleted, onDocumentCreated } from "firebase-functions/v2/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import * as admin from "firebase-admin";
import { format } from 'date-fns';
import { GetSignedUrlConfig } from "@google-cloud/storage";
import { randomBytes } from 'crypto';
import cors from "cors";

// Inicializa o CORS handler para permitir requisições do seu app
// origin: true reflete a origem da requisição, ideal para desenvolvimento e apps web.
const corsHandler = cors({ origin: true });


// Inicializa o admin apenas uma vez para evitar erros em múltiplas invocações.
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();


setGlobalOptions({ 
  region: "southamerica-east1",
});

// ========================================================================
//   FUNÇÕES HTTPS (onCall e onRequest)
// ========================================================================

export const createCongregationAndAdmin = https.onRequest({ cors: true }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Método não permitido' });
        return;
    }
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp } = req.body;
    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber) {
        res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
        return;
    }

    let newUser: admin.auth.UserRecord | undefined;
    try {
        const congQuery = await db.collection('congregations').where('number', '==', congregationNumber).get();
        if (!congQuery.empty) {
            res.status(409).json({ error: 'Uma congregação com este número já existe.' });
            return;
        }
        
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
            whatsapp: whatsapp, // Salva o WhatsApp
            congregationId: newCongregationRef.id,
            role: "Administrador",
            status: "ativo"
        });
        await batch.commit();

        res.status(200).json({ success: true, userId: newUser.uid, message: 'Congregação criada com sucesso!' });

    } catch (error: any) {
        if (newUser) {
            await admin.auth().deleteUser(newUser.uid).catch(deleteError => {
                console.error(`Falha CRÍTICA ao limpar usuário órfão '${newUser?.uid}':`, deleteError);
            });
        }

        console.error("Erro ao criar congregação e admin:", error);
        if (error.code === 'auth/email-already-exists') {
            res.status(409).json({ error: "Este e-mail já está em uso." });
        } else {
            res.status(500).json({ error: error.message || 'Erro interno no servidor' });
        }
    }
});


export const requestPasswordReset = https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método não permitido' });
      return;
    }

    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'O e-mail é obrigatório.' });
      return;
    }

    try {
      // Por segurança, não informe ao cliente se o usuário existe ou não.
      try {
        await admin.auth().getUserByEmail(email);
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          console.log(`Pedido de redefinição para e-mail não existente: ${email}`);
          // Simula sucesso para não vazar informação sobre a existência de e-mails.
          res.status(200).json({ success: true, token: null });
          return;
        }
        // Se for outro erro, lança para o catch principal.
        throw error;
      }
      
      const token = randomBytes(32).toString("hex");
      const expires = admin.firestore.Timestamp.fromMillis(Date.now() + 3600 * 1000); // 1 hora
      
      await db.collection("resetTokens").doc(token).set({
        email: email,
        expires: expires,
      });

      // Retorna apenas o token para o frontend
      res.status(200).json({ success: true, token: token });

    } catch (error: any) {
        console.error("Erro em requestPasswordReset:", error);
        res.status(500).json({ error: "Falha ao processar o pedido de redefinição." });
    }
  });
});


export const resetPasswordWithToken = https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método não permitido' });
      return;
    }

    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ error: "Token e nova senha são obrigatórios." });
      return;
    }
    if (newPassword.length < 6) {
        res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres." });
        return;
    }

    const tokenRef = db.collection("resetTokens").doc(token);
    
    try {
        const tokenDoc = await tokenRef.get();
        if (!tokenDoc.exists) {
            res.status(404).json({ error: "Token inválido ou já utilizado." });
            return;
        }

        const data = tokenDoc.data()!;
        if (data.expires.toMillis() < Date.now()) {
            await tokenRef.delete(); 
            res.status(410).json({ error: "O token de redefinição expirou." });
            return;
        }
        
        const user = await admin.auth().getUserByEmail(data.email);
        await admin.auth().updateUser(user.uid, { password: newPassword });
        await tokenRef.delete();

        res.status(200).json({ success: true, message: "Senha redefinida com sucesso." });
    } catch (error: any) {
        console.error("Erro em resetPasswordWithToken:", error);
        res.status(500).json({ error: "Ocorreu um erro interno ao redefinir a senha." });
    }
  });
});


export const deleteUserAccount = https.onCall(async (req) => {
    const callingUserUid = req.auth?.uid;
    if (!callingUserUid) {
        throw new https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    
    const { userIdToDelete } = req.data;
    if (!userIdToDelete || typeof userIdToDelete !== 'string') {
        throw new https.HttpsError("invalid-argument", "ID inválido.");
    }

    const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
    const isCallingUserAdmin = callingUserSnap.exists && callingUserSnap.data()?.role === "Administrador";

    if (isCallingUserAdmin && callingUserUid === userIdToDelete) {
        throw new https.HttpsError("permission-denied", "Um administrador não pode se autoexcluir.");
    }
    if (!isCallingUserAdmin && callingUserUid !== userIdToDelete) { // Usuário só pode se auto-excluir ou ser excluído por admin
        throw new https.HttpsError("permission-denied", "Você não tem permissão para excluir outros usuários.");
    }

    try {
        await admin.auth().deleteUser(userIdToDelete);
        const userDocRef = db.collection("users").doc(userIdToDelete);
        if ((await userDocRef.get()).exists) {
            await userDocRef.delete();
        }
        return { success: true, message: "Usuário excluído com sucesso." };
    } catch (error: any) {
        console.error("Erro CRÍTICO ao excluir usuário:", error);
        if (error.code === 'auth/user-not-found') {
            const userDocRef = db.collection("users").doc(userIdToDelete);
            if ((await userDocRef.get()).exists) {
                await userDocRef.delete();
            }
            return { success: true, message: "Usuário não encontrado na Auth, mas removido do Firestore." };
        }
        throw new https.HttpsError("internal", `Falha na exclusão: ${error.message}`);
    }
});


export const resetTerritoryProgress = https.onCall(async (req) => {
    const uid = req.auth?.uid;
    if (!uid) {
        throw new https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    
    const { congregationId, territoryId } = req.data;
    if (!congregationId || !territoryId) {
        throw new https.HttpsError("invalid-argument", "IDs faltando.");
    }

    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (adminUserSnap.data()?.role !== "Administrador") {
        throw new https.HttpsError("permission-denied", "Ação restrita a administradores.");
    }

    const historyPath = `congregations/${congregationId}/territories/${territoryId}/activityHistory`;
    const quadrasRef = db.collection(`congregations/${congregationId}/territories/${territoryId}/quadras`);
    
    try {
        await db.recursiveDelete(db.collection(historyPath));
        console.log(`[resetTerritory] Histórico para ${territoryId} deletado com sucesso.`);
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


export const sendOverdueNotification = https.onCall({ cors: true }, async (req) => {
    if (!req.auth) {
        throw new https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const callingUserDoc = await db.doc(`users/${req.auth.uid}`).get();
    if (!callingUserDoc.exists() || !['Administrador', 'Dirigente'].includes(callingUserDoc.data()?.role)) {
        throw new https.HttpsError('permission-denied', 'Permissão negada.');
    }

    const { userId, title, body } = req.data;
    if (!userId || !title || !body) {
        throw new https.HttpsError("invalid-argument", "userId, title e body são obrigatórios");
    }

    try {
        const userDocRef = db.doc(`users/${userId}`);
        const userDoc = await userDocRef.get();
        const tokens: string[] = userDoc.data()?.fcmTokens || [];

        if (!tokens.length) {
            return { success: true, message: "O usuário não possui dispositivos registrados para notificação." };
        }

        const message = { notification: { title, body }, tokens };
        const response = await admin.messaging().sendEachForMulticast(message);

        const invalidTokens: string[] = [];
        response.responses.forEach((r, idx) => {
            if (!r.success && (r.error?.code === 'messaging/registration-token-not-registered' || r.error?.code === 'messaging/invalid-argument')) {
                invalidTokens.push(tokens[idx]);
            }
        });

        if (invalidTokens.length > 0) {
            await userDocRef.update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens) });
        }
        
        return { success: true, message: "Notificação enviada com sucesso!", successCount: response.successCount };

    } catch (error: any) {
        console.error("Erro na sendOverdueNotification:", error);
        throw new https.HttpsError("internal", error.message || "Erro interno do servidor.");
    }
});


export const generateUploadUrl = https.onCall({ cors: true }, async (req) => {
  if (!req.auth) {
    throw new https.HttpsError('unauthenticated', 'Ação não autorizada.');
  }

  const { filePath, contentType } = req.data;
  if (!filePath || typeof filePath !== 'string' || !contentType) {
    throw new https.HttpsError('invalid-argument', 'Caminho do arquivo e tipo de conteúdo são necessários.');
  }
  
  const options: GetSignedUrlConfig = {
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutos
      contentType: contentType,
  };

  try {
      const [url] = await admin.storage().bucket().file(filePath).getSignedUrl(options);
      return { success: true, url };
  } catch (error: any) {
      console.error("Erro ao gerar URL assinada:", error);
      throw new https.HttpsError('internal', 'Falha ao criar URL de upload.', error.message);
  }
});


// ========================================================================
//   CASCATA DE ESTATÍSTICAS E LÓGICA DE NEGÓCIO
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

// ============================================================================
//   OUTROS GATILHOS (Notificação, Exclusão)
// ============================================================================
export const onNewUserPending = onDocumentCreated("users/{userId}", async (event) => {
    const newUser = event.data?.data();
    if (!newUser || newUser.status !== 'pendente' || !newUser.congregationId) {
        return null;
    }

    const adminsQuery = db.collection("users")
        .where('congregationId', '==', newUser.congregationId)
        .where('role', 'in', ['Administrador', 'Dirigente']);

    try {
        const adminsSnapshot = await adminsQuery.get();
        if (adminsSnapshot.empty) return null;

        let tokens: string[] = [];
        adminsSnapshot.forEach(doc => {
            const adminData = doc.data();
            if (adminData.fcmTokens && Array.isArray(adminData.fcmTokens)) {
                tokens = tokens.concat(adminData.fcmTokens);
            }
        });
        
        tokens = [...new Set(tokens)]; // Remove duplicados

        if (tokens.length === 0) return null;

        const payload = {
            notification: {
                title: "Novo Usuário Pendente",
                body: `O publicador "${newUser.name}" solicitou acesso à congregação.`,
                icon: "/icon-192x192.jpg",
                click_action: "/dashboard/usuarios",
            },
        };
        await admin.messaging().sendToDevice(tokens, payload);
        return { success: true };
    } catch (error) {
        console.error(`[onNewUserPending] Falha ao enviar notificação para admins:`, error);
        return { success: false, error };
    }
});


export const onTerritoryAssigned = onDocumentWritten("congregations/{congId}/territories/{terrId}", async (event) => {
  const dataBefore = event.data?.before.data();
  const dataAfter = event.data?.after.data();

  // Continua apenas se uma nova atribuição foi adicionada
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
              body: `O território "${territoryName}" foi designado para você! Devolva até ${formattedDueDate}.`,
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
        throw new https.HttpsError("internal", "Falha ao deletar território recursivamente.");
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
        throw new https.HttpsError("internal", "Falha ao deletar quadra recursivamente.");
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
        // Se o documento do usuário não for encontrado no Firestore, apenas ignore.
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
                if (!assignment || !assignment.uid) continue;

                const userDoc = await db.doc(`users/${assignment.uid}`).get();
                if (!userDoc.exists) continue;

                const tokens = userDoc.data()?.fcmTokens;
                if (!tokens || tokens.length === 0) continue;

                const payload = {
                    notification: {
                        title: "Território Vencido!",
                        body: `Lembrete: O território "${territory.name}" está com o prazo de devolução vencido.`,
                        icon: "/icon-192x192.jpg",
                        click_action: "/dashboard/meus-territorios",
                    },
                };
                await admin.messaging().sendToDevice(tokens, payload);
                console.log(`Notificação de vencimento enviada para ${assignment.name} sobre o território ${territory.name}.`);
            }
        }
        return { success: true, message: "Verificação de territórios vencidos concluída." };
    } catch (error) {
        console.error("Erro ao verificar territórios vencidos:", error);
        return { success: false, error };
    }
});

// A função de feedback por e-mail, agora como onCall
export const sendFeedbackEmail = https.onCall({ cors: true }, async (req) => {
    if (!req.auth) {
        throw new https.HttpsError("unauthenticated", "O usuário deve estar autenticado para enviar feedback.");
    }
    const { name, email, subject, message } = req.data;
    if (!name || !email || !subject || !message) {
        throw new https.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
    }
    // A lógica de envio de e-mail com um serviço terceiro (como SendGrid, etc.)
    // seria adicionada aqui. Por enquanto, apenas logamos.
    console.log(`Feedback de ${name} (${email}): ${subject} - ${message}`);
    return { success: true, message: "Feedback recebido, muito obrigado!" };
});


    