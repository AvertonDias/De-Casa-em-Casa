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
        icon: "/icon-192x192.png", // Assegure-se que este ícone existe na sua pasta /public
        click_action: "/dashboard/usuarios", // URL para abrir ao clicar
      },
    };

    const promises = adminsSnapshot.docs.map(async (adminDoc) => {
      const adminData = adminDoc.data();
      if (adminData.fcmTokens && adminData.fcmTokens.length > 0) {
        // Envia para todos os dispositivos do admin
        return admin.messaging().sendToDevice(adminData.fcmTokens, payload);
      }
      return Promise.resolve();
    });

    await Promise.all(promises);
    console.log("Notificações enviadas para os administradores.");
    return null;
  });

// Função para deletar um usuário (Callable Function)
export const deleteUserAccount = functions.https.onCall(async (data, context) => {
  // 1. Verificação de Permissão
  const callingUserUid = context.auth?.uid;
  if (!callingUserUid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Ação não autorizada. Você precisa estar logado."
    );
  }

  const callingUserRef = db.collection("users").doc(callingUserUid);
  const callingUserSnap = await callingUserRef.get();

  if (!callingUserSnap.exists || callingUserSnap.data()?.role !== "Administrador") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Você não tem permissão para realizar esta ação."
    );
  }

  // 2. Lógica de Exclusão
  const userIdToDelete = data.uid; // Corrigido para 'uid' para corresponder ao frontend
  if (!userIdToDelete) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "O ID do usuário a ser excluído não foi fornecido."
    );
  }
  
  if (callingUserUid === userIdToDelete) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Um administrador não pode se autoexcluir através desta função."
    );
  }

  try {
    // Ação 1: Deletar do Firebase Authentication
    await admin.auth().deleteUser(userIdToDelete);
    console.log(`Usuário ${userIdToDelete} excluído da autenticação com sucesso.`);

    // Ação 2: Deletar do Firestore Database
    await db.collection("users").doc(userIdToDelete).delete();
    console.log(`Documento do usuário ${userIdToDelete} excluído do Firestore com sucesso.`);

    return { success: true, message: "Usuário excluído com sucesso." };

  } catch (error) {
    console.error("Erro ao excluir usuário:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Ocorreu um erro interno ao tentar excluir o usuário."
    );
  }
});
