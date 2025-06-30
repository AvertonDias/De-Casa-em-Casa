import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

export const getCongregationAdmins = functions.https.onCall(
  async (data, context) => {
    // 1. Validar autenticação
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "A requisição precisa ser autenticada.");
    }
    const uid = context.auth.uid;

    try {
      // 2. Buscar o usuário que fez a chamada
      const userDoc = await db.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", `Usuário com UID ${uid} não encontrado.`);
      }
      const userData = userDoc.data()!;
      
      if (!userData.congregationId) {
        throw new functions.https.HttpsError("failed-precondition", "Usuário não pertence a nenhuma congregação.");
      }
      const congregationId = userData.congregationId;

      // --- MUDANÇA: Adicionando logs para depuração ---
      console.log(`Iniciando busca por admins para a congregação: ${congregationId}`);

      // 3. Buscar os administradores da congregação
      const adminsSnapshot = await db
        .collection("users")
        .where("congregationId", "==", congregationId)
        .where("role", "==", "Administrador")
        .where("status", "==", "ativo")
        .get();
        
      // --- MUDANÇA: Log do resultado ---
      console.log(`Consulta finalizada. Encontrados ${adminsSnapshot.size} administradores.`);

      if (adminsSnapshot.empty) {
        // Agora sabemos que a consulta foi executada, mas não encontrou ninguém
        return { admins: [] };
      }

      // 4. Mapear e retornar os dados
      const admins = adminsSnapshot.docs.map((doc) => {
        const adminData = doc.data();
        return {
          name: adminData.name,
          phone: adminData.phone, // Certifique-se de que o campo é 'phone'
        };
      });

      return { admins };
    } catch (error) {
      console.error("Erro ao buscar administradores:", error);
      throw new functions.https.HttpsError("internal", "Ocorreu um erro interno ao buscar os contatos.");
    }
  },
);
