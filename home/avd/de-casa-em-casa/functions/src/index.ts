// functions/src/index.ts
import { https, setGlobalOptions, pubsub } from "firebase-functions/v2";
import { onDocumentWritten, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import * as admin from "firebase-admin";
import { format } from 'date-fns';
import { GetSignedUrlConfig } from "@google-cloud/storage";
import * as cors from 'cors';

// Inicializa o admin apenas uma vez para evitar erros em múltiplas invocações.
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const allowedOrigins = [
    "http://localhost:3000",
    "https://appterritorios-e5bb5.web.app",
    "https://appterritorios-e5bb5.firebaseapp.com",
    "https://6000-firebase-studio-1750624095908.cluster-m7tpz3bmgjgoqrktlvd4ykrc2m.cloudworkstations.dev",
];

const corsHandler = cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
});

setGlobalOptions({ 
  region: "southamerica-east1",
});

export const createCongregationAndAdmin = https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Método não permitido' });
            return;
        }
        const { adminName, adminEmail, adminPassword, congregationName, congregationNumber } = req.body;
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
});

export const generateUploadUrl = https.onCall(async (req) => {
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

export const sendFeedbackEmail = https.onCall(async (req) => {
  if (!req.auth) {
      throw new https.HttpsError("unauthenticated", "O usuário deve estar autenticado para enviar feedback.");
  }
  try {
      const { name, email, subject, message } = req.data;
      if (!name || !email || !subject || !message) {
          throw new https.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
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
      if (error instanceof https.HttpsError) {
          throw error;
      }
      throw new https.HttpsError("internal", "Erro interno do servidor ao processar o feedback.");
  }
});

export const onHouseChange = onDocumentWritten("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}", async (event) => {
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();
  
  if (!event.data?.after.exists) return null;

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

export const onTerritoryAssigned = onDocumentWritten("congregations/{congId}/territories/{terrId}", async (event) => {
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

export const mirrorUserStatus = onValueWritten(
  {
    ref: "/status/{uid}",
    region: "us-central1"
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
