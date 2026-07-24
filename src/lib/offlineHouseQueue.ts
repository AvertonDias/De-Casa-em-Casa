"use client";

import { db } from "@/lib/firebase";
import { doc, runTransaction, serverTimestamp, Timestamp, collection } from "firebase/firestore";
import type { Casa } from "@/types/types";

export interface PendingHouseAction {
  id: string;
  congregationId: string;
  territoryId: string;
  quadraId: string;
  casaId: string;
  casaNumber?: string;
  actionType: 'toggleStatus' | 'updateCasa';
  newStatus?: boolean;
  casaData?: Partial<Casa>;
  userName?: string;
  userUid?: string;
  createdAt: number;
}

const DB_NAME = "TerritorioOfflineDB";
const DB_VERSION = 1;
const STORE_NAME = "pendingHouseActions";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return reject(new Error("IndexedDB não é suportado neste ambiente."));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("casaId", "casaId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueuePendingHouseAction(action: Omit<PendingHouseAction, "id" | "createdAt">): Promise<PendingHouseAction> {
  const fullAction: PendingHouseAction = {
    ...action,
    id: `house_action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    createdAt: Date.now(),
  };

  try {
    const idb = await openDB();
    const tx = idb.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    await new Promise<void>((resolve, reject) => {
      const req = store.put(fullAction);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    notifyQueueChanged();
  } catch (err) {
    console.warn("Erro ao salvar ação no IndexedDB:", err);
  }

  return fullAction;
}

export async function getPendingHouseActions(): Promise<PendingHouseAction[]> {
  try {
    const idb = await openDB();
    const tx = idb.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    return new Promise<PendingHouseAction[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as PendingHouseAction[]) || [];
        items.sort((a, b) => a.createdAt - b.createdAt);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Erro ao buscar ações pendentes do IndexedDB:", err);
    return [];
  }
}

export async function removePendingHouseAction(id: string): Promise<void> {
  try {
    const idb = await openDB();
    const tx = idb.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    await new Promise<void>((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    notifyQueueChanged();
  } catch (err) {
    console.warn("Erro ao remover ação do IndexedDB:", err);
  }
}

export async function getOptimisticHouseStatus(casaId: string, defaultStatus: boolean): Promise<boolean> {
  try {
    const actions = await getPendingHouseActions();
    const houseActions = actions.filter(a => a.casaId === casaId && a.actionType === 'toggleStatus');
    if (houseActions.length > 0) {
      const last = houseActions[houseActions.length - 1];
      if (typeof last.newStatus === 'boolean') {
        return last.newStatus;
      }
    }
  } catch (err) {
    console.warn("Erro ao obter status otimista:", err);
  }
  return defaultStatus;
}

let isSyncing = false;

export async function processOfflineHouseQueue(): Promise<{ syncedCount: number; errorsCount: number }> {
  if (typeof window === 'undefined' || !navigator.onLine || isSyncing) {
    return { syncedCount: 0, errorsCount: 0 };
  }

  isSyncing = true;
  let syncedCount = 0;
  let errorsCount = 0;

  try {
    const actions = await getPendingHouseActions();
    if (actions.length === 0) {
      isSyncing = false;
      return { syncedCount: 0, errorsCount: 0 };
    }

    for (const action of actions) {
      try {
        const { congregationId, territoryId, quadraId, casaId, actionType, newStatus, casaData, userName, userUid } = action;

        const congRef = doc(db, 'congregations', congregationId);
        const territoryRef = doc(congRef, 'territories', territoryId);
        const quadraRef = doc(territoryRef, 'quadras', quadraId);
        const casaRef = doc(quadraRef, 'casas', casaId);
        const activityHistoryRef = collection(territoryRef, 'activityHistory');

        if (actionType === 'toggleStatus' && typeof newStatus === 'boolean') {
          await runTransaction(db, async (transaction) => {
            const congDoc = await transaction.get(congRef);
            const territoryDoc = await transaction.get(territoryRef);
            const quadraDoc = await transaction.get(quadraRef);
            const casaDoc = await transaction.get(casaRef);

            if (!congDoc.exists() || !territoryDoc.exists() || !quadraDoc.exists() || !casaDoc.exists()) {
              return;
            }

            const wasDone = casaDoc.data().status === true;
            if (wasDone === newStatus) {
              return;
            }

            const incrementAmount = newStatus ? 1 : -1;

            transaction.update(casaRef, {
              status: newStatus,
              lastWorkedBy: newStatus && userName ? { uid: userUid || 'offline_user', name: userName } : null
            });

            transaction.update(quadraRef, {
              housesDone: Math.max(0, (quadraDoc.data().housesDone || 0) + incrementAmount)
            });

            const territoryStats = territoryDoc.data().stats || { totalHouses: 0, housesDone: 0 };
            const newTerritoryHousesDone = Math.max(0, (territoryStats.housesDone || 0) + incrementAmount);
            const territoryTotalHouses = territoryStats.totalHouses || 0;
            const newTerritoryProgress = territoryTotalHouses > 0 ? newTerritoryHousesDone / territoryTotalHouses : 0;

            const territoryUpdateData: any = {
              "stats.housesDone": newTerritoryHousesDone,
              progress: newTerritoryProgress,
              lastUpdate: serverTimestamp()
            };
            if (newStatus) {
              territoryUpdateData.lastWorkedAt = serverTimestamp();
            }
            transaction.update(territoryRef, territoryUpdateData);

            transaction.update(congRef, {
              totalHousesDone: Math.max(0, (congDoc.data().totalHousesDone || 0) + incrementAmount)
            });

            if (newStatus) {
              const newActivityRef = doc(activityHistoryRef);
              transaction.set(newActivityRef, {
                type: "work",
                activityDate: Timestamp.now(),
                user: userName || "Publicador",
                notes: `Trabalhou na quadra ${quadraDoc.data().name || quadraId} (casa ${action.casaNumber || casaDoc.data().number || ''})`,
                houseId: casaId,
                quadraId: quadraId
              });
            }
          });
        } else if (actionType === 'updateCasa' && casaData) {
          await runTransaction(db, async (transaction) => {
            const casaDoc = await transaction.get(casaRef);
            if (casaDoc.exists()) {
              transaction.update(casaRef, casaData);
            }
          });
        }

        await removePendingHouseAction(action.id);
        syncedCount++;
      } catch (itemErr) {
        console.warn(`Erro ao sincronizar ação ${action.id}:`, itemErr);
        errorsCount++;
      }
    }

    if (syncedCount > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline-house-sync-completed', { detail: { syncedCount } }));
    }
  } catch (err) {
    console.warn("Erro durante o processamento da fila offline:", err);
  } finally {
    isSyncing = false;
  }

  return { syncedCount, errorsCount };
}

function notifyQueueChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('offline-house-queue-changed'));
  }
}
