
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// Função que dispara na criação de um novo documento de usuário
export const notifyAdminOfNewUser = functions.firestore
  .document("users/{userId}")
  .onCreate(async (snapshot) => {
    const newUser = snapshot.data();

    // 1. Verifica se o novo usuário está pendente
    if (newUser.status !== "pendente") {
      console.log("Novo usuário não está pendente, nenhuma notificação enviada.");
      return null;
    }

    const congregationId = newUser.congregationId;

    if (!congregationId) {
        console.log("Novo usuário não tem congregationId, nenhuma notificação enviada.");
        return null;
    }

    // 2. Busca todos os admins da mesma congregação
    const adminsSnapshot = await db
      .collection("users")
      .where("congregationId", "==", congregationId)
      .where("role", "==", "Administrador")
      .get();

    if (adminsSnapshot.empty) {
      console.log("Nenhum administrador encontrado para esta congregação.");
      return null;
    }

    // 3. Monta e envia a notificação para cada admin
    const payload = {
      notification: {
        title: "Novo Usuário Aguardando Aprovação!",
        body: `O usuário ${newUser.name} se cadastrou e precisa de sua aprovação.`,
        icon: "/icon-192x192.png",
        click_action: "/dashboard/usuarios",
      },
    };

    const promises = adminsSnapshot.docs.map(async (adminDoc) => {
      const adminData = adminDoc.data();
      if (adminData.fcmTokens && adminData.fcmTokens.length > 0) {
        return admin.messaging().sendToDevice(adminData.fcmTokens, payload);
      }
      return Promise.resolve();
    });

    await Promise.all(promises);
    console.log("Notificações enviadas para os administradores.");
    return null;
  });

export const deleteUserAccount = functions.https.onCall(async (data, context) => {
  const callingUserUid = context.auth?.uid;
  if (!callingUserUid) {
    throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada.");
  }

  const userIdToDelete = data.uid;
  if (!userIdToDelete || typeof userIdToDelete !== 'string') {
    throw new functions.https.HttpsError("invalid-argument", "O ID do usuário a ser excluído não foi fornecido.");
  }

  const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
  const isAdmin = callingUserSnap.exists && callingUserSnap.data()?.role === "Administrador";

  if (!isAdmin && callingUserUid !== userIdToDelete) {
      throw new functions.https.HttpsError("permission-denied", "Você não tem permissão para realizar esta ação.");
  }

  try {
    const userDocRef = db.collection("users").doc(userIdToDelete);
    if ((await userDocRef.get()).exists) {
        await userDocRef.delete();
        console.log(`Documento do usuário ${userIdToDelete} excluído do Firestore.`);
    } else {
        console.log(`Documento do usuário ${userIdToDelete} não foi encontrado no Firestore, pulando.`);
    }

    try {
      await admin.auth().deleteUser(userIdToDelete);
      console.log(`Usuário ${userIdToDelete} excluído da autenticação.`);
    } catch (authError: any) {
        if (authError.code === "auth/user-not-found") {
            console.warn(`Usuário ${userIdToDelete} não encontrado na autenticação, provavelmente já foi deletado.`);
        } else {
            throw authError;
        }
    }

    return { success: true, message: "Operação de exclusão concluída." };
  } catch (error: any) {
    console.error("Erro CRÍTICO ao excluir usuário:", error);
    throw new functions.https.HttpsError("internal", `Falha na exclusão: ${error.message}`);
  }
});

// Atualiza as estatísticas de uma quadra e do território pai sempre que uma casa é alterada.
export const updateTerritoryStats = functions.firestore
  .document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}")
  .onWrite(async (change, context) => {
    const { congregationId, territoryId, quadraId } = context.params;

    const quadraRef = db.doc(`congregations/${congregationId}/territories/${territoryId}/quadras/${quadraId}`);
    const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);

    // Recalcula stats da quadra
    const casasSnapshot = await quadraRef.collection("casas").get();
    const totalHousesInQuadra = casasSnapshot.size;
    const housesDoneInQuadra = casasSnapshot.docs.filter(doc => doc.data().status === true).length;
    await quadraRef.update({
      totalHouses: totalHousesInQuadra,
      housesDone: housesDoneInQuadra,
    });
    console.log(`Stats for quadra ${quadraId} updated.`);

    // Recalcula stats do território
    const quadrasSnapshot = await territoryRef.collection("quadras").get();
    let totalHousesInTerritory = 0;
    let housesDoneInTerritory = 0;
    quadrasSnapshot.forEach(doc => {
      totalHousesInTerritory += doc.data().totalHouses || 0;
      housesDoneInTerritory += doc.data().housesDone || 0;
    });

    const progress = totalHousesInTerritory > 0 ? (housesDoneInTerritory / totalHousesInTerritory) : 0;
    await territoryRef.update({
      totalHouses: totalHousesInTerritory,
      housesDone: housesDoneInTerritory,
      progress: progress,
    });
    console.log(`Stats for territory ${territoryId} updated.`);

    return null;
  });

// Deleta sub-coleções quando um território é excluído para manter a integridade dos dados.
export const deleteSubcollectionsOnTerritoryDelete = functions.firestore
  .document("congregations/{congregationId}/territories/{territoryId}")
  .onDelete(async (snapshot, context) => {
    const { congregationId, territoryId } = context.params;
    const territoryPath = `congregations/${congregationId}/territories/${territoryId}`;
    
    console.log(`Deleting all subcollections for territory: ${territoryPath}`);
    await admin.firestore().recursiveDelete(db.collection(territoryPath));
    console.log("Subcollections deleted successfully.");
  });
