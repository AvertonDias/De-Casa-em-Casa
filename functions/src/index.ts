
// functions/src/index.ts
import {https, setGlobalOptions, logger} from "firebase-functions/v2";
import {
  onDocumentWritten,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";
import {onValueWritten} from "firebase-functions/v2/database";
import * as admin from "firebase-admin";
import {format} from "date-fns";
import * as crypto from "crypto";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
setGlobalOptions({region: "southamerica-east1"});


// ========================================================================
//   FUNÇÕES HTTPS (agora como onRequest com CORS manual)
// ========================================================================

const setCorsHeaders = (req: https.Request, res: https.Response) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
};

export const createCongregationAndAdmin = https.onRequest(async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    
    const {
      adminName,
      adminEmail,
      adminPassword,
      congregationName,
      congregationNumber,
      whatsapp,
    } = req.body.data;

    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp ) {
      res.status(400).json({error: "Todos os campos são obrigatórios."});
      return;
    }

    let newUser;
    try {
      const congQuery = await db.collection("congregations").where("number", "==", congregationNumber).get();
      if (!congQuery.empty) {
          res.status(409).json({error: "Uma congregação com este número já existe."});
          return;
      }

      newUser = await admin.auth().createUser({
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
      res.status(200).json({data: {
        success: true,
        userId: newUser.uid,
        message: "Congregação criada com sucesso!",
      }});
    } catch (error: any) {
      if (newUser) {
        await admin.auth().deleteUser(newUser.uid).catch((deleteError) => {
            logger.error(`Falha CRÍTICA ao limpar usuário órfão '${newUser?.uid}':`, deleteError);
        });
      }
      if (error.code === "auth/email-already-exists") {
        res.status(409).json({error: "Este e-mail já está em uso."});
      } else {
        logger.error("Erro ao criar congregação e admin:", error);
        res.status(500).json({error: error.message || "Erro interno no servidor"});
      }
    }
});


export const getManagersForNotification = https.onRequest(async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    
    if (!req.body.data.auth) {
      res.status(401).json({error: "Usuário não autenticado."});
      return;
    }
    const {congregationId} = req.body.data;
    if (!congregationId) {
      res.status(400).json({error: "O ID da congregação é obrigatório."});
      return;
    }
    try {
      const rolesToFetch = ["Administrador", "Dirigente"];
      const queryPromises = rolesToFetch.map((role) =>
        db.collection("users").where("congregationId", "==", congregationId).where("role", "==", role).get(),
      );
      const results = await Promise.all(queryPromises);
      const managers = results.flatMap((snapshot) =>
        snapshot.docs.map((doc) => {
          const {name, whatsapp} = doc.data();
          return {uid: doc.id, name, whatsapp};
        }),
      );
      const uniqueManagers = Array.from(
        new Map(managers.map((item) => [item["uid"], item])).values(),
      );
      res.status(200).json({data: {success: true, managers: uniqueManagers}});
    } catch (error) {
      logger.error("Erro ao buscar gerentes:", error);
      res.status(500).json({error: "Falha ao buscar contatos."});
    }
});

export const notifyOnNewUser = https.onRequest(async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    const {newUserName, congregationId} = req.body.data;
    if (!newUserName || !congregationId) {
      res.status(400).json({error: "Dados insuficientes."});
      return;
    }
    try {
      const rolesToNotify = ["Administrador", "Dirigente"];
      const notifications: Promise<any>[] = [];
      for (const role of rolesToNotify) {
        const usersToNotifySnapshot = await db.collection("users").where("congregationId", "==", congregationId).where("role", "==", role).get();
        usersToNotifySnapshot.forEach((userDoc) => {
          const notification = {
            title: "Novo Usuário Aguardando Aprovação",
            body: `O usuário "${newUserName}" solicitou acesso.`,
            link: "/dashboard/usuarios",
            type: "user_pending",
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          };
          notifications.push(
            userDoc.ref.collection("notifications").add(notification),
          );
        });
      }
      await Promise.all(notifications);
      res.status(200).json({data: {success: true}});
    } catch (error) {
      logger.error("Erro ao criar notificações para novo usuário:", error);
      res.status(500).json({error: "Falha ao enviar notificações."});
    }
});

export const requestPasswordReset = https.onRequest(async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    const {email} = req.body.data;
    if (!email) {
      res.status(400).json({error: "O e-mail é obrigatório."});
      return;
    }
    try {
      const user = await admin.auth().getUserByEmail(email);
      const token = crypto.randomUUID();
      const expires = Date.now() + 3600 * 1000;
      await db.collection("resetTokens").doc(token).set({
          uid: user.uid,
          expires: admin.firestore.Timestamp.fromMillis(expires),
      });
      res.status(200).json({data: {success: true, token}});
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        res.status(200).json({data: {
          success: true,
          token: null,
          message: "Se o e-mail existir, um link será enviado.",
        }});
        return;
      }
      logger.error("Erro ao gerar token:", error);
      res.status(500).json({error: "Erro ao iniciar redefinição."});
    }
});

