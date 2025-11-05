
// src/functions/src/index.ts

import { https, setGlobalOptions, logger } from "firebase-functions/v2";
import {
  onDocumentWritten,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import admin from "firebase-admin";
import {
  QueryDocumentSnapshot,
  Transaction,
  DocumentReference,
} from "firebase-admin/firestore";
import { format } from "date-fns";
import * as crypto from "crypto";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
setGlobalOptions({ region: "southamerica-east1" });

// ========================================================================
//   CORS WRAPPER
// ========================================================================
function withCors(handler: (req: https.Request, res: any) => void | Promise<void>) {
    return https.onRequest({ 
        cors: [
            "https://de-casa-em-casa.web.app",
            "https://de-casa-em-casa.firebaseapp.com",
            /https:\/\/de-casa-em-casa--pr-.*\.web\.app/,
            /https:\/\/.*\.cloudworkstations\.dev/
        ]
    }, async (req, res) => {
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Firebase-Instance-ID-Token');
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }
        await handler(req, res);
    });
}


// ========================================================================
//   FUNÇÕES HTTPS (onCall transformadas em onRequest com withCors)
// ========================================================================

export const createCongregationAndAdmin = withCors(async (req, res) => {
    try {
        const {
          adminName,
          adminEmail,
          adminPassword,
          congregationName,
          congregationNumber,
          whatsapp,
        } = req.body.data;

        if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
          res.status(400).json({ data: { success: false, error: "Todos os campos são obrigatórios." } });
          return;
        }

        const congQuery = await db.collection("congregations").where("number", "==", congregationNumber).get();
        if (!congQuery.empty) {
            res.status(409).json({ data: { success: false, error: "Uma congregação com este número já existe." } });
            return;
        }

        const newUser = await admin.auth().createUser({
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
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
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
        res.status(200).json({
            data: {
                success: true,
                userId: newUser.uid,
                message: "Congregação criada com sucesso!",
            },
        });

    } catch (error: any) {
        logger.error("Erro em createCongregationAndAdmin:", error);
        if (error.code === "auth/email-already-exists") {
            res.status(409).json({ data: { success: false, error: "Este e-mail já está em uso." } });
        } else {
            res.status(500).json({ data: { success: false, error: error.message || "Erro interno no servidor" } });
        }
    }
});

export const notifyOnNewUser = withCors(async (req, res) => {
    try {
        const { newUserName, congregationId } = req.body.data;
        if (!newUserName || !congregationId) {
            res.status(400).json({ data: { success: false, error: "Dados insuficientes para notificação." } });
            return;
        }

        const rolesToNotify = ["Administrador", "Dirigente"];
        const notifications: Promise<any>[] = [];

        for (const role of rolesToNotify) {
            const usersToNotifySnapshot = await db
                .collection("users")
                .where("congregationId", "==", congregationId)
                .where("role", "==", role)
                .get();
            usersToNotifySnapshot.forEach((userDoc: QueryDocumentSnapshot) => {
                const notification = {
                    title: "Novo Usuário Aguardando Aprovação",
                    body: `O usuário "${newUserName}" solicitou acesso à congregação.`,
                    link: "/dashboard/usuarios",
                    type: "user_pending",
                    isRead: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                notifications.push(userDoc.ref.collection("notifications").add(notification));
            });
        }

        await Promise.all(notifications);
        res.status(200).json({ data: { success: true } });
    } catch (error: any) {
        logger.error("Erro ao criar notificações para novo usuário:", error);
        res.status(500).json({ data: { success: false, error: "Falha ao enviar notificações." } });
    }
});

export const requestPasswordReset = withCors(async (req, res) => {
    try {
        const { email } = req.body.data;
        if (!email) {
            res.status(400).json({ data: { success: false, error: "O e-mail é obrigatório." } });
            return;
        }

        try {
            const user = await admin.auth().getUserByEmail(email);
            const token = crypto.randomUUID();
            const expires = Date.now() + 3600 * 1000; // 1 hora

            await db.collection("resetTokens").doc(token).set({
                uid: user.uid,
                expires: admin.firestore.Timestamp.fromMillis(expires),
            });
            res.status(200).json({ data: { success: true, token } });
        } catch (error: any) {
            if (error.code === "auth/user-not-found") {
                res.status(200).json({
                    data: {
                        success: true,
                        token: null,
                        message: "Se o e-mail existir, um link será enviado.",
                    },
                });
            } else {
                throw error;
            }
        }
    } catch (error: any) {
        logger.error("Erro ao gerar token de redefinição:", error);
        res.status(500).json({ data: { success: false, error: "Erro ao iniciar o processo de redefinição." } });
    }
});


export const resetPasswordWithToken = withCors(async (req, res) => {
    try {
        const { token, newPassword } = req.body.data;
        if (!token || !newPassword) {
            res.status(400).json({ data: { success: false, error: "Token e nova senha são obrigatórios." } });
            return;
        }

        const tokenRef = db.collection("resetTokens").doc(token);
        const tokenDoc = await tokenRef.get();

        if (!tokenDoc.exists) {
            res.status(404).json({ data: { success: false, error: "Token inválido ou já utilizado." } });
            return;
        }
        if (tokenDoc.data()?.expires.toMillis() < Date.now()) {
            await tokenRef.delete();
            res.status(410).json({ data: { success: false, error: "O token de redefinição expirou." } });
            return;
        }

        const uid = tokenDoc.data()?.uid;
        await admin.auth().updateUser(uid, { password: newPassword });
        await tokenRef.delete();
        res.status(200).json({ data: { success: true } });
    } catch (error: any) {
        logger.error("Erro ao redefinir senha com token:", error);
        res.status(500).json({ data: { success: false, error: "Falha ao atualizar a senha." } });
    }
});


export const deleteUserAccount = withCors(async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ data: { success: false, error: "Ação não autorizada. Sem token." } });
            return;
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const callingUserUid = decodedToken.uid;
        const { userIdToDelete } = req.body.data;
        if (!userIdToDelete) {
            res.status(400).json({ data: { success: false, error: "ID do usuário a ser deletado é obrigatório." } });
            return;
        }

        const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
        const isAdmin = callingUserSnap.exists && callingUserSnap.data()?.role === "Administrador";

        if (!isAdmin && callingUserUid !== userIdToDelete) {
            res.status(403).json({ data: { success: false, error: "Sem permissão." } });
            return;
        }
        if (isAdmin && callingUserUid === userIdToDelete) {
            res.status(403).json({ data: { success: false, error: "Admin não pode se autoexcluir." } });
            return;
        }

        await admin.auth().deleteUser(userIdToDelete);
        const userDocRef = db.collection("users").doc(userIdToDelete);
        if ((await userDocRef.get()).exists) {
            await userDocRef.delete();
        }
        res.status(200).json({ data: { success: true } });

    } catch (error: any) {
        logger.error("Erro ao excluir usuário:", error);
        if (error.code === 'auth/id-token-expired') {
            res.status(401).json({ data: { success: false, error: "Token expirado. Faça login novamente." } });
        } else {
            res.status(500).json({ data: { success: false, error: error.message || "Falha na exclusão." } });
        }
    }
});


