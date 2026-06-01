
// src/lib/audit.ts
import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Registra um evento no histórico de auditoria da congregação.
 * As regras do Firestore devem permitir a escrita para usuários autenticados da congregação.
 */
export async function logEvent(
  congregationId: string, 
  userId: string, 
  userName: string, 
  action: string, 
  details: string, 
  metadata: any = {}
) {
  try {
    const logsRef = collection(db, 'congregations', congregationId, 'auditLogs');
    await addDoc(logsRef, {
      userId,
      userName,
      action,
      details,
      metadata,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.error("Erro ao registrar evento de auditoria:", e);
  }
}
