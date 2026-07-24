
// src/lib/audit.ts
import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

function removeUndefinedFields(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(removeUndefinedFields);
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = removeUndefinedFields(value);
    }
  }
  return cleaned;
}

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
      metadata: removeUndefinedFields(metadata),
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn("Erro ao registrar evento de auditoria:", e);
  }
}

