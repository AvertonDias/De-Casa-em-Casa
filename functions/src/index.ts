
import { https, setGlobalOptions } from "firebase-functions/v2";
import { onDocumentWritten, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import * as admin from "firebase-admin";
import { format } from 'date-fns';
import { AppUser, Notification, Territory } from "./types";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
setGlobalOptions({ region: "southamerica-east1" });

// ========================================================================
//   FUNÇÕES CHAMÁVEIS (onCall)
// ========================================================================

export const notifyManagersOfNewUser = https.onCall(async (request) => {
    if (!request.auth) throw new https.HttpsError('unauthenticated', 'Ação não autorizada.');
    
    const { newUserName, congregationId } = request.data;
    if (!newUserName || !congregationId) throw new https.HttpsError('invalid-argument', 'Nome do novo usuário e ID da congregação são necessários.');

    try {
        const roles = ['Administrador', 'Dirigente', 'Servo de Territórios'];
        const snapshots = await Promise.all(roles.map(r => db.collection("users").where('congregationId', '==', congregationId).where('role', '==', r).get()));
        const managers = snapshots.flatMap(s => s.docs);

        if (managers.length === 0) return { success: true, message: 'Nenhum gerente para notificar.' };

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
        console.error("notifyManagersOfNewUser: Falha ao notificar gerentes", err);
        throw new https.HttpsError("internal", "Falha ao criar notificações para os gerentes.");
    }
});


export const onTerritoryAssigned = onDocumentWritten(
    "congregations/{congId}/territories/{terrId}",
    async (event) => {
        const beforeData = event.data?.before.data() as Territory | undefined;
        const afterData = event.data?.after.data() as Territory | undefined;

        if (afterData?.assignment && beforeData?.assignment?.uid !== afterData.assignment.uid) {
            const { uid, name } = afterData.assignment;
            const territoryId = event.params.terrId;
            const territoryName = afterData.name;
            
            console.log(`[Notification] Designação detectada: UID=${uid}, Nome=${name} (Território: ${territoryName})`);

            if (uid.startsWith('custom_')) {
                console.log(`[Notification] UID atribuído '${uid}' é customizado, pulando notificação.`);
                return null;
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
                const userRef = db.collection("users").doc(uid);
                await userRef.collection('notifications').add(notif);
                console.log(`[Notification] Notificação interna para usuário ${uid} criada com sucesso.`);
            } catch (err) {
                console.error(`[Notification] FALHA CRÍTICA ao gravar notificação no Firestore para usuário ${uid}:`, err);
            }
        }
    }
);


export const onTerritoryReturned = onDocumentWritten(
    "congregations/{congId}/territories/{terrId}",
    async (event) => {
        const before = event.data?.before.data() as Territory | undefined;
        const after = event.data?.after.data() as Territory | undefined;

        if (before?.assignment && !after?.assignment) {
            const congId = event.params.congId;
            const territoryName = after!.name;
            const returningUid = before.assignment.uid;

            const batch = db.batch();

            if (!returningUid.startsWith('custom_')) {
                const userNotif: Omit<Notification, 'id'> = {
                    title: "Território Devolvido",
                    body: `Você devolveu o território "${territoryName}". Obrigado!`,
                    link: `/dashboard/territorios/${event.params.terrId}`,
                    type: 'territory_returned',
                    isRead: false,
                    createdAt: admin.firestore.Timestamp.now()
                };
                batch.set(db.collection("users").doc(returningUid).collection('notifications').doc(), userNotif);
            }

            try {
                const managerRoles = ['Administrador', 'Dirigente', 'Servo de Territórios'];
                const managerSnapshots = await Promise.all(managerRoles.map(r => db.collection("users").where('congregationId', '==', congId).where('role', '==', r).get()));
                const managers = managerSnapshots.flatMap(s => s.docs);
                
                const notified = new Set<string>();
                const adminNotif: Omit<Notification, 'id'> = {
                    title: "Território Disponível",
                    body: `O território "${territoryName}" foi devolvido e está disponível para designação.`,
                    link: '/dashboard/administracao',
                    type: 'territory_available',
                    isRead: false,
                    createdAt: admin.firestore.Timestamp.now()
                };
                managers.forEach(doc => {
                    if (!notified.has(doc.id)) {
                        batch.set(doc.ref.collection('notifications').doc(), adminNotif);
                        notified.add(doc.id);
                    }
                });
                
                await batch.commit();
            } catch (err) {
                console.error("onTerritoryReturned: Falha ao notificar gerentes", err);
            }
        }
    }
);

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

    