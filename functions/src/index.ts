
// functions/src/index.ts
import { https, setGlobalOptions, pubsub } from "firebase-functions/v2";
import { onDocumentWritten, onDocumentDeleted, onDocumentCreated } from "firebase-functions/v2/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import * as admin from "firebase-admin";
import { format } from 'date-fns';
import { GetSignedUrlConfig } from "@google-cloud/storage";
import { randomBytes } from 'crypto';

// Inicializa o admin apenas uma vez.
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

setGlobalOptions({ 
  region: "southamerica-east1",
});

// ========================================================================
//   FUNÇÕES HTTPS (onCall) - Padrão Unificado
// ========================================================================

export const createCongregationAndAdmin = https.onCall(async (request) => {
    const { adminName, adminEmail, adminPassword, congregationName, congregationNumber, whatsapp } = request.data;

    if (!adminName || !adminEmail || !adminPassword || !congregationName || !congregationNumber || !whatsapp) {
        throw new https.HttpsError('invalid-argument', 'Todos os campos são obrigatórios.');
    }

    let newUser: admin.auth.UserRecord | undefined;
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
            whatsapp: whatsapp,
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
        if (error.code === 'auth/email-already-exists' || error.code === 'already-exists') {
            throw new https.HttpsError('already-exists', error.message);
        }
        throw new https.HttpsError('internal', error.message || 'Erro interno no servidor');
    }
});


export const requestPasswordReset = https.onCall(async (request) => {
    const { email } = request.data;
    if (!email) {
        throw new https.HttpsError('invalid-argument', 'O e-mail é obrigatório.');
    }

    try {
        try {
            await admin.auth().getUserByEmail(email);
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                console.log(`Pedido de redefinição para e-mail não existente: ${email}`);
                return { success: true, token: null }; 
            }
            throw error;
        }
        
        const token = randomBytes(32).toString("hex");
        const expires = admin.firestore.Timestamp.fromMillis(Date.now() + 3600 * 1000); // Token expira em 1 hora
        
        await db.collection("resetTokens").doc(token).set({
            email: email,
            expires: expires,
        });

        return { success: true, token: token };

    } catch (error: any) {
        console.error("Erro em requestPasswordReset:", error);
        throw new https.HttpsError('internal', 'Falha ao processar o pedido de redefinição.');
    }
});


export const resetPasswordWithToken = https.onCall(async (request) => {
    const { token, newPassword } = request.data;
    if (!token || !newPassword) {
        throw new https.HttpsError('invalid-argument', "Token e nova senha são obrigatórios.");
    }
    if (newPassword.length < 6) {
        throw new https.HttpsError('invalid-argument', "A senha deve ter no mínimo 6 caracteres.");
    }

    const tokenRef = db.collection("resetTokens").doc(token);
    
    try {
        const tokenDoc = await tokenRef.get();
        if (!tokenDoc.exists) {
            throw new https.HttpsError('not-found', "Token inválido ou já utilizado.");
        }

        const tokenData = tokenDoc.data()!;
        if (tokenData.expires.toMillis() < Date.now()) {
            await tokenRef.delete();
            throw new https.HttpsError('deadline-exceeded', "O token de redefinição expirou.");
        }
        
        const user = await admin.auth().getUserByEmail(tokenData.email);
        await admin.auth().updateUser(user.uid, { password: newPassword });
        await tokenRef.delete();

        return { success: true, message: "Senha redefinida com sucesso." };
    } catch (error: any) {
        console.error("Erro em resetPasswordWithToken:", error);
        if (error instanceof https.HttpsError) {
          throw error;
        }
        throw new https.HttpsError('internal', "Ocorreu um erro interno ao redefinir a senha.");
    }
});


