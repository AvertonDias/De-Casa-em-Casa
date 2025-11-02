
import { https, logger, setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import * as cors from "cors";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

setGlobalOptions({ region: "southamerica-east1" });

const corsHandler = cors({
    origin: true,
});


// ========================================================================
//   FUNÇÕES HTTPS (onCall)
// ========================================================================

export const createCongregationAndAdmin = https.onCall(async (data) => {
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
