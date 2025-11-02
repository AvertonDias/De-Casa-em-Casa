import { https, setGlobalOptions } from "firebase-functions/v2";
import { onDocumentWritten, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: "southamerica-east1" });

export const createCongregationAndAdmin = https.onCall(
  async (request) => {
    const {
      adminName,
      adminEmail,
      adminPassword,
      congregationName,
      congregationNumber,
      whatsapp,
    } = request.data;

    if (
      !adminName ||
      !adminEmail ||
      !adminPassword ||
      !congregationName ||
      !congregationNumber ||
      !whatsapp
    ) {
      throw new https.HttpsError(
        "invalid-argument",
        "Todos os campos são obrigatórios."
      );
    }

    let newUser;
    try {
      const congQuery = await db
        .collection("congregations")
        .where("number", "==", congregationNumber)
        .get();
      if (!congQuery.empty) {
        throw new https.HttpsError(
          "already-exists",
          "Uma congregação com este número já existe."
        );
      }

      newUser = await admin.auth().createUser({
        email: adminEmail,
        password: adminPassword,
        displayName: adminName,
      });

      const batch = db.batch();
      const newCongregationRef = db.collection("congregations").doc();
      batch.set(newCongregationRef, {
        name: congregationName,
        number: congregationNumber,
        territoryCount: 0,
        ruralTerritoryCount: 0,
        totalQuadras: 0,
        totalHouses: 0,
        totalHousesDone: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
      });

      const userDocRef = db.collection("users").doc(newUser.uid);
      batch.set(userDocRef, {
        name: adminName,
        email: adminEmail,
        whatsapp: whatsapp,
        congregationId: newCongregationRef.id,
        role: "Administrador",
        status: "ativo",
      });

      await batch.commit();
      return {
        success: true,
        userId: newUser.uid,
        message: "Congregação criada com sucesso!",
      };
    } catch (error: any) {
      if (newUser) {
        await admin
          .auth()
          .deleteUser(newUser.uid)
          .catch((deleteError) => {
            console.error(
              `Falha CRÍTICA ao limpar usuário órfão '${newUser?.uid}':`,
              deleteError
            );
          });
      }
      if (error.code === "auth/email-already-exists") {
        throw new https.HttpsError(
          "already-exists",
          "Este e-mail já está em uso."
        );
      }
      console.error("Erro ao criar congregação e admin:", error);
      throw new https.HttpsError(
        "internal",
        error.message || "Erro interno no servidor"
      );
    }
  }
);

export const mirrorUserStatus = onValueWritten(
    {
      ref: "/status/{uid}",
      region: "us-central1",
    },
    async (event) => {
      const eventStatus = event.data.after.val();
      const uid = event.params.uid;
      const userDocRef = db.doc(`users/${uid}`);
  
      try {
        if (!eventStatus || eventStatus.state === "offline") {
          await userDocRef.update({
            isOnline: false,
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else if (eventStatus.state === "online") {
          await userDocRef.update({
            isOnline: true,
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (err: any) {
        if (err.code !== "not-found") {
          console.error(`[Presence Mirror] Falha para ${uid}:`, err);
        }
      }
      return null;
    }
  );