export const resetTerritoryProgress = withCors(async (req, res) => {
    try {
        const { congregationId, territoryId } = req.body.data;

        if (!congregationId || !territoryId) {
            res.status(400).json({ data: { success: false, error: "IDs faltando." } });
            return;
        }

        const historyPath = `congregations/${congregationId}/territories/${territoryId}/activityHistory`;
        const quadrasRef = db.collection(`congregations/${congregationId}/territories/${territoryId}/quadras`);

        await db.recursiveDelete(db.collection(historyPath));
        logger.log(`[resetTerritory] Histórico para ${territoryId} deletado com sucesso.`);

        let housesUpdatedCount = 0;
        await db.runTransaction(async (transaction: Transaction) => {
            const quadrasSnapshot = await transaction.get(quadrasRef);
            const housesToUpdate: { ref: DocumentReference; data: { status: boolean } }[] = [];

            for (const quadraDoc of quadrasSnapshot.docs) {
                const casasSnapshot = await transaction.get(quadraDoc.ref.collection("casas"));
                casasSnapshot.forEach((casaDoc: QueryDocumentSnapshot) => {
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
            res.status(200).json({ data: { success: true, message: `Sucesso! ${housesUpdatedCount} casas no território foram resetadas.` } });
        } else {
            res.status(200).json({ data: { success: true, message: "Nenhuma alteração necessária, nenhuma casa estava marcada como 'feita'." } });
        }
    } catch (error: any) {
        logger.error(`[resetTerritory] FALHA CRÍTICA ao limpar o território:`, error);
        res.status(500).json({ data: { success: false, error: "Falha ao processar a limpeza do território." } });
    }
});



// ========================================================================
//   GATILHOS FIRESTORE (UNIFICADOS)
// ========================================================================

async function updateCongregationStats(congregationId: string) {
  const congregationRef = db.doc(`congregations/${congregationId}`);
  const territoriesRef = congregationRef.collection("territories");

  const territoriesSnapshot = await territoriesRef.get();

  let urbanCount = 0,
    ruralCount = 0,
    totalHouses = 0,
    totalHousesDone = 0,
    totalQuadras = 0;

  territoriesSnapshot.forEach((doc: QueryDocumentSnapshot) => {
    const data = doc.data();
    if (data.type === "rural") {
      ruralCount++;
    } else {
      urbanCount++;
      totalHouses += data.stats?.totalHouses || 0;
      totalHousesDone += data.stats?.housesDone || 0;
      totalQuadras += data.quadraCount || 0;
    }
  });

  return congregationRef.update({
    territoryCount: urbanCount,
    ruralTerritoryCount: ruralCount,
    totalQuadras,
    totalHouses,
    totalHousesDone,
    lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function updateTerritoryStats(congregationId: string, territoryId: string) {
  const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
  const quadrasSnapshot = await territoryRef.collection("quadras").get();

  let totalHouses = 0;
  let housesDone = 0;
  quadrasSnapshot.forEach((doc: QueryDocumentSnapshot) => {
    totalHouses += doc.data().totalHouses || 0;
    housesDone += doc.data().housesDone || 0;
  });

  const progress = totalHouses > 0 ? housesDone / totalHouses : 0;
  await territoryRef.update({
    stats: { totalHouses, housesDone },
    progress,
    quadraCount: quadrasSnapshot.size,
  });

  // Após atualizar o território, atualiza a congregação
  await updateCongregationStats(congregationId);
}

// Gatilho que observa a escrita em uma CASA
export const onHouseWrite = onDocumentWritten(
    "congregations/{congId}/territories/{terrId}/quadras/{quadraId}/casas/{casaId}",
    async (event) => {
        const { congId, terrId, quadraId } = event.params;
        
        // Atualiza as estatísticas da quadra
        const quadraRef = db.doc(`congregations/${congId}/territories/${terrId}/quadras/${quadraId}`);
        const casasSnapshot = await quadraRef.collection("casas").get();
        const totalHousesInQuadra = casasSnapshot.size;
        const housesDoneInQuadra = casasSnapshot.docs.filter(
            (doc: QueryDocumentSnapshot) => doc.data().status === true
        ).length;
        
        await quadraRef.update({ totalHouses: totalHousesInQuadra, housesDone: housesDoneInQuadra });
        
        // Dispara a atualização do território
        await updateTerritoryStats(congId, terrId);

        // Lógica para registrar a atividade diária
        const beforeData = event.data?.before.data();
        const afterData = event.data?.after.data();

        if (beforeData?.status === false && afterData?.status === true) {
            const territoryRef = db.doc(`congregations/${congId}/territories/${terrId}`);
            const today = format(new Date(), "yyyy-MM-dd");
            const activityHistoryRef = territoryRef.collection("activityHistory");

            const todayActivitiesSnap = await activityHistoryRef
                .where("activityDateStr", "==", today)
                .where("type", "==", "work")
                .limit(1)
                .get();

            if (todayActivitiesSnap.empty) {
                await activityHistoryRef.add({
                    type: "work",
                    activityDate: admin.firestore.FieldValue.serverTimestamp(),
                    activityDateStr: today,
                    description: "Primeiro trabalho do dia registrado. (Registro Automático)",
                    userId: "automatic_system_log",
                    userName: "Sistema",
                });
            }
            await territoryRef.update({ lastUpdate: admin.firestore.FieldValue.serverTimestamp() });
        }
    }
);

// Gatilho que observa a escrita/exclusão de uma QUADRA
export const onQuadraWrite = onDocumentWritten(
    "congregations/{congId}/territories/{terrId}/quadras/{quadraId}",
    async (event) => {
        const { congId, terrId } = event.params;
        await updateTerritoryStats(congId, terrId);
    }
);


// Gatilho que observa a escrita/exclusão de um TERRITÓRIO
export const onTerritoryWrite = onDocumentWritten(
  "congregations/{congId}/territories/{terrId}",
  async (event) => {
      const { congId } = event.params;
      await updateCongregationStats(congId);
  }
);


export const onDeleteTerritory = onDocumentDeleted(
  "congregations/{congregationId}/territories/{territoryId}",
  async (event) => {
    if (!event.data) {
      logger.warn(
        `[onDeleteTerritory] Evento de deleção para ${event.params.territoryId} sem dados. Ignorando.`
      );
      return null;
    }
    const ref = event.data.ref;
    try {
      await admin.firestore().recursiveDelete(ref);
      logger.log(
        `[onDeleteTerritory] Território ${event.params.territoryId} e subcoleções deletadas.`
      );
      // A atualização da congregação será feita pelo gatilho onTerritoryWrite
      return { success: true };
    } catch (error) {
      logger.error(
        `[onDeleteTerritory] Erro ao deletar ${event.params.territoryId}:`,
        error
      );
      throw new https.HttpsError(
        "internal",
        "Falha ao deletar território recursivamente."
      );
    }
  }
);

export const onDeleteQuadra = onDocumentDeleted(
  "congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}",
  async (event) => {
    if (!event.data) {
      logger.warn(
        `[onDeleteQuadra] Evento de deleção para ${event.params.quadraId} sem dados. Ignorando.`
      );
      return null;
    }
    const ref = event.data.ref;
    try {
      await admin.firestore().recursiveDelete(ref);
      logger.log(
        `[onDeleteQuadra] Quadra ${event.params.quadraId} e subcoleções deletadas.`
      );
       // A atualização do território será feita pelo gatilho onQuadraWrite
      return { success: true };
    } catch (error) {
      logger.error(
        `[onDeleteQuadra] Erro ao deletar ${event.params.quadraId}:`,
        error
      );
      throw new https.HttpsError(
        "internal",
        "Falha ao deletar quadra recursivamente."
      );
    }
  }
);

// ============================================================================
//   SISTEMA DE PRESENÇA (RTDB -> FIRESTORE)
// ============================================================================

export const mirrorUserStatus = onValueWritten(
  {
    ref: "/status/{uid}",
    region: "us-central1", // O sistema de presença funciona melhor na região padrão
  },
  async (event) => {
    const eventStatus = event.data.after.val();
    const uid = event.params.uid;
    const userDocRef = db.doc(`users/${uid}`);

    try {
      if (!eventStatus || eventStatus.state === "offline") {
        await userDocRef.update({
          isOnline: false,
          lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else if (eventStatus.state === "online") {
        await userDocRef.update({
          isOnline: true,
          lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (err: any) {
      // Ignora erro 'not-found' que pode acontecer se o usuário for excluído
      if (err.code !== "not-found") {
        logger.error(`[Presence Mirror] Falha para ${uid}:`, err);
      }
    }
    return null;
  }
);
