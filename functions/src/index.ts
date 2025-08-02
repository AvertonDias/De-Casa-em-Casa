import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import type { UserData } from "./types";

admin.initializeApp();

const db = admin.firestore();

// Defina a interface para os dados de entrada
interface CreateCongregationData {
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    congregationName: string;
    congregationNumber: string;
}

export const createCongregationAndAdmin = functions.https.onCall(async (data, context) => {
    // Agora o TypeScript sabe exatamente o que esperar de 'data'
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber } = data as CreateCongregationData;

    // Verificação de autenticação
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'A função requer autenticação.');
    }

    // Validar os dados
    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber) {
        throw new functions.https.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
    }

    let newUser;
    try {
        // Criar o usuário
        newUser = await admin.auth().createUser({
            email: adminEmail,
            password: adminPassword,
            displayName: adminName,
        });

        // Criar a congregação e o usuário no Firestore
        const batch = db.batch();

        const newCongregationRef = db.collection('congregations').doc();
        batch.set(newCongregationRef, {
            name: congregationName,
            number: congregationNumber,
            territoryCount: 0,
            ruralTerritoryCount: 0,
            totalQuadras: 0,
            totalHouses: 0,
            totalHousesDone: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdate: admin.firestore.FieldValue.serverTimestamp()
        });

        const userDocRef = db.collection("users").doc(newUser.uid);
        batch.set(userDocRef, {
            name: adminName,
            email: adminEmail,
            congregationId: newCongregationRef.id,
            role: "Administrador",
            status: "ativo"
        });

        await batch.commit();

        return { success: true, userId: newUser.uid, message: 'Congregação criada com sucesso!' };

    } catch (error: any) {
        // Apaga o usuário se houver falha
        if (newUser) {
            try {
                await admin.auth().deleteUser(newUser.uid);
                console.log(`Usuário órfão ${newUser.uid} excluído.`);
            } catch (deleteError) {
                console.error(`Falha ao limpar usuário órfão '${newUser.uid}':`, deleteError);
            }
        }
        console.error("Erro ao criar congregação e admin:", error);

        // Trate diferentes tipos de erros de maneira mais detalhada
        if (error.code === 'auth/email-already-exists') {
             throw new functions.https.HttpsError("already-exists", "Este e-mail já está em uso.");
        }
        throw new functions.https.HttpsError("internal", "Ocorreu um erro interno ao processar a criação.", error);
    }
});

