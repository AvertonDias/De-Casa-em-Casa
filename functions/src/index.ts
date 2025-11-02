
import { https, logger, setGlobalOptions } from "firebase-functions/v2";
import { onDocumentWritten, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

setGlobalOptions({ region: "southamerica-east1" });

// ========================================================================
//   FUNÇÕES HTTPS (onCall)
// ========================================================================

export const createCongregationAndAdmin = https.onCall(async (data, context) => {
  const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp } = data;
  if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
    throw new https.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
  }
  let newUser;
  try {
    newUser = await admin.auth().createUser({ email: adminEmail, password: adminPassword, displayName: adminName });
    const batch = db.batch();
    const newCongregationRef = db.collection("congregations").doc();
    batch.set(newCongregationRef, {
      name: congregationName, number: congregationNumber,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
    });
    const userDocRef = db.collection("users").doc(newUser.uid);
    batch.set(userDocRef, {
      name: adminName, email: adminEmail, whatsapp: whatsapp, congregationId: newCongregationRef.id,
      role: "Administrador", status: "ativo",
    });
    await batch.commit();
    return { success: true, userId: newUser.uid };
  } catch (error: any) {
    if (newUser) {
      await admin.auth().deleteUser(newUser.uid).catch(e => logger.error("Falha ao limpar usuário órfão", e));
    }
    if (error.code === "auth/email-already-exists") {
      throw new https.HttpsError("already-exists", "Este e-mail já está em uso.");
    }
    logger.error("Erro ao criar congregação:", error);
    throw new https.HttpsError("internal", error.message);
  }
});

export const getManagersForNotification = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new https.HttpsError("unauthenticated", "O usuário deve estar autenticado.");
    }
    const { congregationId } = data;
    if (!congregationId) {
        throw new https.HttpsError("invalid-argument", "O ID da congregação é obrigatório.");
    }
    try {
        const rolesToFetch = ["Administrador", "Dirigente"];
        const managers: any[] = [];
        const promises = rolesToFetch.map(role => 
            db.collection("users").where("congregationId", "==", congregationId").where("role", "==", role).get()
        );
        const snapshots = await Promise.all(promises);
        snapshots.forEach(snapshot => {
            snapshot.forEach(doc => {
                const { name, whatsapp } = doc.data();
                // Evita adicionar duplicados se um usuário tiver múltiplos papéis
                if (!managers.some(m => m.uid === doc.id)) {
                    managers.push({ uid: doc.id, name, whatsapp });
                }
            });
        });
        return { success: true, managers };
    } catch (error) {
        logger.error("Erro ao buscar gerentes:", error);
        throw new https.HttpsError("internal", "Falha ao buscar contatos.");
    }
});


// ========================================================================
//   GATILHOS FIRESTORE (Triggers)
// ========================================================================

export const onHouseChange = onDocumentWritten("congregations/{congId}/territories/{terrId}/quadras/{quadraId}/casas/{casaId}", async (event) => {
  if (!event.data) return null;
  const { congId, terrId, quadraId } = event.params;
  const quadraRef = db.doc(`congregations/${congId}/territories/${terrId}/quadras/${quadraId}`);
  return db.runTransaction(async (transaction) => {
    const casasSnapshot = await transaction.get(quadraRef.collection("casas"));
    const totalHouses = casasSnapshot.size;
    const housesDone = casasSnapshot.docs.filter(doc => doc.data().status === true).length;
    transaction.update(quadraRef, { totalHouses, housesDone });
  });
});

export const onQuadraChange = onDocumentWritten("congregations/{congId}/territories/{terrId}/quadras/{quadraId}", async (event) => {
  if (!event.data) return null;
  const { congId, terrId } = event.params;
  const territoryRef = db.doc(`congregations/${congId}/territories/${terrId}`);
  const quadrasSnapshot = await territoryRef.collection("quadras").get();
  let totalHouses = 0;
  let housesDone = 0;
  quadrasSnapshot.forEach(doc => {
      totalHouses += doc.data().totalHouses || 0;
      housesDone += doc.data().housesDone || 0;
  });
  const progress = totalHouses > 0 ? (housesDone / totalHouses) : 0;
  return territoryRef.update({
      stats: { totalHouses, housesDone }, progress, quadraCount: quadrasSnapshot.size,
      lastUpdate: admin.firestore.FieldValue.serverTimestamp()
  });
});

export const onTerritoryChange = onDocumentWritten("congregations/{congId}/territories/{terrId}", async (event) => {
    if (!event.data) return null;
    const { congId } = event.params;
    const congregationRef = db.doc(`congregations/${congId}`);
    const territoriesSnapshot = await congregationRef.collection("territories").get();
    let urbanCount = 0, ruralCount = 0, totalHouses = 0, totalHousesDone = 0, totalQuadras = 0;
    territoriesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.type === 'rural') ruralCount++;
        else {
            urbanCount++;
            totalHouses += data.stats?.totalHouses || 0;
            totalHousesDone += data.stats?.housesDone || 0;
            totalQuadras += data.quadraCount || 0;
        }
    });
    return congregationRef.update({
        territoryCount: urbanCount, ruralTerritoryCount: ruralCount,
        totalQuadras, totalHouses, totalHousesDone,
        lastUpdate: admin.firestore.FieldValue.serverTimestamp()
    });
});


// ============================================================================
//   SISTEMA DE PRESENÇA (RTDB -> FIRESTORE)
// ============================================================================

export const mirrorUserStatus = onValueWritten("/status/{uid}", async (event) => {
  const { uid } = event.params;
  const status = event.data.after.val();
  const userDocRef = db.doc(`users/${uid}`);
  try {
    if (!status || status.state === 'offline') {
      return userDocRef.update({ isOnline: false, lastSeen: admin.firestore.FieldValue.serverTimestamp() });
    }
    return userDocRef.update({ isOnline: true, lastSeen: admin.firestore.FieldValue.serverTimestamp() });
  } catch (err: any) {
    if (err.code !== 5) { // 5 = NOT_FOUND, ignora se o usuário não existe no Firestore
      logger.error(`[Presence] Falha ao espelhar status para ${uid}:`, err);
    }
    return null;
  }
});
