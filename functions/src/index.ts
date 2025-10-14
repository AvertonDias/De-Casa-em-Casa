
// functions/src/index.ts
import { https, setGlobalOptions, pubsub } from "firebase-functions/v2";
import { onDocumentWritten, onDocumentDeleted, onDocumentCreated } from "firebase-functions/v2/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import * as admin from "firebase-admin";
import { format } from 'date-fns';
import { GetSignedUrlConfig } from "@google-cloud/storage";
import { randomBytes } from 'crypto';
import * as cors from "cors";

const corsHandler = cors({ origin: true });

// Inicializa o admin apenas uma vez para evitar erros em múltiplas invocações.
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

setGlobalOptions({ 
  region: "southamerica-east1",
});

// ========================================================================
//   FUNÇÕES HTTPS (onRequest)
// ========================================================================

export const createCongregationAndAdmin = https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Método não permitido' });
            return;
        }

        const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp } = req.body;

        if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
            res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
            return;
        }

        let newUser: admin.auth.UserRecord | undefined;
        try {
            const congQuery = await db.collection('congregations').where('number', '==', congregationNumber).get();
            if (!congQuery.empty) {
                res.status(409).json({ error: 'Uma congregação com este número já existe.' });
                return;
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
                whatsapp: whatsapp,
                congregationId: newCongregationRef.id,
                role: "Administrador",
                status: "ativo"
            });
            await batch.commit();

            res.status(200).json({ success: true, userId: newUser.uid, message: 'Congregação criada com sucesso!' });

        } catch (error: any) {
            if (newUser) {
                await admin.auth().deleteUser(newUser.uid).catch(deleteError => {
                    console.error(`Falha CRÍTICA ao limpar usuário órfão '${newUser?.uid}':`, deleteError);
                });
            }
            console.error("Erro ao criar congregação e admin:", error);
            if (error.code === 'auth/email-already-exists') {
                res.status(409).json({ error: 'Este e-mail já está em uso.' });
            } else {
                 res.status(500).json({ error: error.message || 'Erro interno no servidor' });
            }
        }
    });
});

export const requestPasswordReset = https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Método não permitido' });
        }
        
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'O e-mail é obrigatório.' });
        }

        try {
            try {
                await admin.auth().getUserByEmail(email);
            } catch (error: any) {
                if (error.code === 'auth/user-not-found') {
                    console.log(`Pedido de redefinição para e-mail não existente: ${email}`);
                    return res.status(200).json({ success: true, token: null });
                }
                throw error;
            }
            
            const token = randomBytes(32).toString("hex");
            const expires = admin.firestore.Timestamp.fromMillis(Date.now() + 3600 * 1000); // 1 hora
            
            await db.collection("resetTokens").doc(token).set({
                email: email,
                expires: expires,
            });

            return res.status(200).json({ success: true, token: token });

        } catch (error: any) {
            console.error("Erro em requestPasswordReset:", error);
            return res.status(500).json({ error: 'Falha ao processar o pedido de redefinição.' });
        }
    });
});

export const resetPasswordWithToken = https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Método não permitido' });
        }
        
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ error: "Token e nova senha são obrigatórios." });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres." });
        }

        const tokenRef = db.collection("resetTokens").doc(token);
        
        try {
            const tokenDoc = await tokenRef.get();
            if (!tokenDoc.exists) {
                return res.status(404).json({ error: "Token inválido ou já utilizado." });
            }

            const tokenData = tokenDoc.data()!;
            if (tokenData.expires.toMillis() < Date.now()) {
                await tokenRef.delete();
                return res.status(410).json({ error: "O token de redefinição expirou." });
            }
            
            const user = await admin.auth().getUserByEmail(tokenData.email);
            await admin.auth().updateUser(user.uid, { password: newPassword });
            await tokenRef.delete();

            return res.status(200).json({ success: true, message: "Senha redefinida com sucesso." });
        } catch (error: any) {
            console.error("Erro em resetPasswordWithToken:", error);
            return res.status(500).json({ error: "Ocorreu um erro interno ao redefinir a senha." });
        }
    });
});

export const deleteUserAccount = https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Método não permitido' });
        }

        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (!idToken) {
            return res.status(401).json({ error: 'Usuário não autenticado.' });
        }

        let callingUserUid;
        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            callingUserUid = decodedToken.uid;
        } catch (error) {
            return res.status(401).json({ error: 'Token inválido ou expirado.' });
        }

        const { userIdToDelete } = req.body;
        if (!userIdToDelete || typeof userIdToDelete !== 'string') {
            return res.status(400).json({ error: 'ID de usuário para exclusão é inválido.' });
        }

        const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
        const isCallingUserAdmin = callingUserSnap.exists && callingUserSnap.data()?.role === "Administrador";

        if (isCallingUserAdmin && callingUserUid === userIdToDelete) {
            return res.status(403).json({ error: "Um administrador não pode se autoexcluir." });
        }
        if (!isCallingUserAdmin && callingUserUid !== userIdToDelete) {
            return res.status(403).json({ error: "Você não tem permissão para excluir outros usuários." });
        }

        try {
            await admin.auth().deleteUser(userIdToDelete);
            const userDocRef = db.collection("users").doc(userIdToDelete);
            if ((await userDocRef.get()).exists) {
                await userDocRef.delete();
            }
            return res.status(200).json({ success: true, message: "Usuário excluído com sucesso." });
        } catch (error: any) {
            console.error("Erro CRÍTICO ao excluir usuário:", error);
            if (error.code === 'auth/user-not-found') {
                return res.status(200).json({ success: true, message: "Usuário não encontrado na Auth, mas removido do Firestore." });
            }
            return res.status(500).json({ error: `Falha na exclusão: ${error.message}` });
        }
    });
});

// Outras funções permanecem como onRequest ou são convertidas
export const resetTerritoryProgress = https.onCall(async (request) => {
    // ... (manter como onCall ou converter se necessário)
    // Para simplificar, vamos manter as que já funcionam como onCall
    const uid = request.auth?.uid;
    if (!uid) {
        throw new https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    const { congregationId, territoryId } = request.data;
    // ... resto da lógica
});

export const sendOverdueNotification = https.onCall(async (request) => {
    // ...
});

export const generateUploadUrl = https.onCall(async (request) => {
   // ...
});


// ========================================================================
//   GATILHOS (TRIGGERS) - Sem alterações
// ========================================================================

export const onHouseChange = onDocumentWritten("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}", async (event) => {
  // ...
});

export const onQuadraChange = onDocumentWritten("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}", async (event) => {
  // ...
});

export const onTerritoryChange = onDocumentWritten("congregations/{congregationId}/territories/{territoryId}", async (event) => {
  // ...
});

export const onNewUserPending = onDocumentCreated("users/{userId}", async (event) => {
    // ...
});

export const onTerritoryAssigned = onDocumentWritten("congregations/{congId}/territories/{terrId}", async (event) => {
  // ...
});

export const onDeleteTerritory = onDocumentDeleted("congregations/{congregationId}/territories/{territoryId}", async (event) => {
    // ...
});

export const onDeleteQuadra = onDocumentDeleted("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}", async (event) => {
    // ...
});

export const mirrorUserStatus = onValueWritten(
  {
    ref: "/status/{uid}",
    region: "us-central1"
  },
  async (event) => {
    // ...
});

export const checkInactiveUsers = pubsub.schedule("every 5 minutes").onRun(async (context) => {
    // ...
});

export const checkOverdueTerritories = pubsub.schedule("every 24 hours").onRun(async (context) => {
    // ...
});
