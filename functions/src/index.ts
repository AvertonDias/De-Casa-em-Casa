// functions/src/index.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import type { GetSignedUrlConfig } from "@google-cloud/storage";

admin.initializeApp();
const db = admin.firestore();

// ========================================================================
//   FUNÇÕES HTTPS (onCall e onRequest)
// ========================================================================
export const createCongregationAndAdmin = functions.https.onCall(async (data, context) => {
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber } = data;
    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber) {
        throw new functions.https.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
    }
    let newUser: admin.auth.UserRecord | undefined;
    try {
        newUser = await admin.auth().createUser({ email: adminEmail, password: adminPassword, displayName: adminName });
        const batch = db.batch();
        const newCongregationRef = db.collection('congregations').doc();
        batch.set(newCongregationRef, { name: congregationName, number: congregationNumber, territoryCount: 0, ruralTerritoryCount: 0, totalQuadras: 0, totalHouses: 0, totalHousesDone: 0, createdAt: admin.firestore.FieldValue.serverTimestamp(), lastUpdate: admin.firestore.FieldValue.serverTimestamp() });
        const userDocRef = db.collection("users").doc(newUser.uid);
        batch.set(userDocRef, { name: adminName, email: adminEmail, congregationId: newCongregationRef.id, role: "Administrador", status: "ativo" });
        await batch.commit();
        return { success: true, userId: newUser.uid };
    } catch (error: any) {
        if (newUser) { await admin.auth().deleteUser(newUser.uid).catch(deleteError => { console.error(`Falha CRÍTICA ao limpar usuário órfão '${newUser!.uid}':`, deleteError); }); }
        console.error("Erro ao criar congregação e admin:", error);
        if (error.code === 'auth/email-already-exists') { throw new functions.https.HttpsError("already-exists", "Este e-mail já está em uso."); }
        throw new functions.https.HttpsError("internal", "Ocorreu um erro interno.");
    }
});

export const deleteUserAccount = functions.https.onCall(async (data, context) => {
  const callingUserUid = context.auth?.uid;
  if (!callingUserUid) {
    throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada.");
  }
  const userIdToDelete = data.uid;
  if (!userIdToDelete || typeof userIdToDelete !== 'string') {
    throw new functions.https.HttpsError("invalid-argument", "ID inválido.");
  }
  const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
  const isAdmin = callingUserSnap.exists && callingUserSnap.data()?.role === "Administrador";
  if (!isAdmin && callingUserUid !== userIdToDelete) {
      throw new functions.https.HttpsError("permission-denied", "Sem permissão.");
  }
  if (isAdmin && callingUserUid === userIdToDelete) {
    throw new functions.https.HttpsError("permission-denied", "Admin não pode se autoexcluir.");
  }
  try {
    await admin.auth().deleteUser(userIdToDelete);
    const userDocRef = db.collection("users").doc(userIdToDelete);
    if ((await userDocRef.get()).exists) {
        await userDocRef.delete();
    }
    return { success: true, message: "Operação de exclusão concluída." };
  } catch (error: any) {
    console.error("Erro CRÍTICO ao excluir usuário:", error);
    if (error.code === 'auth/user-not-found') {
        const userDocRef = db.collection("users").doc(userIdToDelete);
        if ((await userDocRef.get()).exists) {
            await userDocRef.delete();
        }
        return { success: true, message: "Usuário não encontrado na Auth, mas removido do Firestore." };
    }
    throw new functions.https.HttpsError("internal", `Falha na exclusão: ${error.message}`);
  }
});

export const resetTerritoryProgress = functions.https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) { throw new functions.https.HttpsError("unauthenticated", "Ação não autorizada."); }

    const { congregationId, territoryId } = data;
    if (!congregationId || !territoryId) { throw new functions.https.HttpsError("invalid-argument", "IDs faltando."); }

    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (adminUserSnap.data()?.role !== "Administrador") {
        throw new functions.https.HttpsError("permission-denied", "Ação restrita a administradores.");
    }

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
            casasSnapshot.forEach(casaDoc => {
                batch.update(casaDoc.ref, { status: false });
                housesUpdatedCount++;
            });
        }

        if (housesUpdatedCount > 0) {
            await batch.commit();
            const historyPath = `congregations/${congregationId}/territories/${territoryId}/activityHistory`;
            // Deleta a subcoleção de histórico de forma recursiva.
            await admin.firestore().recursiveDelete(db.collection(historyPath));
            return { success: true, message: `Sucesso! ${housesUpdatedCount} casas no território foram resetadas.` };
        } else {
            return { success: true, message: "Nenhuma alteração necessária." };
        }

    } catch (error) {
        console.error(`[resetTerritory] FALHA CRÍTICA ao limpar o território ${territoryId}:`, error);
        throw new functions.https.HttpsError("internal", "Falha ao processar a limpeza.");
    }
});