export const resetPasswordWithToken = https.onRequest(async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    const {token, newPassword} = req.body.data;
    if (!token || !newPassword) {
      res.status(400).json({error: "Token e senha são obrigatórios."});
      return;
    }
    const tokenRef = db.collection("resetTokens").doc(token);
    const tokenDoc = await tokenRef.get();
    if (!tokenDoc.exists || tokenDoc.data()?.expires.toMillis() < Date.now()) {
      if(tokenDoc.exists) await tokenRef.delete();
      res.status(400).json({error: "Token inválido ou expirado."});
      return;
    }
    try {
      const uid = tokenDoc.data()?.uid;
      await admin.auth().updateUser(uid, {password: newPassword});
      await tokenRef.delete();
      res.status(200).json({data: {success: true, message: "Senha redefinida."}});
    } catch (error: any) {
      logger.error("Erro ao redefinir senha:", error);
      res.status(500).json({error: "Falha ao atualizar senha."});
    }
});

export const deleteUserAccount = https.onRequest(async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    
    // As chamadas via httpsCallable colocam o auth no req.body.data.auth
    const callingUserUid = req.body.data.auth?.uid;
    if (!callingUserUid) {
      res.status(401).json({error: "Ação não autorizada."});
      return;
    }

    const {userIdToDelete} = req.body.data;
    if (!userIdToDelete) {
      res.status(400).json({error: "ID inválido."});
      return;
    }

    const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
    const isAdmin = callingUserSnap.exists && callingUserSnap.data()?.role === "Administrador";

    if (!isAdmin && callingUserUid !== userIdToDelete) {
        res.status(403).json({ error: "Sem permissão." });
        return;
    }
    if (isAdmin && callingUserUid === userIdToDelete) {
        res.status(403).json({ error: "Admin não pode se autoexcluir." });
        return;
    }

    try {
        await admin.auth().deleteUser(userIdToDelete);
        const userDocRef = db.collection("users").doc(userIdToDelete);
        if ((await userDocRef.get()).exists) {
            await userDocRef.delete();
        }
        res.status(200).json({ data: { success: true, message: "Operação de exclusão concluída." } });
    } catch (error: any) {
        logger.error("Erro CRÍTICO ao excluir usuário:", error);
        res.status(500).json({ error: `Falha na exclusão: ${error.message}` });
    }
});

export const resetTerritoryProgress = https.onRequest(async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    const uid = req.body.data.auth?.uid;
    if (!uid) {
      res.status(401).json({error: "Ação não autorizada."});
      return;
    }
    const { congregationId, territoryId } = req.body.data;
    if (!congregationId || !territoryId) {
        res.status(400).json({ error: "IDs faltando." });
        return;
    }

    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (adminUserSnap.data()?.role !== "Administrador") {
        res.status(403).json({ error: "Ação restrita a administradores." });
        return;
    }

    const historyPath = `congregations/${congregationId}/territories/${territoryId}/activityHistory`;
    const quadrasRef = db.collection(`congregations/${congregationId}/territories/${territoryId}/quadras`);

    try {
        await db.recursiveDelete(db.collection(historyPath));
        let housesUpdatedCount = 0;
        await db.runTransaction(async (transaction) => {
            const quadrasSnapshot = await transaction.get(quadrasRef);
            for (const quadraDoc of quadrasSnapshot.docs) {
                const casasSnapshot = await transaction.get(quadraDoc.ref.collection("casas"));
                casasSnapshot.forEach(casaDoc => {
                    if (casaDoc.data().status === true) {
                        transaction.update(casaDoc.ref, { status: false });
                        housesUpdatedCount++;
                    }
                });
            }
        });
        if (housesUpdatedCount > 0) {
          res.status(200).json({ data: { success: true, message: `Sucesso! ${housesUpdatedCount} casas resetadas.` } });
        } else {
          res.status(200).json({ data: { success: true, message: "Nenhuma casa precisou ser resetada." } });
        }
    } catch (error: any) {
        logger.error(`[resetTerritory] FALHA CRÍTICA:`, error);
        res.status(500).json({ error: "Falha ao processar a limpeza do território." });
    }
});