export const deleteUserAccount = https.onCall(async (request) => {
    const callingUserUid = request.auth?.uid;
    if (!callingUserUid) {
        throw new https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    
    const { userIdToDelete } = request.data;
    if (!userIdToDelete || typeof userIdToDelete !== 'string') {
        throw new https.HttpsError("invalid-argument", "ID do usuário a ser deletado é inválido.");
    }

    const callingUserSnap = await db.collection("users").doc(callingUserUid).get();
    const isCallingUserAdmin = callingUserSnap.exists && callingUserSnap.data()?.role === "Administrador";

    if (isCallingUserAdmin && callingUserUid === userIdToDelete) {
        throw new https.HttpsError("permission-denied", "Um administrador não pode se autoexcluir.");
    }
    if (!isCallingUserAdmin && callingUserUid !== userIdToDelete) {
        throw new https.HttpsError("permission-denied", "Você não tem permissão para excluir outros usuários.");
    }

    try {
        await admin.auth().deleteUser(userIdToDelete);
        const userDocRef = db.collection("users").doc(userIdToDelete);
        if ((await userDocRef.get()).exists) {
            await userDocRef.delete();
        }
        return { success: true, message: "Usuário excluído com sucesso." };
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


export const resetTerritoryProgress = https.onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new https.HttpsError("unauthenticated", "Ação não autorizada.");
    }
    
    const { congregationId, territoryId } = request.data;
    if (!congregationId || !territoryId) {
        throw new https.HttpsError("invalid-argument", "IDs da congregação e do território são necessários.");
    }

    const adminUserSnap = await db.collection("users").doc(uid).get();
    if (adminUserSnap.data()?.role !== "Administrador") {
        throw new https.HttpsError("permission-denied", "Ação restrita a administradores.");
    }

    const historyPath = `congregations/${congregationId}/territories/${territoryId}/activityHistory`;
    const quadrasRef = db.collection(`congregations/${congregationId}/territories/${territoryId}/quadras`);
    
    try {
        await db.recursiveDelete(db.collection(historyPath));
    } catch (error) {
        console.error(`[resetTerritory] Falha ao deletar histórico para ${territoryId}:`, error);
        throw new https.HttpsError("internal", "Falha ao limpar histórico do território.");
    }

    try {
        let housesUpdatedCount = 0;
        await db.runTransaction(async (transaction) => {
            const quadrasSnapshot = await transaction.get(quadrasRef);
            const housesToUpdate: { ref: admin.firestore.DocumentReference, data: { status: boolean } }[] = [];

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
            return { success: true, message: `Sucesso! ${housesUpdatedCount} casas no território foram resetadas.` };
        } else {
            return { success: true, message: "Nenhuma alteração necessária, nenhuma casa estava marcada como 'feita'." };
        }

    } catch (error: any) {
        console.error(`[resetTerritory] FALHA CRÍTICA na transação ao limpar o território ${territoryId}:`, error);
        throw new https.HttpsError("internal", "Falha ao processar a limpeza das casas do território.");
    }
});


export const generateUploadUrl = https.onCall(async (request) => {
  if (!request.auth) {
    throw new https.HttpsError('unauthenticated', 'Ação não autorizada.');
  }

  const { filePath, contentType } = request.data;
  if (!filePath || typeof filePath !== 'string' || !contentType) {
    throw new https.HttpsError('invalid-argument', 'Caminho do arquivo e tipo de conteúdo são necessários.');
  }
  
  const options: GetSignedUrlConfig = {
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutos
      contentType: contentType,
  };

  try {
      const [url] = await admin.storage().bucket().file(filePath).getSignedUrl(options);
      return { success: true, url };
  } catch (error: any) {
      console.error("Erro ao gerar URL assinada:", error);
      throw new https.HttpsError('internal', 'Falha ao criar URL de upload.', error.message);
  }
});

// ========================================================================
//   GATILHOS (TRIGGERS)
// ========================================================================

export const onHouseChange = onDocumentWritten("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}/casas/{casaId}", async (event) => {
    // ... (lógica inalterada)
});

export const onQuadraChange = onDocumentWritten("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}", async (event) => {
    // ... (lógica inalterada)
});

export const onTerritoryChange = onDocumentWritten("congregations/{congregationId}/territories/{territoryId}", async (event) => {
    // ... (lógica inalterada)
});

export const onNewUserPending = onDocumentCreated("users/{userId}", async (event) => {
    // ... (lógica inalterada)
});

export const onTerritoryAssigned = onDocumentWritten("congregations/{congId}/territories/{terrId}", async (event) => {
    // ... (lógica inalterada)
});

export const onDeleteTerritory = onDocumentDeleted("congregations/{congregationId}/territories/{territoryId}", async (event) => {
    // ... (lógica inalterada)
});

export const onDeleteQuadra = onDocumentDeleted("congregations/{congregationId}/territories/{territoryId}/quadras/{quadraId}", async (event) => {
    // ... (lógica inalterada)
});

export const mirrorUserStatus = onValueWritten({ ref: "/status/{uid}", region: "us-central1" }, async (event) => {
    // ... (lógica inalterada)
});

export const checkInactiveUsers = pubsub.schedule("every 5 minutes").onRun(async (context) => {
    // ... (lógica inalterada)
});

export const checkOverdueTerritories = pubsub.schedule("every 24 hours").onRun(async (context) => {
    // ... (lógica inalterada)
});