export const generateUploadUrl = functions.region("southamerica-east1").https.onCall(async (data, context) => {
    if (!context.auth) { throw new functions.https.HttpsError('unauthenticated', 'Ação não autorizada.'); }
    const filePath = data.filePath;
    if (!filePath || typeof filePath !== 'string') { throw new functions.https.HttpsError('invalid-argument', 'O nome do arquivo é necessário.'); }
    
    // A tipagem correta agora vem da importação no topo do arquivo.
    const options: GetSignedUrlConfig = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutos
        contentType: data.contentType,
    };
    try {
        const [url] = await admin.storage().bucket().file(filePath).getSignedUrl(options);
        return { url };
    } catch (error) {
        console.error("Erro ao gerar URL assinada:", error);
        throw new functions.https.HttpsError('internal', 'Falha ao criar URL.');
    }
});


// ========================================================================
//   CASCATA DE ESTATÍSTICAS E LÓGICA DE NEGÓCIO
// ========================================================================

// FUNÇÃO 1: Acionada quando uma CASA muda.
export const onHouseChange = functions.firestore
  .document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}")
  .onWrite(async (change, context) => {
    
    // ATUALIZA AS ESTATÍSTICAS DA QUADRA
    const quadraRef = change.after.ref.parent.parent!;
    const casasSnapshot = await quadraRef.collection("casas").get();
    await quadraRef.update({
        totalHouses: casasSnapshot.size,
        housesDone: casasSnapshot.docs.filter(doc => doc.data().status === true).length
    });

    // ▼▼▼ A LÓGICA DE HISTÓRICO COMEÇA AQUI ▼▼▼
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Condição: Só continua se o status mudou de 'false' para 'true'.
    if (beforeData?.status === false && afterData?.status === true) {
        const { congregationId, territoryId } = context.params;
        const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
        const historyRef = territoryRef.collection("activityHistory");

        // Atualiza a data do último trabalho (para a lista de "Recentemente Trabalhados")
        await territoryRef.update({ lastUpdate: admin.firestore.FieldValue.serverTimestamp() });
        
        // Adiciona ao histórico apenas uma vez por dia
        const TIME_ZONE = "America/Sao_Paulo";
        const todayString = new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
        
        const lastHistorySnap = await historyRef.orderBy("activityDate", "desc").limit(1).get();
        
        // Se não há histórico ou o último registro não é de hoje, cria um novo.
        if (lastHistorySnap.empty || lastHistorySnap.docs[0].data().activityDate.toDate().toLocaleDateString("en-CA", {timeZone: TIME_ZONE}) !== todayString) {
            return historyRef.add({
              activityDate: admin.firestore.FieldValue.serverTimestamp(),
              notes: "Primeiro trabalho do dia registrado. (Registro Automático)",
              userName: "Sistema",
              userId: "system",
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
    
    return null; // Encerra a função se a condição não for atendida
});

// FUNÇÃO 2: Acionada quando uma QUADRA muda (para atualizar o território)
export const onQuadraChange = functions.firestore
  .document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}")
  .onWrite(async (change, context) => {
    const { congregationId, territoryId } = context.params;
    const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
    
    const quadrasSnapshot = await territoryRef.collection("quadras").get();
    
    let totalHouses = 0;
    let housesDone = 0;
    quadrasSnapshot.forEach(doc => {
      totalHouses += doc.data().totalHouses || 0;
      housesDone += doc.data().housesDone || 0;
    });

    const progress = totalHouses > 0 ? (housesDone / totalHouses) : 0;
    
    // Esta escrita irá acionar a onTerritoryChange
    return territoryRef.update({
        stats: { totalHouses, housesDone },
        progress,
        quadraCount: quadrasSnapshot.size,
    });
});

// FUNÇÃO 3: Acionada quando um TERRITÓRIO muda (para atualizar a congregação)
export const onTerritoryChange = functions.firestore
    .document("congregations/{congregationId}/territories/{territoryId}")
    .onWrite(async (change, context) => {
        const { congregationId } = context.params;
        const congregationRef = db.doc(`congregations/${congregationId}`);
        const territoriesRef = congregationRef.collection("territories");
        
        const territoriesSnapshot = await territoriesRef.get();
        let urbanCount = 0, ruralCount = 0, totalHouses = 0, totalHousesDone = 0, totalQuadras = 0;
        territoriesSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.type === 'rural') { ruralCount++; }
            else {
                urbanCount++;
                totalHouses += data.stats?.totalHouses || 0;
                totalHousesDone += data.stats?.housesDone || 0;
                totalQuadras += data.quadraCount || 0;
            }
        });
        
        return congregationRef.update({
            territoryCount: urbanCount,
            ruralTerritoryCount: ruralCount,
            totalQuadras, totalHouses, totalHousesDone,
            lastUpdate: admin.firestore.FieldValue.serverTimestamp()
        });
    });


