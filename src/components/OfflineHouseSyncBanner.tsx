"use client";

import { useEffect, useState } from "react";
import { getPendingHouseActions, processOfflineHouseQueue, type PendingHouseAction } from "@/lib/offlineHouseQueue";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function OfflineHouseSyncBanner() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const updateStatus = async () => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);
    try {
      const actions = await getPendingHouseActions();
      setPendingCount(actions.length);
    } catch {
      setPendingCount(0);
    }
  };

  useEffect(() => {
    updateStatus();

    const handleOnline = async () => {
      setIsOnline(true);
      setIsSyncing(true);
      const { syncedCount } = await processOfflineHouseQueue();
      setIsSyncing(false);
      updateStatus();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleQueueChange = () => {
      updateStatus();
    };

    const handleSyncComplete = (e: any) => {
      const count = e.detail?.syncedCount || 0;
      if (count > 0) {
        toast({
          title: "⚡ Sincronização Concluída!",
          description: `${count} marcação(ões) de casa(s) salva(s) offline foram enviadas ao servidor.`,
          duration: 6000,
        });
      }
      updateStatus();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("offline-house-queue-changed", handleQueueChange);
    window.addEventListener("offline-house-sync-completed", handleSyncComplete);

    // Tentar sincronizar na montagem se já estiver online e houver pendências
    if (navigator.onLine) {
      processOfflineHouseQueue().then(() => updateStatus());
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("offline-house-queue-changed", handleQueueChange);
      window.removeEventListener("offline-house-sync-completed", handleSyncComplete);
    };
  }, [toast]);

  const handleManualSync = async () => {
    if (!navigator.onLine) {
      toast({
        title: "Dispositivo Offline",
        description: "Conecte-se à internet para sincronizar as marcações.",
        variant: "destructive",
      });
      return;
    }
    setIsSyncing(true);
    const { syncedCount, errorsCount } = await processOfflineHouseQueue();
    setIsSyncing(false);
    updateStatus();

    if (syncedCount > 0) {
      toast({
        title: "Sincronização realizada",
        description: `${syncedCount} alteração(ões) sincronizada(s) com sucesso.`,
      });
    } else if (errorsCount > 0) {
      toast({
        title: "Aviso de Sincronização",
        description: "Algumas alterações não puderam ser sincronizadas. Tentaremos novamente em breve.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Tudo atualizado",
        description: "Não há marcações pendentes de sincronização.",
      });
    }
  };

  if (pendingCount === 0 && isOnline) {
    return null;
  }

  return (
    <div className="w-full mb-4 px-4 py-2.5 rounded-lg border bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2 text-sm transition-all shadow-sm">
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        ) : (
          <RefreshCw className={`h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 ${isSyncing ? "animate-spin" : ""}`} />
        )}
        <span>
          {!isOnline
            ? `Você está offline. ${pendingCount} marcação(ões) salva(s) no dispositivo.`
            : `${pendingCount} marcação(ões) pendente(s) de sincronização.`}
        </span>
      </div>
      {isOnline && pendingCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleManualSync}
          disabled={isSyncing}
          className="h-8 px-3 text-xs border-amber-500/40 hover:bg-amber-500/20 text-amber-900 dark:text-amber-100"
        >
          {isSyncing ? (
            <>
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Sincronizar Agora
            </>
          )}
        </Button>
      )}
    </div>
  );
}
