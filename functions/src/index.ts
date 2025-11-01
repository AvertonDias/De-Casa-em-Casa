
import { https, setGlobalOptions, pubsub } from "firebase-functions/v2";
import { onDocumentWritten, onDocumentDeleted, onDocumentCreated } from "firebase-functions/v2/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import * as admin from "firebase-admin";
import { format } from 'date-fns';
import { randomBytes } from 'crypto';
import * as cors from "cors";
import { AppUser, Notification, Territory } from "./types";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
setGlobalOptions({ region: "southamerica-east1" });

const corsHandler = cors({ origin: true });

// ========================================================================
//   FUNÇÕES HTTPS
// ========================================================================

export const createCongregationAndAdmin = https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp } = req.body;
    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    let newUser: admin.auth.UserRecord | undefined;

    try {
      const existing = await db.collection('congregations').where('number', '==', congregationNumber).get();
      if (!existing.empty) return res.status(409).json({ error: 'Número da congregação já existe.' });

      newUser = await admin.auth().createUser({ email: adminEmail, password: adminPassword, displayName: adminName });

      const batch = db.batch();
      const congRef = db.collection('congregations').doc();
      batch.set(congRef, {
        name: congregationName,
        number: congregationNumber,
        territoryCount: 0, ruralTerritoryCount: 0, totalQuadras: 0, totalHouses: 0, totalHousesDone: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdate: admin.firestore.FieldValue.serverTimestamp()
      });

      batch.set(db.collection("users").doc(newUser.uid), {
        name: adminName,
        email: adminEmail,
        whatsapp,
        congregationId: congRef.id,
        role: "Administrador",
        status: "ativo"
      });

      await batch.commit();
      res.status(200).json({ success: true, userId: newUser.uid, message: 'Congregação criada com sucesso!' });

    } catch (error: any) {
      if (newUser) await admin.auth().deleteUser(newUser.uid).catch(console.error);
      console.error("Erro createCongregationAndAdmin:", error);
      const codeMap: Record<string,string> = { 'auth/email-already-exists': 'Este e-mail já está em uso.' };
      res.status(500).json({ error: codeMap[error.code] || error.message || 'Erro interno' });
    }
  });
});

export const requestPasswordReset = https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mail obrigatório.' });

    try {
      await admin.auth().getUserByEmail(email);
      const token = randomBytes(32).toString("hex");
      const expires = admin.firestore.Timestamp.fromMillis(Date.now() + 3600*1000);
      await db.collection("resetTokens").doc(token).set({ email, expires });
      res.status(200).json({ success: true, token });
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') return res.status(200).json({ success: true, token: null });
      console.error("Erro requestPasswordReset:", error);
      res.status(500).json({ error: 'Falha ao processar pedido de redefinição.' });
    }
  });
});

export const resetPasswordWithToken = https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: "Token e nova senha obrigatórios." });
    if (newPassword.length < 6) return res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres." });

    const tokenRef = db.collection("resetTokens").doc(token);
    try {
      const tokenDoc = await tokenRef.get();
      if (!tokenDoc.exists) return res.status(404).json({ error: "Token inválido ou já usado." });

      const tokenData = tokenDoc.data()!;
      if (tokenData.expires.toMillis() < Date.now()) { await tokenRef.delete(); return res.status(410).json({ error: "Token expirado." }); }

      const user = await admin.auth().getUserByEmail(tokenData.email);
      await admin.auth().updateUser(user.uid, { password: newPassword });
      await tokenRef.delete();
      res.status(200).json({ success: true, message: "Senha redefinida com sucesso." });
    } catch (error: any) {
      console.error("Erro resetPasswordWithToken:", error);
      res.status(500).json({ error: "Erro interno ao redefinir senha." });
    }
  });
});

