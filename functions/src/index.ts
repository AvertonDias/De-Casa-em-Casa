
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// ============================================================================
//   DEFINIÇÃO DE TIPOS (MUITO IMPORTANTE)
// ============================================================================
interface UserData {
  uid: string;
  email: string;
  displayName: string;
  congregationId: string;
  role: 'Administrador' | 'Dirigente' | 'Publicador' | 'pendente';
  status: 'ativo' | 'inativo' | 'pendente';
  fcmTokens?: string[];
}

// ============================================================================
//   FUNÇÕES DE CRIAÇÃO E GERENCIAMENTO DE USUÁRIOS
// ============================================================================

export const createCongregationAndAdmin = functions.https.onCall(async (data, context) => {
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber } = data;

    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber) {
        throw new functions.https.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
    }

    let newUser;
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
            status: "ativo"
        });

        await batch.commit();

        return { success: true, userId: newUser.uid };

    } catch (error: any) {
        if (newUser) {
            await admin.auth().deleteUser(newUser.uid).catch(deleteError => {
                console.error(`Falha CRÍTICA ao limpar usuário órfão '${newUser.uid}':`, deleteError);
            });
        }
        
        console.error("Erro ao criar congregação e admin:", error);
        
        if (error.code === 'auth/email-already-exists') {
             throw new functions.https.HttpsError("already-exists", "Este e-mail já está em uso.");
        }
        throw new functions.https.HttpsError("internal", "Ocorreu um erro interno ao processar a criação.");
    }
});

