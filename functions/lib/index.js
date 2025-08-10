import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { format } from 'date-fns';

admin.initializeApp();
const db = admin.firestore();

// onHouseChange
export const onHouseChange = functions
  .region('southamerica-east1')
  .runWith({ serviceAccount: 'service-83629039662@gcp-sa-eventarc.iam.gserviceaccount.com' })
  .firestore.document('congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}')
  .onWrite(async (change, context) => {
    const beforeData = change.before.exists ? change.before.data() : null;
    const afterData = change.after.exists ? change.after.data() : null;

    console.log('*** onHouseChange triggered ***');
    console.log('Path:', change.after.ref.path);
    console.log('Before Data:', beforeData);
    console.log('After Data:', afterData);

    if (!afterData) {
      console.log('--- onHouseChange: Document deleted, exiting. ---');
      return null;
    }

    const { congregationId, territoryId, quadraId } = context.params;
    const quadraRef = db.collection('congregations').doc(congregationId)
      .collection('territories').doc(territoryId)
      .collection('quadras').doc(quadraId);

    console.log('--- onHouseChange: Starting quadra stats update ---');
    try {
      await db.runTransaction(async (transaction) => {
        const currentQuadraSnap = await transaction.get(quadraRef);
        if (!currentQuadraSnap.exists) {
          console.error("onHouseChange: Quadra não encontrada para atualizar estatísticas:", quadraRef.path);
          return;
        }
        const casasSnapshot = await currentQuadraSnap.ref.collection("casas").get();
        const totalHouses = casasSnapshot.size;
        const housesDone = casasSnapshot.docs.filter(doc => doc.data().status === true).length;
        transaction.update(quadraRef, {
          totalHouses,
          housesDone
        });
        console.log(`onHouseChange: Quadra stats updated. Total: ${totalHouses}, Done: ${housesDone}`);
      });
    } catch (e) {
      console.error("onHouseChange: Erro na transação de atualização de estatísticas da quadra:", e);
    }

    console.log('--- onHouseChange: Starting activity history logic ---');
    if (beforeData?.status === false && afterData?.status === true) {
      console.log('onHouseChange: House status changed from false to true. Proceeding with history check.');
      const territoryRef = db.doc(`congregations/${congregationId}/territories/${territoryId}`);
      const today = format(new Date(), 'yyyy-MM-dd');
      const activityHistoryRef = db.collection(`${territoryRef.path}/activityHistory`);

      try {
        const todayActivitiesSnap = await activityHistoryRef
          .where('activityDateStr', '==', today)
          .where('type', '==', 'work')
          .limit(1)
          .get();

        if (todayActivitiesSnap.empty) {
          console.log('onHouseChange: NO existing activity log found for today. Creating new automatic log.');
          const automaticDescription = "Primeiro trabalho do dia registrado.(Registro Automático)";
          const finalDescriptionForAutoLog = `${automaticDescription}\nRegistrado por: Sistema`;

          await activityHistoryRef.add({
            type: 'work',
            activityDate: admin.firestore.FieldValue.serverTimestamp(),
            activityDateStr: today,
            description: finalDescriptionForAutoLog,
            userId: 'automatic_system_log',
            userName: 'Sistema'
          });
          console.log('onHouseChange: Successfully added new automatic activity log.');
        } else {
          console.log('onHouseChange: Existing activity log found for today. Skipping automatic log creation.');
        }
      } catch (error) {
        console.error("onHouseChange: Erro ao processar ou adicionar log de atividade:", error);
      }

      console.log('onHouseChange: Updating territory lastUpdate.');
      await territoryRef.update({ lastUpdate: admin.firestore.FieldValue.serverTimestamp() });
      console.log('onHouseChange: Territory lastUpdate completed.');
    } else {
      console.log('onHouseChange: House status did NOT change from false to true or was not a modification. Skipping history logic.');
    }

    console.log('*** onHouseChange finished ***');
    return null;
  });

// onQuadraChange
export const onQuadraChange = functions
  .region('southamerica-east1')
  .runWith({ serviceAccount: 'service-83629039662@gcp-sa-eventarc.iam.gserviceaccount.com' })
  .firestore.document('congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}')
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

    return territoryRef.update({
      stats: { totalHouses, housesDone },
      progress,
      quadraCount: quadrasSnapshot.size,
    });
  });

