
import {https, setGlobalOptions} from "firebase-functions/v2";
import {
  onDocumentWritten,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";
import {onValueWritten} from "firebase-functions/v2/database";
import * as admin from "firebase-admin";
import type {AppUser, Notification} from "./types";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
setGlobalOptions({region: "southamerica-east1"});

// ========================================================================
//   FUNÇÕES CHAMÁVEIS (onCall)
// ========================================================================

export const createCongregationAndAdmin = https.onCall(async (data, context) => {
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp } = data;

    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
        throw new https.HttpsError('invalid-argument', 'Todos os campos são obrigatórios.');
    }

    let newUser;
    try {
        const congQuery = await db.collection('congregations').where('number', '==', congregationNumber).get();
        if (!congQuery.empty) {
            throw new https.HttpsError('already-exists', 'Uma congregação com este número já existe.');
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
            whatsapp,
            congregationId: newCongregationRef.id,
            role: "Administrador",
            status: "ativo"
        });

        await batch.commit();
        return { success: true, userId: newUser.uid, message: 'Congregação criada com sucesso!' };
    } catch (error: any) {
        if (newUser) {
            await admin.auth().deleteUser(newUser.uid).catch(deleteError => {
                console.error(`Falha CRÍTICA ao limpar usuário órfão '${newUser?.uid}':`, deleteError);
            });
        }
        console.error("Erro ao criar congregação e admin:", error);
        if (error.code === 'auth/email-already-exists') {
            throw new https.HttpsError('already-exists', 'Este e-mail já está em uso.');
        }
        if (error instanceof https.HttpsError) {
          throw error;
        }
        throw new https.HttpsError('internal', error.message || 'Erro interno no servidor');
    }
});


export const deleteUserAccount = https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new https.HttpsError("unauthenticated", "Ação não autorizada.");
  }
  const callingUserUid = context.auth.uid;
  const {userIdToDelete} = data;

  if (!userIdToDelete || typeof userIdToDelete !== "string") {
    throw new https.HttpsError(
      "invalid-argument",
      "ID do usuário para exclusão é inválido.",
    );
  }

  const callingUserSnap = await db
    .collection("users")
    .doc(callingUserUid)
    .get();
  const isAdmin =
    callingUserSnap.exists &&
    callingUserSnap.data()?.role === "Administrador";

  if (!isAdmin) {
    throw new https.HttpsError(
      "permission-denied",
      "Sem permissão para excluir outros usuários.",
    );
  }

  if (callingUserUid === userIdToDelete) {
    throw new https.HttpsError(
      "permission-denied",
      "Um administrador não pode se autoexcluir por esta função.",
    );
  }

  try {
    await admin.auth().deleteUser(userIdToDelete);
    const userDocRef = db.collection("users").doc(userIdToDelete);
    if ((await userDocRef.get()).exists) {
      await userDocRef.delete();
    }
    return {success: true, message: "Operação de exclusão concluída."};
  } catch (error: any) {
    console.error("Erro CRÍTICO ao excluir usuário:", error);
    if (error.code === "auth/user-not-found") {
      const userDocRef = db.collection("users").doc(userIdToDelete);
      if ((await userDocRef.get()).exists) {
        await userDocRef.delete();
      }
      return {
        success: true,
        message: "Usuário não encontrado na Auth, mas removido do Firestore.",
      };
    }
    throw new https.HttpsError("internal", `Falha na exclusão: ${error.message}`);
  }
});

