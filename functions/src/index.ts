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
