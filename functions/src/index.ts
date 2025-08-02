
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();
// ============================================================================
//   DEFINIÇÃO DE TIPOS
// ============================================================================

interface CreateCongregationData {
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    congregationName: string;
    congregationNumber: string;
}

interface UserData {
    uid: string;
    name: string;
    email: string;
    congregationId: string;
    role: 'Administrador' | 'Dirigente' | 'Publicador' | 'pendente';
    status: 'ativo' | 'inativo' | 'pendente' | 'rejeitado';
    isOnline?: boolean;
    lastSeen?: admin.firestore.Timestamp;
    fcmTokens?: string[];
}

// ============================================================================
//   FUNÇÕES DE CRIAÇÃO E GERENCIAMENTO DE USUÁRIOS
// ============================================================================

export const createCongregationAndAdmin = functions.https.onCall(async (data, context) => {
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber } = data as CreateCongregationData;

    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber) {
        throw new functions.https.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
    }

    let newUser: admin.auth.UserRecord | undefined;
    try {
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
            status: "ativo",
            isOnline: false,      // Adiciona isOnline: false ao criar usuário
            lastSeen: admin.firestore.FieldValue.serverTimestamp(), // Adiciona lastSeen
        });

        await batch.commit();
        return { success: true, userId: newUser.uid };

    } catch (error: any) {
        if (newUser) {
            await admin.auth().deleteUser(newUser.uid).catch(deleteError => {
                console.error(`Falha CRÍTICA ao limpar usuário órfão '${newUser!.uid}':`, deleteError);
            });
        }
        
        console.error("Erro ao criar congregação e admin:", error);
        if (error.code === 'auth/email-already-exists') {
             throw new functions.https.HttpsError("already-exists", "Este e-mail já está em uso.");
        }
        throw new functions.https.HttpsError("internal", "Ocorreu um erro interno ao processar a criação.");
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
//   FUNÇÕES DE GATILHO (TRIGGERS)
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

export const notifyAdminOfNewUser = functions.firestore
  .document("users/{userId}")
  .onCreate(async (snapshot, context) => {
    const newUser = snapshot.data() as UserData;
    console.log(`[notifyAdmin] Função acionada para novo usuário: ${newUser.name}`);

    if (!newUser || newUser.status !== "pendente" || !newUser.congregationId) {
      console.log("[notifyAdmin] Usuário não está pendente ou não tem congregação. Nenhuma notificação será enviada.");
      return null;
    }

    try {
      const adminsSnapshot = await admin.firestore().collection("users")
        .where("congregationId", "==", newUser.congregationId)
        .where("role", "in", ["Administrador", "Dirigente"])
        .get();

      if (adminsSnapshot.empty) {
        console.warn(`[notifyAdmin] Nenhum administrador ou dirigente encontrado para a congregação ${newUser.congregationId}.`);
        return null;
      }
      
      const tokens = adminsSnapshot.docs.flatMap(doc => (doc.data() as UserData).fcmTokens || []);
      
      if (tokens.length === 0) {
        console.warn("[notifyAdmin] Administradores/Dirigentes encontrados, mas nenhum possui token FCM.");
        return null;
      }
      
      console.log(`[notifyAdmin] Enviando notificação para ${tokens.length} dispositivo(s).`);

      const payload = {
        notification: {
          title: "Novo Usuário Aguardando Aprovação!",
          body: `O usuário "${newUser.name}" se cadastrou e precisa de sua aprovação.`,
          icon: "/icon-192x192.png",
          click_action: "/dashboard/usuarios",
        },
      };

      await admin.messaging().sendToDevice(tokens, payload);
      
      console.log("[notifyAdmin] Notificações enviadas com sucesso!");
      return { success: true };

    } catch (error) {
      console.error("[notifyAdmin] FALHA CRÍTICA ao tentar enviar notificação:", error);
      return { success: false, error: error as any };
    }
});

export const mirrorUserStatus = functions.database.ref('/status/{uid}')
  .onWrite(async (change, context) => {
    const eventStatus = change.after.val();
    const firestoreUserRef = db.doc(`users/${context.params.uid}`);
    const isOffline = !eventStatus || eventStatus.state === 'offline';

    try {
      await firestoreUserRef.update({ 
          isOnline: !isOffline, 
          lastSeen: admin.firestore.FieldValue.serverTimestamp() 
      });
    } catch (error) {
      if ((error as any).code !== 'not-found') {
        console.error(`[mirrorUserStatus] Erro ao atualizar presença do usuário ${context.params.uid}:`, error);
      }
    }
});


export const onDeleteTerritory = functions.firestore
    .document("congregations/{congregationId}/territories/{territoryId}")
    .onDelete((snap) => admin.firestore().recursiveDelete(snap.ref));

export const onDeleteQuadra = functions.firestore
    .document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}")
    .onDelete((snap) => admin.firestore().recursiveDelete(snap.ref));


export const scheduledFirestoreExport = functions.pubsub.schedule("every day 03:00").timeZone("America/Sao_Paulo").onRun(async (context) => {
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
      console.log(`Backup do Firestore para ${outputUriPrefix} iniciado com sucesso.`);
    } catch (error) { 
        console.error("[Backup] FALHA CRÍTICA:", error); 
        throw new functions.https.HttpsError("internal", "A operação de exportação falhou.", error as any); 
    }
});

    