// ============================================================================
//   OUTROS GATILHOS (Notificação, Exclusão)
// ============================================================================
export const onTerritoryAssigned = functions.firestore
  .document("congregations/{congId}/territories/{terrId}")
  .onUpdate(async (change, context) => {
    
    // Pega os dados do território ANTES e DEPOIS da mudança
    const dataBefore = change.before.data();
    const dataAfter = change.after.data();

    // Condição para rodar: só continua se a designação mudou e existe uma nova.
    if (!dataAfter.assignment || dataBefore.assignment?.uid === dataAfter.assignment?.uid) {
        return null;
    }
    
    const assignedUserUid = dataAfter.assignment.uid;
    const territoryName = dataAfter.name;
    const dueDate = (dataAfter.assignment.dueDate as admin.firestore.Timestamp).toDate();
    
    // Formata a data para a notificação
    const formattedDueDate = dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    console.log(`[Notification] Enviando notificação de designação para o usuário ${assignedUserUid}...`);

    try {
        // Busca o documento do usuário para pegar seus tokens de notificação
        const userDoc = await db.collection("users").doc(assignedUserUid).get();
        if (!userDoc.exists) {
            console.error(`[Notification] Usuário ${assignedUserUid} não encontrado.`);
            return null;
        }

        const tokens = userDoc.data()?.fcmTokens;
        if (!tokens || tokens.length === 0) {
            console.log(`[Notification] Usuário ${assignedUserUid} não possui tokens FCM para notificar.`);
            return null;
        }

        // Prepara e envia a mensagem
        const payload = {
            notification: {
                title: "Você recebeu um novo território!",
                body: `O território \"${territoryName}\" está sob sua responsabilidade. Devolver até ${formattedDueDate}.`,
                icon: "/icon-192x192.png",
                click_action: "/dashboard/meus-territorios", // Leva o usuário para a nova página
            },
        };

        await admin.messaging().sendToDevice(tokens, payload);
        console.log(`[Notification] Notificação enviada com sucesso para ${assignedUserUid}.`);
        return { success: true };

    } catch (error) {
        console.error(`[Notification] FALHA CRÍTICA ao enviar notificação:`, error);
        return { success: false, error };
    }
  });


export const notifyAdminOfNewUser = functions.firestore.document("users/{userId}").onCreate(async (snapshot, context) => {
    const newUser = snapshot.data();
    if (!newUser || newUser.status !== "pendente" || !newUser.congregationId) {
        return null;
    }
    const adminsSnapshot = await db.collection("users")
        .where("congregationId", "==", newUser.congregationId)
        .where("role", "in", ["Administrador", "Dirigente"])
        .get();
    if (adminsSnapshot.empty) return null;
    const tokens: string[] = [];
    adminsSnapshot.forEach(adminDoc => {
        const adminData = adminDoc.data();
        if (adminData.fcmTokens && Array.isArray(adminData.fcmTokens)) {
            tokens.push(...adminData.fcmTokens);
        }
    });
    if (tokens.length === 0) return null;
    const payload = {
        notification: {
            title: "Novo Usuário Aguardando Aprovação!",
            body: `O usuário "${newUser.name}" se cadastrou e precisa de sua aprovação.`,
            icon: "/icon-192x192.png",
            click_action: "/dashboard/usuarios",
        },
    };
    try {
        await admin.messaging().sendToDevice(tokens, payload);
        return { success: true };
    } catch (error) {
        console.error("[notifyAdmin] FALHA CRÍTICA:", error);
        return null;
    }
});