// ============================================================================
//   FUNÇÕES DE USUÁRIO
// ============================================================================
export const notifyAdminOfNewUser = functions.firestore.document("users/{userId}").onCreate(async (snapshot, context) => {
  // Define o corpo do Payload da Mensagem
  const payload = {
    notification: {
      title: "Novo Usuário Aguardando Aprovação!",
      body: `O usuário "${snapshot.data().name}" se cadastrou e precisa de sua aprovação.`,
      icon: "/icon-192x192.png", // Define o ícone
      click_action: "/dashboard/usuarios", // Define a ação ao clicar
    },
  };

  // Busca os administradores da mesma congregação
  const querySnapshot = await admin.firestore().collection("users")
    .where("congregationId", "==", snapshot.data().congregationId)
    .where("role", "==", "Administrador")
    .get();

  const tokens: string[] = [];
  querySnapshot.forEach(snap => {
    const data = snap.data() as UserData;
    if(data.fcmTokens && Array.isArray(data.fcmTokens)) {
      tokens.push(...data.fcmTokens);
    }
  });

  if (tokens.length > 0) {
    // Envia para todos os tokens encontrados
    const response = await admin.messaging().sendToDevice(tokens, payload);
    console.log("Notificações enviadas com sucesso:", response);
  } else {
    console.warn("Nenhum administrador com token FCM encontrado.");
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

// ============================================================================
//   FUNÇÕES DE LIMPEZA E MANUTENÇÃO
// ============================================================================
export const resetTerritoryProgress = functions.https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) { throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada."); }
    
    const { congregationId, territoryId } = data;
    if (!congregationId || !territoryId) { throw new functions.https.HttpsError("invalid-argument", "IDs faltando."); }
    
    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (adminUserSnap.data()?.role !== "Administrador") {
        throw new functions.https.HttpsError("permission-denied", "Ação restrita a administradores.");
    }
    
    console.log(`[resetTerritory] Iniciado pelo admin ${uid} para o território ${territoryId}`);

    try {
        const quadrasRef = db.collection(`congregations/${congregationId}/territories/${territoryId}/quadras`);
        const quadrasSnapshot = await quadrasRef.get();
        
        if (quadrasSnapshot.empty) {
            console.log("[resetTerritory] Nenhuma quadra encontrada para limpar. Encerrando.");
            return { success: true, message: "Nenhuma casa para limpar." };
        }
        
        const batch = db.batch();
        let housesUpdatedCount = 0;

        for (const quadraDoc of quadrasSnapshot.docs) {
            const casasSnapshot = await quadraDoc.ref.collection("casas").where('status', '==', true).get();
            
            if(casasSnapshot.empty) {
              console.log(`[resetTerritory] Quadra ${quadraDoc.id} não tem casas 'feitas'. Pulando.`);
              continue;
            }
            
            console.log(`[resetTerritory] Encontradas ${casasSnapshot.size} casas 'feitas' na quadra ${quadraDoc.id}.`);
            
            casasSnapshot.forEach(casaDoc => {
                batch.update(casaDoc.ref, { status: false });
                housesUpdatedCount++;
            });
        }
        
        if (housesUpdatedCount > 0) {
            await batch.commit();

            const historyPath = `congregations/${congregationId}/territories/${territoryId}/activityHistory`;
            await admin.firestore().recursiveDelete(db.collection(historyPath));
            console.log(`Histórico de atividade para o território ${territoryId} limpo.`);

            const successMessage = `Sucesso! ${housesUpdatedCount} casas no território foram resetadas.`;
            return { success: true, message: successMessage };
        } else {
            console.log("[resetTerritory] Nenhuma casa precisava ser resetada.");
            return { success: true, message: "Nenhuma alteração necessária." };
        }

    } catch (error) {
        console.error(`[resetTerritory] FALHA CRÍTICA ao limpar o território ${territoryId}:`, error);
        throw new functions.https.HttpsError("internal", "Falha ao processar a limpeza. Verifique os logs.");
    }
});


export const onDeleteTerritory = functions.firestore
    .document("congregations/{congregationId}/territories/{territoryId}")
    .onDelete(async (snap, context) => {
        const territoryPath = snap.ref.path;
        console.log(`Iniciando exclusão em cascata para: ${territoryPath}`);
        
        await admin.firestore().recursiveDelete(snap.ref);
        
        console.log(`Exclusão em cascata para ${territoryPath} concluída.`);
    });

export const onDeleteQuadra = functions.firestore
    .document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}")
    .onDelete(async (snap, context) => {
        const quadraPath = snap.ref.path;
        console.log(`Iniciando exclusão em cascata para a quadra: ${quadraPath}`);

        await admin.firestore().recursiveDelete(snap.ref);
        
        console.log(`Exclusão em cascata para ${quadraPath} concluída.`);
    });

export const scheduledFirestoreExport = functions.pubsub.schedule("every day 03:00")
  .timeZone("America/Sao_Paulo")
  .onRun(async (context) => {
    const firestore = require("@google-cloud/firestore");
    const client = new firestore.v1.FirestoreAdminClient();
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    if (!projectId) throw new Error("ID do Projeto Google Cloud não encontrado.");
    const databaseName = client.databasePath(projectId, "(default)");
    const bucketName = `gs://${process.env.GCLOUD_PROJECT}.appspot.com`;
    const timestamp = new Date().toISOString().split('T')[0];
    const outputUriPrefix = `${bucketName}/backups/${timestamp}`;
    try {
      await client.exportDocuments({ name: databaseName, outputUriPrefix, collectionIds: [] });
    } catch (error) {
      console.error("[Backup] FALHA CRÍTICA:", error);
      throw new functions.https.HttpsError("internal", "A operação de exportação falhou.", error as any);
    }
});

// ============================================================================
//   FUNÇÃO DE PRESENÇA
// ============================================================================
export const handleUserPresence = functions.database.ref('/status/{uid}')
  .onWrite(async (change, context) => {
    const eventStatus = change.after.val();
    const firestoreUserRef = db.doc(`users/${context.params.uid}`);
    const isOffline = !eventStatus || eventStatus.state === 'offline';
    try {
      await firestoreUserRef.update({ isOnline: !isOffline, lastSeen: admin.firestore.FieldValue.serverTimestamp() });
    } catch (error) {
      if ((error as any).code !== 'not-found') {
        console.error(`[handleUserPresence] Erro ao atualizar presença do usuário ${context.params.uid}:`, error);
      }
    }
});