export const notifyAdminOfNewUser = functions.firestore
  .document("users/{userId}")
  .onCreate(async (snapshot, context) => {
    const newUser = snapshot.data() as UserData;
    console.log(`[notifyAdmin] Função acionada para novo usuário: ${newUser.displayName}`);

    if (!newUser || newUser.status !== "pendente" || !newUser.congregationId) {
      console.log("[notifyAdmin] Usuário não está pendente ou não tem congregação. Nenhuma notificação será enviada.");
      return null;
    }

    try {
      const adminsSnapshot = await admin.firestore().collection("users")
        .where("congregationId", "==", newUser.congregationId)
        .where("role", "==", "Administrador")
        .get();

      if (adminsSnapshot.empty) {
        console.warn(`[notifyAdmin] Nenhum administrador encontrado para a congregação ${newUser.congregationId}.`);
        return null;
      }
      
      console.log(`[notifyAdmin] Encontrados ${adminsSnapshot.size} administradores para notificar.`);

      const tokens: string[] = [];
      adminsSnapshot.forEach(adminDoc => {
        const adminData = adminDoc.data() as UserData;
        if (adminData.fcmTokens && Array.isArray(adminData.fcmTokens)) {
          tokens.push(...adminData.fcmTokens);
        }
      });
      
      if (tokens.length === 0) {
        console.warn("[notifyAdmin] Administradores encontrados, mas nenhum possui token FCM para receber notificações.");
        return null;
      }
      
      console.log(`[notifyAdmin] Enviando notificação para ${tokens.length} dispositivo(s).`);

      const payload = {
        notification: {
          title: "Novo Usuário Aguardando Aprovação!",
          body: `O usuário "${newUser.displayName}" se cadastrou e precisa de sua aprovação.`,
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

export const deleteUserAccount = functions.https.onCall(async (data, context) => {
  // 1. Verifica se quem está chamando é um usuário autenticado
  const callingUserUid = context.auth?.uid;
  if (!callingUserUid) {
    throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada. Requer autenticação.");
  }

  // 2. Valida o input: precisa do UID do usuário a ser excluído
  const userIdToDelete = data.uid;
  if (!userIdToDelete || typeof userIdToDelete !== 'string') {
    throw new functions.https.HttpsError("invalid-argument", "O ID do usuário a ser excluído não foi fornecido.");
  }

  // 3. Pega os dados do usuário que está fazendo a chamada para verificar as permissões
  const callingUserDoc = await db.collection("users").doc(callingUserUid).get();
  const callingUserData = callingUserDoc.data();
  
  // 4. Regra de permissão: só permite se for um Admin
  if (!callingUserData || callingUserData.role !== "Administrador") {
    throw new functions.https.HttpsError("permission-denied", "Apenas administradores podem excluir usuários.");
  }
  
  // 5. Regra de segurança: um admin não pode se auto-excluir
  if (callingUserUid === userIdToDelete) {
    throw new functions.https.HttpsError("permission-denied", "Um administrador não pode se autoexcluir.");
  }

  try {
    // 6. Executa a exclusão no Firebase Authentication
    await admin.auth().deleteUser(userIdToDelete);
    console.log(`[Delete] Usuário ${userIdToDelete} excluído da Autenticação com sucesso.`);

    // 7. Executa a exclusão do documento no Firestore
    const userDocRef = db.collection("users").doc(userIdToDelete);
    await userDocRef.delete();
    console.log(`[Delete] Documento do usuário ${userIdToDelete} excluído do Firestore com sucesso.`);

    return { success: true, message: `Usuário ${userIdToDelete} excluído com sucesso.` };

  } catch (error: any) {
    console.error(`[Delete] FALHA CRÍTICA ao tentar excluir o usuário ${userIdToDelete}:`, error);
    
    // Se o usuário não foi encontrado na Auth (talvez já tenha sido excluído),
    // ainda tenta apagar o documento do Firestore como uma limpeza final.
    if (error.code === 'auth/user-not-found') {
      const userDocRef = db.collection("users").doc(userIdToDelete);
      if ((await userDocRef.get()).exists) {
        await userDocRef.delete();
        console.log(`[Delete] Limpeza: Documento do usuário órfão ${userIdToDelete} excluído do Firestore.`);
      }
      return { success: true, message: "Usuário não encontrado na autenticação, mas documento do Firestore limpo." };
    }
    
    throw new functions.https.HttpsError("internal", `Falha na exclusão: ${error.message}`);
  }
});


// ============================================================================
//   FUNÇÕES DE CÁLCULO DE ESTATÍSTICAS
// ============================================================================
export const onHouseWrite = functions.firestore
  .document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}")
  .onWrite(async (change, context) => {
    
    const { congregationId, territoryId, quadraId, casaId } = context.params;
    const quadraRef = db.doc(`congregations/${congregationId}/territories/${territoryId}/quadras/${quadraId}`);
    
    // ATUALIZAÇÃO DE ESTATÍSTICAS DA QUADRA
    try {
      const casasSnapshot = await quadraRef.collection("casas").get();
      const totalHouses = casasSnapshot.size;
      const housesDone = casasSnapshot.docs.filter(doc => doc.data().status === true).length;
      await quadraRef.update({ totalHouses, housesDone, lastUpdate: admin.firestore.FieldValue.serverTimestamp() });
      console.log(`[Stats] Sucesso ao atualizar quadra ${quadraId}`);
    } catch (error) {
      console.error(`[Stats] FALHA ao atualizar quadra ${quadraId}:`, error);
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
      const stats = {
          totalHouses,
          housesDone,
          casasPendentes: totalHouses - housesDone,
          casasFeitas: housesDone,
      };
      
      await territoryRef.update({ 
          stats,
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
                totalHouses += doc.data().stats?.totalHouses || 0;
                totalHousesDone += doc.data().stats?.housesDone || 0;
            });
            
            await congregationRef.update({ 
                territoryCount, 
                ruralTerritoryCount,
                totalQuadras,
                totalHouses, 
                totalHousesDone,
                lastUpdate: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[onTerritoryWrite] Sucesso ao atualizar a congregação.`);
        } catch(error) {
            console.error(`[onTerritoryWrite] FALHA ao atualizar congregação ${congregationId}:`, error);
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
            return { success: true, message: "Nenhuma casa para limpar." };
        }
        
        const batch = db.batch();
        let housesUpdatedCount = 0;

        for (const quadraDoc of quadrasSnapshot.docs) {
            const casasSnapshot = await quadraDoc.ref.collection("casas").where('status', '==', true).get();
            
            if(casasSnapshot.empty) continue;
            
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

export const scheduledFirestoreExport = functions
  .pubsub.schedule("every day 03:00") 
  .timeZone("America/Sao_Paulo")
  .onRun(async (context) => {
  
    const firestore = require("@google-cloud/firestore");
    const client = new firestore.v1.FirestoreAdminClient();
    
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    if (!projectId) {
      throw new Error("ID do Projeto Google Cloud não encontrado.");
    }

    const databaseName = client.databasePath(projectId, "(default)");
    const bucketName = "gs://appterritorios-e5bb5.appspot.com"; 
    const timestamp = new Date().toISOString().split('T')[0];
    
    const outputUriPrefix = `${bucketName}/backups/${timestamp}`;
    
    console.log(`[Backup] Iniciando exportação para: ${outputUriPrefix}`);

    try {
      await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: outputUriPrefix,
        collectionIds: [],
      });
      console.log(`[Backup] SUCESSO: Operação de exportação iniciada com sucesso.`);
      return null;

    } catch (error) {
      console.error("[Backup] FALHA CRÍTICA:", error);
      throw new functions.https.HttpsError("internal", "A operação de exportação falhou.", error as any);
    }
});

// ============================================================================
//   NOVA FUNÇÃO PARA HISTÓRICO AUTOMÁTICO
// ============================================================================
export const onTerritoryUpdateForHistory = functions.firestore
  .document("congregations/{congId}/territories/{terrId}")
  .onUpdate(async (change, context) => {
    const { terrId } = context.params;
    const dataBefore = change.before.data();
    const dataAfter = change.after.data();

    // Verificamos se o campo 'stats' existe em ambos os documentos
    if (!dataBefore?.stats || !dataAfter?.stats) {
      console.log(`Função de histórico ignorada para ${terrId}: campo 'stats' não encontrado.`);
      return null;
    }
    
    const statsBefore = dataBefore.stats;
    const statsAfter = dataAfter.stats;

    // Se as estatísticas não mudaram, não faz nada
    if (JSON.stringify(statsBefore) === JSON.stringify(statsAfter)) {
      return null;
    }

    const territoryRef = change.after.ref;
    const historyCollectionRef = territoryRef.collection("activityHistory");

    // LÓGICA 1: Detectar INÍCIO do trabalho
    // Se o número de casas feitas era 0 e agora é maior que 0.
    if (statsBefore.casasFeitas === 0 && statsAfter.casasFeitas > 0) {
      console.log(`Registrando INÍCIO do trabalho para o território ${terrId}.`);
      return historyCollectionRef.add({
        activityDate: admin.firestore.FieldValue.serverTimestamp(),
        notes: "O trabalho no território foi iniciado (registro automático).",
        userName: "Sistema",
        userId: "system",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // LÓGICA 2: Detectar CONCLUSÃO do trabalho
    // Se o número de casas pendentes era maior que 0 e agora é 0.
    if (statsBefore.casasPendentes > 0 && statsAfter.casasPendentes === 0) {
       console.log(`Registrando CONCLUSÃO do trabalho para o território ${terrId}.`);
       return historyCollectionRef.add({
        activityDate: admin.firestore.FieldValue.serverTimestamp(),
        notes: "Todas as casas do território foram trabalhadas (registro automático).",
        userName: "Sistema",
        userId: "system",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return null;
  });

// ============================================================================
//   FUNÇÃO PARA GERAR URL DE UPLOAD ASSINADA
// ============================================================================
export const generateUploadUrl = functions.region("southamerica-east1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Ação não autorizada.');
    }
    
    const filePath = data.filePath;
    if (!filePath || typeof filePath !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'O nome do arquivo é necessário.');
    }

    const options: admin.storage.GetSignedUrlConfig = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // Link válido por 15 minutos
        contentType: data.contentType,
    };

    try {
        const [url] = await admin.storage().bucket().file(filePath).getSignedUrl(options);
        return { url };
    } catch (error) {
        console.error("Erro ao gerar a URL assinada:", error);
        throw new functions.https.HttpsError('internal', 'Não foi possível criar a URL de upload.');
    }
});


// ============================================================================
//   FUNÇÕES DE PRESENÇA E PICO DE USUÁRIOS
// ============================================================================
export const updatePeakOnlineUsers = functions.database.ref('/status/{uid}')
  .onWrite(async (change, context) => {
    const statusRef = change.after.ref.parent;
    if (!statusRef) return null;

    const userDocSnap = await db.doc(`users/${context.params.uid}`).get();
    if (!userDocSnap.exists) return null;
    const congregationId = userDocSnap.data()?.congregationId;
    if (!congregationId) return null;

    const congregationRef = db.doc(`congregations/${congregationId}`);
    
    const onlineUsersSnapshot = await statusRef.orderByChild('state').equalTo('online').once('value');
    const currentOnlineCount = onlineUsersSnapshot.numChildren();

    const congregationDoc = await congregationRef.get();
    const peakData = congregationDoc.data()?.peakOnlineUsers || { count: 0 };
    
    if (currentOnlineCount > peakData.count) {
      console.log(`[PeakUsers] Novo pico de ${currentOnlineCount} usuários na congregação ${congregationId}.`);
      return congregationRef.update({
        peakOnlineUsers: {
          count: currentOnlineCount,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        }
      });
    }
    
    return null;
});

export const resetPeakUsers = functions.https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) { throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada."); }

    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (adminUserSnap.data()?.role !== "Administrador") {
        throw new functions.https.HttpsError("permission-denied", "Ação restrita a administradores.");
    }
    
    const { congregationId } = data;
    if (!congregationId) {
        throw new functions.https.HttpsError("invalid-argument", "ID da congregação é necessário.");
    }

    try {
        const congregationRef = db.doc(`congregations/${congregationId}`);
        await congregationRef.update({
            peakOnlineUsers: {
                count: 0,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            }
        });
        console.log(`[PeakUsers] Pico de usuários resetado para a congregação ${congregationId} pelo admin ${uid}.`);
        return { success: true, message: "Pico de usuários online resetado com sucesso." };
    } catch (error) {
        console.error("Falha ao resetar o pico de usuários:", error);
        throw new functions.https.HttpsError("internal", "Não foi possível resetar a estatística.");
    }
});

// ▼▼▼ FUNÇÃO DE PRESENÇA FINAL E ROBUSTA ▼▼▼
export const onUserStatusChanged = functions.database.ref('/status/{uid}')
  .onWrite(async (change, context) => {
    
    // Pega os dados do evento DEPOIS da mudança.
    const eventStatus = change.after.val();
    const firestoreUserRef = db.doc(`users/${context.params.uid}`);

    // Cenário 1: O usuário ficou OFFLINE.
    // O nó de status no RTDB foi apagado ou definido como 'offline'.
    // `eventStatus` será nulo ou o estado será 'offline'.
    if (!eventStatus || eventStatus.state === 'offline') {
      try {
        // Marca o usuário como offline e atualiza o "visto por último".
        await firestoreUserRef.update({
          isOnline: false,
          lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[Presence] Usuário ${context.params.uid} marcado como OFFLINE.`);
      } catch (error) {
        // Ignora o erro se o documento do usuário não for encontrado (pode ter sido excluído).
        if ((error as any).code !== 'not-found') {
          console.error(`Falha ao marcar usuário ${context.params.uid} como offline:`, error);
        }
      }
      return;
    }
    
    // Cenário 2: O usuário ficou ONLINE.
    // O nó de status foi criado ou atualizado com o estado 'online'.
    try {
      await firestoreUserRef.update({
        isOnline: true,
        lastSeen: eventStatus.last_changed, // Usa o timestamp que veio do RTDB
      });
      console.log(`[Presence] Status do usuário ${context.params.uid} atualizado para ONLINE.`);
    } catch (error) {
       if ((error as any).code !== 'not-found') {
          console.error(`Falha ao atualizar presença para usuário ${context.params.uid}:`, error);
        }
    }
  });