export const notifyOnNewUser = https.onCall(async (data, context) => {
  const {newUserName, congregationId} = data;
  if (!newUserName || !congregationId) {
    throw new https.HttpsError(
      "invalid-argument",
      "Nome do novo usuário e ID da congregação são necessários.",
    );
  }

  try {
    const roles = ["Administrador", "Dirigente", "Servo de Territórios"];
    const snapshots = await Promise.all(
      roles.map((r) =>
        db
          .collection("users")
          .where("congregationId", "==", congregationId)
          .where("role", "==", r)
          .get(),
      ),
    );
    const managers = snapshots.flatMap((s) => s.docs);

    if (managers.length === 0) {
      return {success: true, message: "Nenhum gerente para notificar."};
    }

    const batch = db.batch();
    const notif: Omit<Notification, "id"> = {
      title: "Novo Usuário Pendente",
      body: `O publicador "${newUserName}" solicitou acesso à congregação.`,
      link: "/dashboard/usuarios",
      type: "user_pending",
      isRead: false,
      createdAt: admin.firestore.Timestamp.now(),
    };

    const notified = new Set<string>();
    managers.forEach((doc) => {
      if (!notified.has(doc.id)) {
        batch.set(doc.ref.collection("notifications").doc(), notif);
        notified.add(doc.id);
      }
    });
    await batch.commit();
    return {success: true, message: `Notificado(s) ${notified.size} gerente(s).`};
  } catch (err) {
    console.error("notifyOnNewUser: Falha ao notificar gerentes", err);
    throw new https.HttpsError(
      "internal",
      "Falha ao criar notificações para os gerentes.",
    );
  }
});


export const getManagersForNotification = https.onCall(async (data, context) => {
    const { congregationId } = data;
    if (!congregationId) {
        throw new https.HttpsError('invalid-argument', 'O ID da congregação é obrigatório.');
    }

    try {
        const rolesToFetch = ['Administrador', 'Dirigente'];
        const queryPromises = rolesToFetch.map(role => 
            db.collection('users')
              .where('congregationId', '==', congregationId)
              .where('role', '==', role)
              .get()
        );
        const results = await Promise.all(queryPromises);
        const managers = results.flatMap(snapshot => 
            snapshot.docs.map(doc => {
                const { name, whatsapp } = doc.data() as AppUser;
                return { name, whatsapp, uid: doc.id }; // Retorna apenas dados seguros
            })
        );
        
        return { success: true, managers };
        
    } catch (error) {
        console.error("Erro ao buscar gerentes:", error);
        throw new https.HttpsError('internal', 'Falha ao buscar contatos dos responsáveis.');
    }
});

export const resetTerritoryProgress = https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new https.HttpsError("unauthenticated", "Ação não autorizada.");
  }

  const {congregationId, territoryId} = data;
  if (!congregationId || !territoryId) {
    throw new https.HttpsError(
      "invalid-argument",
      "IDs de congregação e território são necessários.",
    );
  }

  const adminUserSnap = await db.collection("users").doc(context.auth.uid).get();
  if (adminUserSnap.data()?.role !== "Administrador") {
    throw new https.HttpsError(
      "permission-denied",
      "Ação restrita a administradores.",
    );
  }

  const activityHistoryRef = db.collection(
    `congregations/${congregationId}/territories/${territoryId}/activityHistory`,
  );
  await db.recursiveDelete(activityHistoryRef);

  const quadrasRef = db.collection(
    `congregations/${congregationId}/territories/${territoryId}/quadras`,
  );
  let housesUpdatedCount = 0;
  await db.runTransaction(async (transaction) => {
    const quadrasSnapshot = await transaction.get(quadrasRef);
    const houseUpdates: {
      ref: admin.firestore.DocumentReference;
      data: { status: boolean };
    }[] = [];

    for (const quadraDoc of quadrasSnapshot.docs) {
      const casasSnapshot = await transaction.get(
        quadraDoc.ref.collection("casas"),
      );
      casasSnapshot.forEach((casaDoc) => {
        if (casaDoc.data().status === true) {
          houseUpdates.push({ref: casaDoc.ref, data: {status: false}});
          housesUpdatedCount++;
        }
      });
    }

    for (const update of houseUpdates) {
      transaction.update(update.ref, update.data);
    }
  });

  if (housesUpdatedCount > 0) {
    return {
      success: true,
      message: `Sucesso! ${housesUpdatedCount} casas no território foram resetadas.`,
    };
  }
  return {success: true, message: "Nenhuma alteração necessária."};
});