export const notifyOnTerritoryAssigned = https.onRequest(async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    
    // Lógica principal da função
    try {
      const { data } = req.body;
      if (!data || !data.auth) {
        res.status(401).json({ error: "Ação não autorizada." });
        return;
      }

      const { territoryId, territoryName, assignedUid } = data;
      if (!territoryId || !territoryName || !assignedUid) {
        res.status(400).json({ error: "Dados insuficientes." });
        return;
      }

      const userDoc = await db.collection("users").doc(assignedUid).get();
      if (!userDoc.exists) {
        res.status(404).json({ error: "Usuário não encontrado." });
        return;
      }

      const notification = {
        title: "Você recebeu um novo território!",
        body: `O território "${territoryName}" foi designado para você.`,
        link: `/dashboard/meus-territorios`,
        type: "territory_assigned",
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db
        .collection("users")
        .doc(assignedUid)
        .collection("notifications")
        .add(notification);

      res.status(200).json({ data: { success: true } });
    } catch (error) {
      logger.error("[notifyOnTerritoryAssigned] Erro:", error);
      res.status(500).json({ error: "Falha ao criar notificação." });
    }
});



// ========================================================================
//   GATILHOS FIRESTORE (Mantidos como estão)
// ========================================================================

export const onHouseChange = onDocumentWritten(
  "congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}",
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    if (!event.data?.after.exists) return null;
    const {congregationId, territoryId, quadraId} = event.params;
    const quadraRef = db
      .collection("congregations")
      .doc(congregationId)
      .collection("territories")
      .doc(territoryId)
      .collection("quadras")
      .doc(quadraId);
    try {
      await db.runTransaction(async (transaction) => {
        const casasSnapshot = await transaction.get(
          quadraRef.collection("casas"),
        );
        const totalHouses = casasSnapshot.size;
        const housesDone = casasSnapshot.docs.filter(
          (doc) => doc.data().status === true,
        ).length;
        transaction.update(quadraRef, {totalHouses, housesDone});
      });
    } catch (e) {
      logger.error("onHouseChange Error:", e);
    }
    if (beforeData?.status === false && afterData?.status === true) {
      const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
      const today = format(new Date(), "yyyy-MM-dd");
      const activityHistoryRef = territoryRef.collection("activityHistory");
      try {
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
            description: "Primeiro trabalho do dia registrado. (Automático)",
            userId: "automatic_system_log",
            userName: "Sistema",
          });
        }
      } catch (error) {
        logger.error("onHouseChange activity log error:", error);
      }
      await territoryRef.update({
        lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return null;
  },
);

export const onQuadraChange = onDocumentWritten(
  "congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}",
  async (event) => {
    const {congregationId, territoryId} = event.params;
    const territoryRef = db.doc(
      `congregations/${congregationId}/territories/${territoryId}`,
    );
    const quadrasSnapshot = await territoryRef.collection("quadras").get();
    let totalHouses = 0;
    let housesDone = 0;
    quadrasSnapshot.forEach((doc) => {
      totalHouses += doc.data().totalHouses || 0;
      housesDone += doc.data().housesDone || 0;
    });
    const progress = totalHouses > 0 ? housesDone / totalHouses : 0;
    return territoryRef.update({
      stats: {totalHouses, housesDone},
      progress,
      quadraCount: quadrasSnapshot.size,
    });
  },
);

export const onTerritoryChange = onDocumentWritten(
  "congregations/{congregationId}/territories/{territoryId}",
  async (event) => {
    const {congregationId} = event.params;
    const congregationRef = db.doc(`congregations/${congregationId}`);
    const territoriesRef = congregationRef.collection("territories");
    const territoriesSnapshot = await territoriesRef.get();
    let urbanCount = 0;
    let ruralCount = 0;
    let totalHouses = 0;
    let totalHousesDone = 0;
    let totalQuadras = 0;
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
  },
);

export const onDeleteTerritory = onDocumentDeleted(
  "congregations/{congregationId}/territories/{territoryId}",
  async (event) => {
    if (!event.data) return null;
    const ref = event.data.ref;
    try {
      await admin.firestore().recursiveDelete(ref);
      return {success: true};
    } catch (error) {
      logger.error(`Error deleting territory ${event.params.territoryId}:`, error);
      throw new https.HttpsError("internal", "Failed to delete territory.");
    }
  },
);

export const onDeleteQuadra = onDocumentDeleted(
  "congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}",
  async (event) => {
    if (!event.data) return null;
    const ref = event.data.ref;
    try {
      await admin.firestore().recursiveDelete(ref);
      return {success: true};
    } catch (error) {
      logger.error(`Error deleting quadra ${event.params.quadraId}:`, error);
      throw new https.HttpsError("internal", "Failed to delete quadra.");
    }
  },
);

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
      if (err.code !== "not-found") {
        logger.error(`[Presence Mirror] Failed for ${uid}:`, err);
      }
    }
    return null;
  },
);
