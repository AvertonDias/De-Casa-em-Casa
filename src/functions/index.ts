// src/functions/index.ts

import { https, setGlobalOptions, logger } from "firebase-functions/v2";
import { HttpsError } from "firebase-functions/v2/https";
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
//   FUNÇÕES HTTPS (onCall)
// ========================================================================

export const createCongregationAndAdmin = https.onCall(async (request) => {
    const {
      adminName,
      adminEmail,
      adminPassword,
      congregationName,
      congregationNumber,
      whatsapp,
    } = request.data;

    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
      throw new HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
    }

    try {
      const congQuery = await db.collection("congregations").where("number", "==", congregationNumber).get();
      if (!congQuery.empty) {
        throw new HttpsError("already-exists", "Uma congregação com este número já existe.");
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
      return { success: true, userId: newUser.uid, message: "Congregação criada com sucesso!" };

    } catch (error: any) {
      if (error.code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "Este e-mail já está em uso.");
      }
      logger.error("Erro ao criar congregação e admin:", error);
      throw new HttpsError("internal", error.message || "Erro interno no servidor");
    }
});

export const getManagersForNotification = https.onCall(async (request) => {
    const { congregationId } = request.data;
    if (!congregationId) {
      throw new HttpsError("invalid-argument", "O ID da congregação é obrigatório.");
    }

    try {
      const rolesToFetch = ["Administrador", "Dirigente"];
      const queryPromises = rolesToFetch.map((role) =>
        db.collection("users")
          .where("congregationId", "==", congregationId)
          .where("role", "==", role)
          .get()
      );

      const results = await Promise.all(queryPromises);
      const managers = results.flatMap((snapshot) =>
        snapshot.docs.map((doc: QueryDocumentSnapshot) => {
          const { name, whatsapp } = doc.data();
          return { uid: doc.id, name, whatsapp };
        })
      );
      
      const uniqueManagers = Array.from(new Map(managers.map((item) => [item["uid"], item])).values());
      return { success: true, managers: uniqueManagers };

    } catch (error: any) {
      logger.error("Erro ao buscar gerentes:", error);
      throw new HttpsError("internal", "Falha ao buscar contatos dos responsáveis.");
    }
});

export const notifyOnNewUser = https.onCall(async (request) => {
    const { newUserName, congregationId } = request.data;
    if (!newUserName || !congregationId) {
      throw new HttpsError("invalid-argument", "Dados insuficientes para notificação.");
    }

    try {
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
      return { success: true };
    } catch (error: any) {
      logger.error("Erro ao criar notificações para novo usuário:", error);
      throw new HttpsError("internal", "Falha ao enviar notificações.");
    }
});

export const requestPasswordReset = https.onCall(async (request) => {
    const { email } = request.data;
    if (!email) {
      throw new HttpsError("invalid-argument", "O e-mail é obrigatório.");
    }

    try {
      const user = await admin.auth().getUserByEmail(email);
      const token = crypto.randomUUID();
      const expires = Date.now() + 3600 * 1000; // 1 hora

      await db.collection("resetTokens").doc(token).set({
          uid: user.uid,
          expires: admin.firestore.Timestamp.fromMillis(expires),
      });
      return { success: true, token };
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        return { success: true, token: null, message: "Se o e-mail existir, um link será enviado." };
      }
      logger.error("Erro ao gerar token de redefinição:", error);
      throw new HttpsError("internal", "Erro ao iniciar o processo de redefinição.");
    }
});

export const resetPasswordWithToken = https.onCall(async (request) => {
    const { token, newPassword } = request.data;
    if (!token || !newPassword) {
      throw new HttpsError("invalid-argument", "Token e nova senha são obrigatórios.");
    }

    try {
      const tokenRef = db.collection("resetTokens").doc(token);
      const tokenDoc = await tokenRef.get();

      if (!tokenDoc.exists) {
        throw new HttpsError("not-found", "Token inválido ou já utilizado.");
      }
      if (tokenDoc.data()?.expires.toMillis() < Date.now()) {
        await tokenRef.delete();
        throw new HttpsError("deadline-exceeded", "O token de redefinição expirou.");
      }

      const uid = tokenDoc.data()?.uid;
      await admin.auth().updateUser(uid, { password: newPassword });
      await tokenRef.delete();
      return { success: true };
    } catch (error: any) {
      logger.error("Erro ao redefinir senha com token:", error);
      throw new HttpsError("internal", "Falha ao atualizar a senha.");
    }
});

