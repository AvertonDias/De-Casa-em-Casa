
import { https, setGlobalOptions } from "firebase-functions/v2";
import { onDocumentWritten, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import * as admin from "firebase-admin";
import { AppUser, Notification, Territory } from "./types";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
setGlobalOptions({ region: "southamerica-east1" });

// ========================================================================
//   FUNÇÕES CHAMÁVEIS (onCall)
// ========================================================================

export const createCongregationAndAdmin = https.onCall(async (data) => {
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp } = data;

    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
        throw new https.HttpsError('invalid-argument', 'Todos os campos são obrigatórios.');
    }

    let newUser;
    try {
        const congQuery = await db.collection('congregations').where('number', '==', congregationNumber).get();
        if (!congQuery.empty) {
            throw new https.HttpsError('already-exists', 'Uma congregação com este número já existe.');
        }

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
            territoryCount: 0, ruralTerritoryCount: 0, totalQuadras: 0, totalHouses: 0, totalHousesDone: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdate: admin.firestore.FieldValue.serverTimestamp()
        });

        const userDocRef = db.collection("users").doc(newUser.uid);
        batch.set(userDocRef, {
            name: adminName,
            email: adminEmail,
            whatsapp,
            congregationId: newCongregationRef.id,
            role: "Administrador",
            status: "ativo"
        });

        await batch.commit();
        return { success: true, userId: newUser.uid, message: 'Congregação criada com sucesso!' };
    } catch (error: any) {
        if (newUser) {
            await admin.auth().deleteUser(newUser.uid).catch(deleteError => {
                console.error(`Falha CRÍTICA ao limpar usuário órfão '${newUser?.uid}':`, deleteError);
            });
        }
        console.error("Erro ao criar congregação e admin:", error);
        if (error.code === 'auth/email-already-exists') {
            throw new https.HttpsError('already-exists', 'Este e-mail já está em uso.');
        }
        if (error instanceof https.HttpsError) {
          throw error;
        }
        throw new https.HttpsError('internal', error.message || 'Erro interno no servidor');
    }
});


export const deleteUserAccount = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const callingUserUid = context.auth.uid;
    const userIdToDelete = data.userIdToDelete;

    if (!userIdToDelete || typeof userIdToDelete !== 'string') {
        throw new https.HttpsError("invalid-argument", "ID inválido.");
    }

    const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
    const isAdmin = callingUserSnap.exists && callingUserSnap.data()?.role === "Administrador";

    if (!isAdmin && callingUserUid !== userIdToDelete) {
        throw new https.HttpsError("permission-denied", "Sem permissão.");
    }

    if (isAdmin && callingUserUid === userIdToDelete) {
        throw new https.HttpsError("permission-denied", "Admin não pode se autoexcluir.");
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
        throw new https.HttpsError("internal", `Falha na exclusão: ${error.message}`);
    }
});


export const notifyOnNewUser = https.onCall(async (data, context) => {
    const { newUserName, congregationId } = data;
    if (!newUserName || !congregationId) {
        throw new https.HttpsError('invalid-argument', 'Nome do novo usuário e ID da congregação são necessários.');
    }

    try {
        const roles = ['Administrador', 'Dirigente', 'Servo de Territórios'];
        const snapshots = await Promise.all(roles.map(r => db.collection("users").where('congregationId', '==', congregationId).where('role', '==', r).get()));
        const managers = snapshots.flatMap(s => s.docs);

        if (managers.length === 0) {
            return { success: true, message: 'Nenhum gerente para notificar.' };
        }

        const batch = db.batch();
        const notif: Omit<Notification, 'id'> = {
            title: "Novo Usuário Pendente",
            body: `O publicador "${newUserName}" solicitou acesso à congregação.`,
            link: "/dashboard/usuarios",
            type: 'user_pending',
            isRead: false,
            createdAt: admin.firestore.Timestamp.now()
        };

        const notified = new Set<string>();
        managers.forEach(doc => {
            if (!notified.has(doc.id)) {
                batch.set(doc.ref.collection('notifications').doc(), notif);
                notified.add(doc.id);
            }
        });
        await batch.commit();
        return { success: true, message: `Notificado(s) ${notified.size} gerente(s).` };
    } catch (err) {
        console.error("notifyOnNewUser: Falha ao notificar gerentes", err);
        throw new https.HttpsError('internal', 'Falha ao criar notificações para os gerentes.');
    }
});