// onTerritoryChange
export const onTerritoryChange = functions
  .region('southamerica-east1')
  .runWith({ serviceAccount: 'service-83629039662@gcp-sa-eventarc.iam.gserviceaccount.com' })
  .firestore.document('congregations/{congregationId}/territories/{territoryId}')
  .onWrite(async (change, context) => {
    const { congregationId } = context.params;
    const congregationRef = db.doc(`congregations/${congregationId}`);
    const territoriesRef = congregationRef.collection("territories");
    const territoriesSnapshot = await territoriesRef.get();

    let urbanCount = 0, ruralCount = 0, totalHouses = 0, totalHousesDone = 0, totalQuadras = 0;

    territoriesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.type === 'rural') {
        ruralCount++;
      } else {
        urbanCount++;
        totalHouses += data.stats?.totalHouses || 0;
        totalHousesDone += data.stats?.housesDone || 0;
        totalQuadras += data.quadraCount || 0;
      }
    });

    return congregationRef.update({
      territoryCount: urbanCount,
      ruralTerritoryCount: ruralCount,
      totalQuadras,
      totalHouses,
      totalHousesDone,
      lastUpdate: admin.firestore.FieldValue.serverTimestamp()
    });
  });

// onTerritoryAssigned
export const onTerritoryAssigned = functions
  .region('southamerica-east1')
  .runWith({ serviceAccount: 'service-83629039662@gcp-sa-eventarc.iam.gserviceaccount.com' })
  .firestore.document('congregations/{congId}/territories/{terrId}')
  .onUpdate(async (change, context) => {
    const dataBefore = change.before.data();
    const dataAfter = change.after.data();

    if (!dataAfter?.assignment || dataBefore?.assignment?.uid === dataAfter.assignment?.uid) {
      return null;
    }

    const assignedUserUid = dataAfter.assignment.uid;
    const territoryName = dataAfter.name;
    const dueDate = dataAfter.assignment.dueDate.toDate();
    const formattedDueDate = dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    try {
      const userDoc = await db.collection("users").doc(assignedUserUid).get();
      if (!userDoc.exists) return null;

      const tokens = userDoc.data()?.fcmTokens;
      if (!tokens || tokens.length === 0) return null;

      const payload = {
        notification: {
          title: "Você recebeu um novo território!",
          body: `O território \"${territoryName}\" está sob sua responsabilidade. Devolver até ${formattedDueDate}.`,
          icon: "/icon-192x192.jpg",
          click_action: "/dashboard/meus-territorios",
        },
      };

      await admin.messaging().sendToDevice(tokens, payload);
      return { success: true };
    } catch (error) {
      console.error(`[Notification] FALHA CRÍTICA ao enviar notificação:`, error);
      return { success: false, error };
    }
  });

// onDeleteTerritory
export const onDeleteTerritory = functions
  .region('southamerica-east1')
  .runWith({ serviceAccount: 'service-83629039662@gcp-sa-eventarc.iam.gserviceaccount.com' })
  .firestore.document('congregations/{congregationId}/territories/{territoryId}')
  .onDelete((snap) => {
    if (!snap.exists) return null;
    return admin.firestore().recursiveDelete(snap.ref);
  });

// onDeleteQuadra
export const onDeleteQuadra = functions
  .region('southamerica-east1')
  .runWith({ serviceAccount: 'service-83629039662@gcp-sa-eventarc.iam.gserviceaccount.com' })
  .firestore.document('congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}')
  .onDelete((snap) => {
    if (!snap.exists) return null;
    return admin.firestore().recursiveDelete(snap.ref);
  });

// mirrorUserStatus
export const mirrorUserStatus = functions
  .region('us-central1')
  .runWith({ serviceAccount: 'service-83629039662@gcp-sa-eventarc.iam.gserviceaccount.com' })
  .database.ref('/status/{uid}')
  .onWrite(async (change, context) => {
    const eventStatus = change.after.val();
    const uid = context.params.uid;
    const userDocRef = admin.firestore().doc(`users/${uid}`);

    try {
      if (!eventStatus || eventStatus.state === 'offline') {
        await userDocRef.update({ isOnline: false, lastSeen: admin.firestore.FieldValue.serverTimestamp() });
      } else if (eventStatus.state === 'online') {
        await userDocRef.update({ isOnline: true, lastSeen: admin.firestore.FieldValue.serverTimestamp() });
      }
    } catch (err) {
      if (err.code !== 'not-found') console.error(`[Presence Mirror] Falha para ${uid}:`, err);
    }
    return null;
  });
