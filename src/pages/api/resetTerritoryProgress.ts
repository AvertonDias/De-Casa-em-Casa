// src/pages/api/resetTerritoryProgress.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { initializeAdmin } from "@/lib/firebaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = initializeAdmin();
  const db = admin?.firestore();
  if (!admin || !db) {
    return res.status(500).json({ error: "Firebase Admin SDK não foi inicializado." });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    
    const { congregationId, territoryId } = req.body;
    if (!congregationId || !territoryId) {
      return res.status(400).json({ error: "IDs da congregação e território são necessários." });
    }

    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (adminUserSnap.data()?.role !== "Administrador") {
      return res.status(403).json({ error: "Ação restrita a administradores." });
    }

    const historyPath = `congregations/${congregationId}/territories/${territoryId}/activityHistory`;
    const quadrasRef = db.collection(`congregations/${congregationId}/territories/${territoryId}/quadras`);
    
    await db.recursiveDelete(db.collection(historyPath));
    
    let housesUpdatedCount = 0;
    await db.runTransaction(async (transaction) => {
        const quadrasSnapshot = await transaction.get(quadrasRef);
        const housesToUpdate: { ref: FirebaseFirestore.DocumentReference, data: { status: boolean } }[] = [];

        for (const quadraDoc of quadrasSnapshot.docs) {
            const casasSnapshot = await transaction.get(quadraDoc.ref.collection("casas"));
            casasSnapshot.forEach(casaDoc => {
                if (casaDoc.data().status === true) {
                    housesToUpdate.push({ ref: casaDoc.ref, data: { status: false } });
                    housesUpdatedCount++;
                }
            });
        }
        
        for (const houseUpdate of housesToUpdate) {
            transaction.update(houseUpdate.ref, houseUpdate.data);
        }
    });

    if (housesUpdatedCount > 0) {
        return res.status(200).json({ success: true, message: `Sucesso! ${housesUpdatedCount} casas no território foram resetadas.` });
    } else {
        return res.status(200).json({ success: true, message: "Nenhuma alteração necessária, nenhuma casa estava marcada como 'feita'." });
    }

  } catch (error: any) {
    console.error("Erro na API resetTerritoryProgress:", error);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: "Token expirado, por favor, faça login novamente." });
    }
    return res.status(500).json({ error: "Falha ao processar a limpeza das casas do território." });
  }
}
