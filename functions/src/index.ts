import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

export const deleteUserAccount = functions.https.onCall(
  async (data, context) => {
    // 1. Validação: Garante que um usuário autenticado está fazendo a chamada.
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Você precisa estar logado para fazer isso.");
    }

    const callingUid = context.auth.uid; // UID de quem está chamando
    const uidToDelete = data.uid;       // UID de quem será deletado (vem do front-end)

    if (!uidToDelete) {
        throw new functions.https.HttpsError("invalid-argument", "O UID do usuário a ser deletado é obrigatório.");
    }
    
    try {
        const callingUserDoc = await db.collection("users").doc(callingUid).get();
        const callingUserData = callingUserDoc.data();
        
        if (!callingUserData) {
            throw new functions.https.HttpsError("not-found", "Usuário que fez a chamada não encontrado.");
        }

        // 2. Lógica de Permissão
        const isSelfDelete = callingUid === uidToDelete;
        const isAdminDeleting = callingUserData.role === 'Administrador';

        if (!isSelfDelete && !isAdminDeleting) {
            throw new functions.https.HttpsError("permission-denied", "Você não tem permissão para excluir este usuário.");
        }
        
        // Se um admin tentar deletar a si mesmo através deste fluxo, negue.
        if(isSelfDelete && callingUserData.role === 'Administrador') {
             throw new functions.https.HttpsError("permission-denied", "Um administrador não pode se autoexcluir.");
        }

        // 3. Execução da Exclusão
        // Primeiro, deleta o usuário da Authentication. Isso irá disparar o logout no cliente.
        await admin.auth().deleteUser(uidToDelete);
        
        // Em seguida, deleta o documento do Firestore.
        await db.collection("users").doc(uidToDelete).delete();

        console.log(`Usuário ${uidToDelete} excluído com sucesso por ${callingUid}.`);
        return { success: true, message: "Usuário excluído com sucesso." };

    } catch (error) {
        console.error("Erro ao excluir usuário:", error);
        throw new functions.https.HttpsError("internal", "Ocorreu um erro interno ao excluir o usuário.");
    }
  },
);


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