export const onDeleteTerritory = functions.firestore.document("congregations/{congregationId}/territories/{territoryId}").onDelete((snap) => {
    return admin.firestore().recursiveDelete(snap.ref);
});

export const onDeleteQuadra = functions.firestore.document("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}").onDelete((snap) => {
    return admin.firestore().recursiveDelete(snap.ref);
});

export const scheduledFirestoreExport = functions.pubsub.schedule("every day 03:00").timeZone("America/Sao_Paulo").onRun(async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const firestore = require("@google-cloud/firestore");
    const client = new firestore.v1.FirestoreAdminClient();
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    if (!projectId) { throw new Error("ID do Projeto Google Cloud não encontrado."); }
    const databaseName = client.databasePath(projectId, "(default)");
    const bucketName = `gs://${projectId}.appspot.com`;
    const timestamp = new Date().toISOString().split('T')[0];
    const outputUriPrefix = `${bucketName}/backups/${timestamp}`;
    try {
        await client.exportDocuments({
            name: databaseName,
            outputUriPrefix: outputUriPrefix,
            collectionIds: [],
        });
        console.log(`Backup do Firestore concluído para ${outputUriPrefix}`);
        return null;
    } catch (error) {
        console.error("[Backup] FALHA CRÍTICA:", error);
        throw new functions.https.HttpsError("internal", "A operação de exportação falhou.", error);
    }
});

// ============================================================================
//   SISTEMA DE PRESENÇA (RTDB -> FIRESTORE)
// ============================================================================
export const mirrorUserStatus = functions.database
  .ref("/status/{uid}")
  .onWrite(async (change, context) => { // onWrite detecta tanto set quanto remove
    const eventStatus = change.after.val(); // Dados APÓS a mudança
    const uid = context.params.uid;
    const userDocRef = admin.firestore().doc(`users/${uid}`);

    // Se o nó foi deletado OU o estado é 'offline'
    if (!eventStatus || eventStatus.state === 'offline') {
        return userDocRef.update({
            isOnline: false,
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(err => {
            if (err.code !== 'not-found') console.error(`[Presence Mirror] Falha ao marcar OFFLINE para ${uid}:`, err);
        });
    } 
    // Se o estado é 'online'
    else if (eventStatus.state === 'online') {
        return userDocRef.update({
            isOnline: true,
            lastSeen: admin.firestore.FieldValue.serverTimestamp(), // Usa timestamp do servidor
        }).catch(err => {
            if (err.code !== 'not-found') console.error(`[Presence Mirror] Falha ao marcar ONLINE para ${uid}:`, err);
        });
    }
    return null;
  });

// ▼▼▼ FUNÇÃO sendFeedbackEmail COM onCall (CORRETA) ▼▼▼
export const sendFeedbackEmail = functions.https.onCall(async (data, context) => {
    // 1. Validação de Autenticação (onCall já faz isso, mas podemos adicionar mais)
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "O usuário deve estar autenticado para enviar feedback.");
    }
    
    try {
        // 2. Validação dos dados de entrada
        const { name, email, subject, message } = data;
        if (!name || !email || !subject || !message) {
            throw new functions.https.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
        }
        
        // 3. Lógica de envio de e-mail (simulada)
        console.log('--- NOVO FEEDBACK RECEBIDO ---');
        console.log(`De: ${name} (${email})`);
        console.log(`UID: ${context.auth.uid}`); // Podemos logar o UID para referência
        console.log(`Assunto: ${subject}`);
        console.log(`Mensagem: ${message}`);
        console.log('------------------------------');

        // 4. Retorna sucesso
        return { success: true, message: 'Feedback enviado com sucesso!' };

    } catch (error: any) {
        console.error("Erro ao processar feedback:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError("internal", "Erro interno do servidor ao processar o feedback.");
    }
});