export const deleteUserAccount = https.onCall(async (request) => {
  if (!request.auth) throw new https.HttpsError('unauthenticated', 'Ação não autorizada.');
  const callingUserUid = request.auth.uid;
  const userIdToDelete = request.data.userIdToDelete;
  if (!userIdToDelete) throw new https.HttpsError('invalid-argument', 'ID do usuário é necessário.');

  const callingUserData = (await db.doc(`users/${callingUserUid}`).get()).data() as AppUser;
  if (callingUserData.role !== 'Administrador' && callingUserUid !== userIdToDelete)
      throw new https.HttpsError('permission-denied', 'Sem permissão para excluir outros usuários.');
  if (callingUserData.role === 'Administrador' && callingUserUid === userIdToDelete)
      throw new https.HttpsError('permission-denied', 'Administrador não pode se autoexcluir.');

  try {
    await admin.auth().deleteUser(userIdToDelete);
    await db.doc(`users/${userIdToDelete}`).delete();
    return { success: true, message: 'Usuário excluído com sucesso.' };
  } catch (error: any) {
    console.error('Erro CRÍTICO ao excluir usuário:', error);
    if (error.code === 'auth/user-not-found') {
      await db.doc(`users/${userIdToDelete}`).delete();
      return { success: true, message: 'Usuário não encontrado na Auth, mas removido do Firestore.' };
    }
    throw new https.HttpsError('internal', error.message || 'Falha ao excluir usuário.');
  }
});


// ========================================================================
//   TRIGGERS FIRESTORE
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
        const totalHouses = casasSnap.size;
        const housesDone = casasSnap.docs.filter(d => d.data().status === true).length;
        tx.update(quadraRef, { totalHouses, housesDone });
      });
    } catch (e) {
      console.error("onHouseChange: Erro atualização estatísticas quadra:", e);
    }

    if (before?.status === false && after?.status === true) {
      const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const activityRef = territoryRef.collection('activityHistory');

      try {
        const todaySnap = await activityRef.where('activityDateStr', '==', todayStr).where('type', '==', 'work').limit(1).get();
        if (todaySnap.empty) {
          await activityRef.add({
            type: 'work',
            activityDate: admin.firestore.FieldValue.serverTimestamp(),
            activityDateStr: todayStr,
            description: "Primeiro trabalho do dia registrado. (Automático)",
            userId: 'automatic_system_log',
            userName: 'Sistema'
          });
        }
      } catch (err) {
        console.error("onHouseChange: Falha ao criar log de atividade:", err);
      }
      await territoryRef.update({ lastUpdate: admin.firestore.FieldValue.serverTimestamp() });
    }

    return null;
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

export const onNewUserPending = onDocumentCreated(
  "users/{userId}",
  async (event) => {
    const newUser = event.data?.data();
    console.log("onNewUserPending: Novo usuário disparado:", newUser);
    if (!newUser || newUser.status !== 'pendente' || !newUser.congregationId) {
      console.log("onNewUserPending: Condição inicial não atendida.");
      return null;
    }
    console.log("onNewUserPending: Usuário PENDENTE encontrado.");

    try {
      const roles = ['Administrador', 'Dirigente', 'Servo de Territórios'];
      console.log("onNewUserPending: Buscando admins/gerentes para congregação:", newUser.congregationId);
      const snapshots = await Promise.all(roles.map(r => db.collection("users").where('congregationId', '==', newUser.congregationId).where('role', '==', r).get()));
      const adminsAndManagers = snapshots.flatMap(s => s.docs);
      console.log("onNewUserPending: Administradores/gerentes encontrados:", adminsAndManagers.map(d => d.id));
      if (adminsAndManagers.length === 0) {
        console.log("onNewUserPending: Nenhum administrador/gerente encontrado.");
        return null;
      }

      const batch = db.batch();
      const notif: Omit<Notification,'id'> = {
        title: "Novo Usuário Pendente",
        body: `O publicador "${newUser.name}" solicitou acesso à congregação.`,
        link: "/dashboard/usuarios",
        type: 'user_pending',
        isRead: false,
        createdAt: admin.firestore.Timestamp.now()
      };

      const notified = new Set<string>();
      adminsAndManagers.forEach(doc => {
        if (!notified.has(doc.id)) {
          batch.set(doc.ref.collection('notifications').doc(), notif);
          notified.add(doc.id);
        }
      });
      await batch.commit();
    } catch (err) {
      console.error("onNewUserPending: Falha ao notificar admins", err);
    }
  }
);