export const notifyOnTerritoryAssigned = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new https.HttpsError('unauthenticated', 'Ação não autorizada.');
    }
    const { territoryId, territoryName, assignedUid } = data;
    if (!territoryId || !territoryName || !assignedUid) {
        throw new https.HttpsError('invalid-argument', 'IDs e nomes são necessários.');
    }
    
    const notif: Omit<Notification, 'id'> = {
        title: "Novo Território Designado",
        body: `O território "${territoryName || 'Desconhecido'}" foi designado para você.`,
        link: `/dashboard/territorios/${territoryId}`,
        type: 'territory_assigned',
        isRead: false,
        createdAt: admin.firestore.Timestamp.now()
    };

    try {
        const userRef = db.collection("users").doc(assignedUid);
        await userRef.collection('notifications').add(notif);
        return { success: true, message: `Notificação de designação criada para ${assignedUid}.` };
    } catch (err) {
        console.error(`notifyOnTerritoryAssigned: FALHA CRÍTICA ao gravar notificação para ${assignedUid}:`, err);
        throw new https.HttpsError('internal', 'Falha ao criar notificação para o usuário.');
    }
});


// ========================================================================
//   TRIGGERS DE CÁLCULO DE ESTATÍSTICAS
// ========================================================================

export const onHouseChange = onDocumentWritten(
  "congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!event.data?.after.exists) return null;

    const { congregationId, territoryId, quadraId } = event.params;
    const quadraRef = db.doc(`congregations/${congregationId}/territories/${territoryId}/quadras/${quadraId}`);

    try {
      await db.runTransaction(async (tx) => {
        const casasSnap = await tx.get(quadraRef.collection("casas"));
        tx.update(quadraRef, { 
          totalHouses: casasSnap.size, 
          housesDone: casasSnap.docs.filter(d => d.data().status === true).length 
        });
      });
    } catch (e) {
      console.error("onHouseChange: Erro na transação de estatísticas da quadra:", e);
    }

    if (before?.status === false && after?.status === true) {
      const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
      await territoryRef.update({ lastUpdate: admin.firestore.FieldValue.serverTimestamp() });
    }
  }
);

export const onQuadraChange = onDocumentWritten(
  "congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}",
  async (event) => {
    const { congregationId, territoryId } = event.params;
    const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
    const quadrasSnap = await territoryRef.collection("quadras").get();

    let totalHouses = 0, housesDone = 0;
    quadrasSnap.forEach(d => {
      totalHouses += d.data().totalHouses || 0;
      housesDone += d.data().housesDone || 0;
    });

    const progress = totalHouses > 0 ? housesDone / totalHouses : 0;
    return territoryRef.update({
      stats: { totalHouses, housesDone },
      progress,
      quadraCount: quadrasSnap.size
    });
  }
);

export const onTerritoryChange = onDocumentWritten(
  "congregations/{congregationId}/territories/{territoryId}",
  async (event) => {
    const { congregationId } = event.params;
    const congRef = db.doc(`congregations/${congregationId}`);
    const terrSnap = await congRef.collection("territories").get();

    let urban = 0, rural = 0, totalHouses = 0, totalHousesDone = 0, totalQuadras = 0;

    terrSnap.forEach(d => {
      const data = d.data();
      if (data.type === 'rural') rural++;
      else {
        urban++;
        totalHouses += data.stats?.totalHouses || 0;
        totalHousesDone += data.stats?.housesDone || 0;
        totalQuadras += data.quadraCount || 0;
      }
    });

    return congRef.update({
      territoryCount: urban,
      ruralTerritoryCount: rural,
      totalQuadras,
      totalHouses,
      totalHousesDone,
      lastUpdate: admin.firestore.FieldValue.serverTimestamp()
    });
  }
);

// ========================================================================
//   TRIGGERS DE LIMPEZA
// ========================================================================

export const onDeleteTerritory = onDocumentDeleted("congregations/{congregationId}/territories/{territoryId}", async (event) => {
  if (!event.data) return null;
  try { await db.recursiveDelete(event.data.ref); }
  catch(err: any){ console.error("onDeleteTerritory:", err); }
});

export const onDeleteQuadra = onDocumentDeleted("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}", async (event)=>{
if (!event.data) return null;
try{ await db.recursiveDelete(event.data.ref); }
catch(err: any){ console.error("onDeleteQuadra:", err);}
});

// ========================================================================
//   SISTEMA DE PRESENÇA (RTDB -> Firestore)
// ========================================================================

export const mirrorUserStatus = onValueWritten(
  { ref: "/status/{uid}", region: "us-central1" },
  async (event) => {
    const eventStatus = event.data.after.val();
    const uid = event.params.uid;
    const userDocRef = db.doc(`users/${uid}`);
    try {
      if (!eventStatus || eventStatus.state === 'offline') {
        await userDocRef.update({ isOnline: false, lastSeen: admin.firestore.FieldValue.serverTimestamp() });
      } else if (eventStatus.state === 'online') {
        await userDocRef.update({ isOnline: true, lastSeen: admin.firestore.FieldValue.serverTimestamp() });
      }
    } catch (err: any) {
      if (err.code !== 'not-found') {
        console.error(`[Presence Mirror] Falha para ${uid}:`, err);
      }
    }
    return null;
  }
);
