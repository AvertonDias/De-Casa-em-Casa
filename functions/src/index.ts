
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// ▼▼▼ FUNÇÃO DE NOTIFICAÇÃO ATUALIZADA E MAIS ROBUSTA ▼▼▼

// A função agora é acionada apenas na CRIAÇÃO de um novo usuário.
export const notifyAdminOfNewUser = functions.firestore
  .document("users/{userId}")
  .onCreate(async (snapshot, context) => {
    
    const newUser = snapshot.data();
    console.log(`[notifyAdmin] Função acionada para novo usuário: ${newUser.name}`);

    // 1. Garante que temos todos os dados necessários.
    if (!newUser || newUser.status !== "pendente" || !newUser.congregationId) {
      console.log("[notifyAdmin] Usuário não está pendente ou não tem congregação. Nenhuma notificação será enviada.");
      return null;
    }

    try {
      // 2. Busca todos os administradores da MESMA congregação.
      const adminsSnapshot = await admin.firestore().collection("users")
        .where("congregationId", "==", newUser.congregationId)
        .where("role", "==", "Administrador")
        .get();

      if (adminsSnapshot.empty) {
        console.warn(`[notifyAdmin] Nenhum administrador encontrado para a congregação ${newUser.congregationId}.`);
        return null;
      }
      
      console.log(`[notifyAdmin] Encontrados ${adminsSnapshot.size} administradores para notificar.`);

      // 3. Pega todos os tokens FCM de todos os administradores.
      const tokens: string[] = [];
      adminsSnapshot.forEach(adminDoc => {
        const adminData = adminDoc.data();
        if (adminData.fcmTokens && Array.isArray(adminData.fcmTokens)) {
          tokens.push(...adminData.fcmTokens);
        }
      });
      
      if (tokens.length === 0) {
        console.warn("[notifyAdmin] Administradores encontrados, mas nenhum possui token FCM para receber notificações.");
        return null;
      }
      
      console.log(`[notifyAdmin] Enviando notificação para ${tokens.length} dispositivo(s).`);

      // 4. Prepara e envia a mensagem de notificação.
      const payload = {
        notification: {
          title: "Novo Usuário Aguardando Aprovação!",
          body: `O usuário "${newUser.name}" se cadastrou e precisa de sua aprovação.`,
          icon: "/icon-192x192.png", // Ícone que aparece na notificação
          click_action: "/dashboard/usuarios", // URL que abre ao clicar na notificação
        },
      };

      // Envia para todos os tokens encontrados
      await admin.messaging().sendToDevice(tokens, payload);
      
      console.log("[notifyAdmin] Notificações enviadas com sucesso!");
      return { success: true };

    } catch (error) {
      console.error("[notifyAdmin] FALHA CRÍTICA ao tentar enviar notificação:", error);
      return { success: false, error: error as any };
    }
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
  
  if (isAdmin && callingUserUid === userIdToDelete) {
    throw new functions.https.HttpsError("permission-denied", "Um administrador não pode se autoexcluir através desta função.");
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


// ▼▼▼ FUNÇÕES DE ESTATÍSTICAS ATUALIZADAS COM LOGS PARA DEPURAÇÃO ▼▼▼

export const onHouseWrite = functions.firestore
  .document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}")
  .onWrite(async (change, context) => {
    console.log(`[onHouseWrite] Acionado para a casa: ${context.params.casaId}`);
    
    // Using direct path construction is more robust for creates, updates, and deletes.
    const quadraPath = `congregations/${context.params.congregationId}/territories/${context.params.territoryId}/quadras/${context.params.quadraId}`;
    const quadraRef = db.doc(quadraPath);

    try {
      const casasSnapshot = await quadraRef.collection("casas").get();
      const totalHouses = casasSnapshot.size;
      const housesDone = casasSnapshot.docs.filter(doc => doc.data().status === true).length;
      
      console.log(`[onHouseWrite] Atualizando quadra ${quadraRef.id} com: total=${totalHouses}, done=${housesDone}`);
      await quadraRef.update({ totalHouses, housesDone });
      console.log(`[onHouseWrite] Sucesso ao atualizar a quadra.`);

    } catch(error) {
      console.error(`[onHouseWrite] FALHA ao atualizar quadra ${quadraRef.id}: `, error);
    }
});


export const onQuadraWrite = functions.firestore
  .document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}")
  .onWrite(async (change, context) => {
    console.log(`[onQuadraWrite] Acionado para a quadra: ${context.params.quadraId}`);

    const territoryPath = `congregations/${context.params.congregationId}/territories/${context.params.territoryId}`;
    const territoryRef = db.doc(territoryPath);

    try {
      const quadrasSnapshot = await territoryRef.collection("quadras").get();
      
      const quadraCount = quadrasSnapshot.size;
      let totalHouses = 0;
      let housesDone = 0;
      
      quadrasSnapshot.forEach(doc => {
        totalHouses += doc.data().totalHouses || 0;
        housesDone += doc.data().housesDone || 0;
      });

      const progress = totalHouses > 0 ? (housesDone / totalHouses) : 0;
      
      console.log(`[onQuadraWrite] Atualizando território ${territoryRef.id} com: total=${totalHouses}, done=${housesDone}, quadras=${quadraCount}`);
      await territoryRef.update({ 
          totalHouses, 
          housesDone, 
          progress, 
          quadraCount, 
          lastUpdate: admin.firestore.FieldValue.serverTimestamp() 
      });
      console.log(`[onQuadraWrite] Sucesso ao atualizar o território.`);

    } catch (error) {
      console.error(`[onQuadraWrite] FALHA ao atualizar território ${territoryRef.id}: `, error);
    }
});


export const onTerritoryWrite = functions.firestore
    .document("congregations/{congregationId}/territories/{territoryId}")
    .onWrite(async (change, context) => {
        console.log(`[onTerritoryWrite] Acionado para o território: ${context.params.territoryId}`);
        const { congregationId } = context.params;
        const congregationRef = db.collection("congregations").doc(congregationId);

        try {
            const territoriesRef = congregationRef.collection("territories");
            
            const urbanTerritoriesQuery = territoriesRef.where("type", "in", ["urban", null]);
            const urbanTerritoriesSnapshot = await urbanTerritoriesQuery.get();

            const ruralTerritoriesQuery = territoriesRef.where("type", "==", "rural");
            const ruralTerritoriesSnapshot = await ruralTerritoriesQuery.get();
            
            const territoryCount = urbanTerritoriesSnapshot.size;
            const ruralTerritoryCount = ruralTerritoriesSnapshot.size;

            let totalQuadras = 0;
            let totalHouses = 0;
            let totalHousesDone = 0;

            urbanTerritoriesSnapshot.forEach(doc => {
                totalQuadras += doc.data().quadraCount || 0;
                totalHouses += doc.data().totalHouses || 0;
                totalHousesDone += doc.data().housesDone || 0;
            });
            
            console.log(`[onTerritoryWrite] Atualizando congregação ${congregationId}`);
            await congregationRef.update({ 
                territoryCount, 
                ruralTerritoryCount,
                totalQuadras,
                totalHouses, 
                totalHousesDone 
            });
            console.log(`[onTerritoryWrite] Sucesso ao atualizar a congregação.`);
        } catch(error) {
            console.error(`[onTerritoryWrite] FALHA ao atualizar congregação ${congregationId}:`, error);
        }
    });

// FUNÇÃO DE EXCLUSÃO: Exclusão em Cascata para Territórios
export const onDeleteTerritory = functions.firestore
    .document("congregations/{congregationId}/territories/{territoryId}")
    .onDelete(async (snap, context) => {
        const territoryPath = snap.ref.path;
        console.log(`Iniciando exclusão em cascata para: ${territoryPath}`);
        
        await admin.firestore().recursiveDelete(snap.ref);
        
        console.log(`Exclusão em cascata para ${territoryPath} concluída.`);
    });

// FUNÇÃO DE EXCLUSÃO: Exclusão em Cascata para Quadras
export const onDeleteQuadra = functions.firestore
    .document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}")
    .onDelete(async (snap, context) => {
        const quadraPath = snap.ref.path;
        console.log(`Iniciando exclusão em cascata para a quadra: ${quadraPath}`);

        await admin.firestore().recursiveDelete(snap.ref);
        
        console.log(`Exclusão em cascata para ${quadraPath} concluída.`);
    });
