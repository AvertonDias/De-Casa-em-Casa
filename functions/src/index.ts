
import { https, logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// Função para criar uma nova congregação e seu primeiro administrador
export const createCongregationAndAdmin = https.onCall(async (request) => {
  const {
    adminName,
    adminEmail,
    adminPassword,
    congregationName,
    congregationNumber,
    whatsapp,
  } = request.data;

  if (
    !adminName ||
    !adminEmail ||
    !adminPassword ||
    !congregationName ||
    !congregationNumber ||
    !whatsapp
  ) {
    throw new https.HttpsError(
      "invalid-argument",
      "Todos os campos são obrigatórios.",
    );
  }

  let newUser;
  try {
    const congQuery = await db
      .collection("congregations")
      .where("number", "==", congregationNumber)
      .get();
    if (!congQuery.empty) {
      throw new https.HttpsError(
        "already-exists",
        "Uma congregação com este número já existe.",
      );
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
    return {
      success: true,
      userId: newUser.uid,
      message: "Congregação criada com sucesso!",
    };
  } catch (error: any) {
    if (newUser) {
      await admin
        .auth()
        .deleteUser(newUser.uid)
        .catch((deleteError) => {
          logger.error(
            `Falha CRÍTICA ao limpar usuário órfão '${newUser?.uid}':`,
            deleteError,
          );
        });
    }
    if (error.code === "auth/email-already-exists") {
      throw new https.HttpsError(
        "already-exists",
        "Este e-mail já está em uso.",
      );
    }
    logger.error("Erro ao criar congregação e admin:", error);
    throw new https.HttpsError(
      "internal",
      error.message || "Erro interno no servidor",
    );
  }
});


// Função para buscar os contatos dos administradores e dirigentes
export const getManagersForNotification = https.onCall(async (request) => {
    // 1. Autenticação: Garante que o usuário está logado.
    if (!request.auth) {
        throw new https.HttpsError(
            "unauthenticated",
            "O usuário deve estar autenticado para realizar esta ação.",
        );
    }

    const { congregationId } = request.data;
    if (!congregationId) {
        throw new https.HttpsError(
            "invalid-argument",
            "O ID da congregação é obrigatório.",
        );
    }

    try {
        const rolesToFetch = ["Administrador", "Dirigente"];
        const queryPromises = rolesToFetch.map((role) =>
            db
                .collection("users")
                .where("congregationId", "==", congregationId)
                .where("role", "==", role)
                .get(),
        );

        const results = await Promise.all(queryPromises);
        
        const managers = results.flatMap((snapshot) =>
            snapshot.docs.map((doc) => {
                const { name, whatsapp } = doc.data();
                return { uid: doc.id, name, whatsapp };
            }),
        );
        
        // Remove duplicatas caso um usuário seja ambos (improvável, mas seguro)
        const uniqueManagers = Array.from(new Map(managers.map(item => [item['uid'], item])).values());

        return { success: true, managers: uniqueManagers };

    } catch (error) {
        logger.error("Erro ao buscar gerentes:", error);
        throw new https.HttpsError(
            "internal",
            "Falha ao buscar contatos dos responsáveis.",
        );
    }
});