export const onTerritoryAssigned = onDocumentWritten(
  "congregations/{congId}/territories/{terrId}",
  async (event) => {
    const before = event.data?.before.data() as Territory | undefined;
    const after = event.data?.after.data() as Territory | undefined;
    console.log("onTerritoryAssigned: Trigger disparado para terrId:", event.params.terrId);
    console.log("onTerritoryAssigned: Before:", JSON.stringify(before, null, 2));
    console.log("onTerritoryAssigned: After:", JSON.stringify(after, null, 2));

    // Condição melhorada: notifica se a atribuição foi adicionada ou alterada.
    if (after?.assignment && before?.assignment?.uid !== after.assignment.uid) {
      const { uid, name } = after.assignment;
      const territoryId = event.params.terrId;
      console.log("onTerritoryAssigned: Designação detectada para:", uid, name);
      if (uid.startsWith('custom_')) {
          console.log("onTerritoryAssigned: UID customizado, ignorando.");
          return;
      }

      const notif: Omit<Notification, 'id'> = {
        title: "Novo Território Designado",
        body: `O território "${after.name}" foi designado para você.`,
        link: `/dashboard/territorios/${territoryId}`,
        type: 'territory_assigned',
        isRead: false,
        createdAt: admin.firestore.Timestamp.now()
      };

      try {
        const userRef = db.collection("users").doc(uid);
        await userRef.collection('notifications').add(notif);
        console.log(`[Notification] Notificação interna para ${uid} criada com sucesso.`);
      } catch (err) {
        console.error(`[Notification] Falha CRÍTICA ao gravar notificação no Firestore para ${uid}:`, err);
      }
    }
  }
);

export const onTerritoryReturned = onDocumentWritten(
  "congregations/{congId}/territories/{terrId}",
  async (event) => {
    const before = event.data?.before.data() as Territory | undefined;
    const after = event.data?.after.data() as Territory | undefined;
    console.log("onTerritoryReturned: Trigger disparado para terrId:", event.params.terrId);
    console.log("onTerritoryReturned: Before:", before);
    console.log("onTerritoryReturned: After:", after);

    // Condição melhorada: notifica se a atribuição foi removida.
    if (before?.assignment && !after?.assignment) {
      const congId = event.params.congId;
      const territoryName = after!.name;
      const returningUid = before.assignment.uid;
      console.log("onTerritoryReturned: Devolução detectada por:", returningUid);

      const batch = db.batch();

      // Notificação para o usuário que devolveu (se não for custom)
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

      // Notificação para os administradores/servos
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
        console.log(`[Notification] Notificação de devolução enviada para o usuário e ${notified.size} gerente(s).`);
      } catch (err) {
        console.error("onTerritoryReturned: Falha ao notificar gerentes", err);
      }
    }
  }
);


export const onDeleteTerritory = onDocumentDeleted("congregations/{congregationId}/territories/{territoryId}", async (event) => {
  if (!event.data) return null;
  try { await db.recursiveDelete(event.data.ref); return { success:true }; }
  catch(err: any){ console.error("onDeleteTerritory:", err); }
});

export const onDeleteQuadra = onDocumentDeleted("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}", async (event)=>{
if (!event.data) return null;
try{ await db.recursiveDelete(event.data.ref); return { success:true }; }
catch(err: any){ console.error("onDeleteQuadra:", err);}
});

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