export const deleteUserAccount = https.onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Ação não autorizada. Sem token.");
    }
    const callingUserUid = request.auth.uid;
    const { userIdToDelete } = request.data;

    if (!userIdToDelete) {
      throw new HttpsError("invalid-argument", "ID do usuário a ser deletado é obrigatório.");
    }
    
    try {
      const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
      const isAdmin = callingUserSnap.exists && callingUserSnap.data()?.role === "Administrador";

      if (!isAdmin && callingUserUid !== userIdToDelete) {
        throw new HttpsError("permission-denied", "Sem permissão.");
      }
      if (isAdmin && callingUserUid === userIdToDelete) {
        throw new HttpsError("permission-denied", "Admin não pode se autoexcluir.");
      }

      await admin.auth().deleteUser(userIdToDelete);
      const userDocRef = db.collection("users").doc(userIdToDelete);
      if ((await userDocRef.get()).exists) {
        await userDocRef.delete();
      }
      return { success: true };

    } catch (error: any) {
      logger.error("Erro ao excluir usuário:", error);
      throw new HttpsError("internal", error.message || "Falha na exclusão.");
    }
});


export const resetTerritoryProgress = https.onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const { congregationId, territoryId } = request.data;

    if (!congregationId || !territoryId) {
      throw new HttpsError("invalid-argument", "IDs faltando.");
    }
    
    try {
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
        logger.error(`[resetTerritory] FALHA CRÍTICA ao limpar o território:`, error);
        throw new HttpsError("internal", "Falha ao processar a limpeza do território.");
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

  territoriesSnapshot.forEach((doc) => {
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
  quadrasSnapshot.forEach((doc) => {
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

export const onWriteTerritoryData = onDocumentWritten(
  "congregations/{congId}/territories/{terrId}/{anyCollection}/{anyId}",
  async (event) => {
    const { congId, terrId, anyCollection } = event.params;
    
    // Se a mudança foi em uma casa (que está dentro de uma quadra)
    if (anyCollection === "quadras" && event.data?.after.ref.parent.parent) {
      const quadraId = event.data.after.ref.parent.parent.id;
      const quadraRef = db.doc(`congregations/${congId}/territories/${terrId}/quadras/${quadraId}`);
      
      const casasSnapshot = await quadraRef.collection("casas").get();
      const totalHousesInQuadra = casasSnapshot.size;
      const housesDoneInQuadra = casasSnapshot.docs.filter(
        (doc) => doc.data().status === true
      ).length;
      
      await quadraRef.update({ totalHouses: totalHousesInQuadra, housesDone: housesDoneInQuadra });
      await updateTerritoryStats(congId, terrId);

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
    // Se a mudança foi diretamente em uma quadra (criação/exclusão)
    else if (anyCollection === "quadras") {
      await updateTerritoryStats(congId, terrId);
    } 
    // Se a mudança foi diretamente no território (ex. tipo mudou)
    else {
       await updateCongregationStats(congId);
    }
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
      // Dispara a atualização da congregação após a exclusão
      await updateCongregationStats(event.params.congregationId);
      return { success: true };
    } catch (error) {
      logger.error(
        `[onDeleteTerritory] Erro ao deletar ${event.params.territoryId}:`,
        error
      );
      throw new HttpsError(
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
       // Dispara a atualização do território após a exclusão da quadra
      await updateTerritoryStats(event.params.congregationId, event.params.territoryId);
      return { success: true };
    } catch (error) {
      logger.error(
        `[onDeleteQuadra] Erro ao deletar ${event.params.quadraId}:`,
        error
      );
      throw new HttpsError(
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
    region: "us-central1",
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
      if (err.code !== 5) { // 5 = NOT_FOUND, que é esperado
        logger.error(`[Presence Mirror] Falha para ${uid}:`, err);
      }
    }
    return null;
  }
);
