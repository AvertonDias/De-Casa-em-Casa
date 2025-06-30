import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// Precisamos usar uma função "onCall" que é segura e lida com CORS automaticamente.
export const getCongregationAdmins = functions.https.onCall(
  async (data, context) => {
    // 1. Garante que o usuário que está chamando está autenticado.
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "A requisição precisa ser autenticada.",
      );
    }

    const uid = context.auth.uid;

    try {
      // 2. Busca o documento do usuário que fez a chamada para pegar seu congregationId.
      const userDoc = await db.collection("users").doc(uid).get();
      const userData = userDoc.data();

      if (!userData || !userData.congregationId) {
        throw new functions.https.HttpsError(
          "not-found",
          "Usuário ou congregação não encontrados.",
        );
      }

      const congregationId = userData.congregationId;

      // 3. Busca todos os usuários que são Admins naquela mesma congregação.
      const adminsSnapshot = await db
        .collection("users")
        .where("congregationId", "==", congregationId)
        .where("role", "==", "Administrador")
        .where("status", "==", "ativo")
        .get();

      if (adminsSnapshot.empty) {
        throw new functions.https.HttpsError(
          "not-found",
          "Nenhum administrador ativo encontrado para esta congregação.",
        );
      }

      // 4. Retorna apenas os dados necessários (Nome e Telefone) para o cliente.
      const admins = adminsSnapshot.docs.map((doc) => {
        const adminData = doc.data();
        return {
          name: adminData.name,
          phone: adminData.phone, // Assumindo que o campo se chama 'phone'
        };
      });

      return {admins};
    } catch (error) {
      console.error("Erro ao buscar administradores:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Ocorreu um erro interno.",
      );
    }
  },
);