// ========================================================================
//   TRIGGERS DE CÁLCULO DE ESTATÍSTICAS
// ========================================================================

export const onHouseChange = onDocumentWritten(
  "congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}",
  async (event) => {
    if (!event.data?.after.exists) return null;

    const {congregationId, territoryId, quadraId} = event.params;
    const quadraRef = db.doc(
      `congregations/${congregationId}/territories/${territoryId}/quadras/${quadraId}`,
    );

    try {
      await db.runTransaction(async (tx) => {
        const casasSnap = await tx.get(quadraRef.collection("casas"));
        const totalHouses = casasSnap.size;
        const housesDone = casasSnap.docs.filter(
          (d) => d.data().status === true,
        ).length;

        tx.update(quadraRef, {totalHouses, housesDone});
      });
    } catch (e) {
      console.error("onHouseChange Transaction Error (updating quadra stats):", e);
    }

    if (
      event.data.before.data()?.status === false &&
      event.data.after.data()?.status === true
    ) {
      await db
        .doc(`congregations/${congregationId}/territories/${territoryId}`)
        .update({lastUpdate: admin.firestore.FieldValue.serverTimestamp()});
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
    const quadrasSnap = await territoryRef.collection("quadras").get();

    let totalHouses = 0;
    let housesDone = 0;
    quadrasSnap.forEach((d) => {
      totalHouses += d.data().totalHouses || 0;
      housesDone += d.data().housesDone || 0;
    });

    const progress = totalHouses > 0 ? housesDone / totalHouses : 0;
    return territoryRef.update({
      stats: {totalHouses, housesDone},
      progress,
      quadraCount: quadrasSnap.size,
    });
  },
);

export const onTerritoryChange = onDocumentWritten(
  "congregations/{congregationId}/territories/{territoryId}",
  async (event) => {
    const {congregationId} = event.params;
    const congRef = db.doc(`congregations/${congregationId}`);
    const terrSnap = await congRef.collection("territories").get();

    let urban = 0;
    let rural = 0;
    let totalHouses = 0;
    let totalHousesDone = 0;
    let totalQuadras = 0;
    terrSnap.forEach((d) => {
      const data = d.data();
      if (data.type === "rural") {
        rural++;
      } else {
        urban++;
        totalHouses += data.stats?.totalHouses || 0;
        totalHousesDone += data.stats?.housesDone || 0;
        totalQuadras += data.quadraCount || 0;
      }
    });

    return congRef.update({
      territoryCount: urban,
      ruralTerritoryCount: rural,
      totalQuadras,
      totalHouses,
      totalHousesDone,
      lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
    });
  },
);

// ========================================================================
//   TRIGGERS DE LIMPEZA
// ========================================================================

export const onDeleteTerritory = onDocumentDeleted(
  "congregations/{congregationId}/territories/{territoryId}",
  async (event) => {
    if (!event.data) return null;
    try {
      await db.recursiveDelete(event.data.ref);
      console.log(
        `onDeleteTerritory: Documento e subcoleções de ${event.data.ref.path} excluídos recursivamente.`,
      );
    } catch (err: any) {
      console.error("onDeleteTerritory: Erro ao excluir recursivamente:", err);
    }
    return null;
  },
);

export const onDeleteQuadra = onDocumentDeleted(
  "congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}",
  async (event) => {
    if (!event.data) return null;
    try {
      await db.recursiveDelete(event.data.ref);
      console.log(
        `onDeleteQuadra: Documento e subcoleções de ${event.data.ref.path} excluídos recursivamente.`,
      );
    } catch (err: any) {
      console.error("onDeleteQuadra: Erro ao excluir recursivamente:", err);
    }
    return null;
  },
);

// ========================================================================
//   SISTEMA DE PRESENÇA
// ========================================================================

export const mirrorUserStatus = onValueWritten(
  {ref: "/status/{uid}", region: "us-central1"},
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
        console.error(`[Presence Mirror] Falha para ${uid}:`, err);
      }
    }
    return null;
  },
);
