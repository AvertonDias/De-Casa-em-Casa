
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, getDocs, doc, Timestamp, writeBatch, runTransaction, where, getDoc } from 'firebase/firestore';
import { AuditLog, Territory, Quadra, Casa } from '@/types/types';
import { Loader, History, Search, Filter, Clock, User, Info, RefreshCw, Undo2, Trash2, AlertCircle, Map, CheckCircle2, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import withAuth from '@/components/withAuth';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { logEvent } from '@/lib/audit';
import { cn } from '@/lib/utils';

function HistoricoPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReconstructing, setIsReconstructing] = useState(false);
  const [hasReconstructed, setHasReconstructed] = useState(false);
  const [revertingIds, setRevertingIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const isAdmin = user?.role === 'Administrador';

  // --- ARQUEOLOGIA DE DADOS (Recuperar registros perdidos do passado) ---
  useEffect(() => {
    const runReconstruction = async () => {
        if (!user?.congregationId || !isAdmin || hasReconstructed) return;
        
        setIsReconstructing(true);
        try {
            const congregationId = user.congregationId;
            const batch = writeBatch(db);
            let addedCount = 0;

            const territoriesRef = collection(db, 'congregations', congregationId, 'territories');
            const territoriesSnap = await getDocs(territoriesRef);
            
            const currentLogsRef = collection(db, 'congregations', congregationId, 'auditLogs');
            const currentLogsSnap = await getDocs(query(currentLogsRef, where('action', '==', 'HOUSE_COMPLETED')));
            const existingDetails = new Set(currentLogsSnap.docs.map(d => d.data().details));

            for (const tDoc of territoriesSnap.docs) {
                const tData = tDoc.data();
                const historyRef = collection(tDoc.ref, 'activityHistory');
                const historySnap = await getDocs(historyRef);

                historySnap.forEach(hDoc => {
                    const hData = hDoc.data();
                    const rawDetail = hData.description || hData.notes || `Casa marcada no território ${tData.number}.`;
                    const detailText = rawDetail.replace(/^\[Recuperado\]\s*/i, '');
                    
                    if (!existingDetails.has(detailText)) {
                        const newLogRef = doc(currentLogsRef);
                        batch.set(newLogRef, {
                            userId: hData.userId || 'past_sync',
                            userName: hData.userName || 'Sistema',
                            action: 'HOUSE_COMPLETED',
                            details: detailText.includes('território') ? detailText : `Marcou casa no território ${tData.number}. ${detailText}`,
                            timestamp: hData.activityDate || hData.createdAt || Timestamp.now(),
                            metadata: { territoryId: tDoc.id, isRecovered: true }
                        });
                        addedCount++;
                    }
                });
            }

            if (addedCount > 0) await batch.commit();
        } catch (error) {
            console.error("Erro na arqueologia de dados:", error);
        } finally {
            setIsReconstructing(false);
            setHasReconstructed(true);
        }
    };

    runReconstruction();
  }, [user?.congregationId, isAdmin, hasReconstructed]);


  const fetchLogs = useCallback((isManualRefresh = false) => {
    if (!user?.congregationId || !isAdmin) return;

    if (isManualRefresh) setIsRefreshing(true);
    else setLoading(true);

    const logsRef = collection(db, `congregations/${user.congregationId}/auditLogs`);
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(1000));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
      setLoading(false);
      setIsRefreshing(false);
    }, (error) => {
        console.error("Erro ao carregar histórico:", error);
        setLoading(false);
        setIsRefreshing(false);
    });

    return unsubscribe;
  }, [user?.congregationId, isAdmin]);

  useEffect(() => {
    const unsubscribe = fetchLogs();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [fetchLogs]);

  const handleRevertAction = async (log: AuditLog) => {
    if (!isAdmin || !user?.congregationId || !log.metadata?.revertData) return;
    
    setRevertingIds(prev => new Set(prev).add(log.id));
    const revertData = log.metadata.revertData;
    const congregationId = user.congregationId;

    try {
        if (log.action === 'HOUSE_DELETED') {
            const { territoryId, quadraId } = log.metadata;
            const { id, ...casaData } = revertData;
            const houseId = log.metadata.houseId || id;
            const houseRef = doc(db, 'congregations', congregationId, 'territories', territoryId, 'quadras', quadraId, 'casas', houseId);
            const quadraRef = doc(db, 'congregations', congregationId, 'territories', territoryId, 'quadras', quadraId);
            
            await runTransaction(db, async (transaction) => {
                const qSnap = await transaction.get(quadraRef);
                transaction.set(houseRef, casaData);
                if (qSnap.exists()) {
                    transaction.update(quadraRef, { 
                        totalHouses: (qSnap.data().totalHouses || 0) + 1,
                        housesDone: (qSnap.data().housesDone || 0) + (casaData.status ? 1 : 0)
                    });
                }
            });

            logEvent(congregationId, user.uid, user.name, 'REVERT_ACTION', `Restaurou a casa ${casaData.number} (do território ${log.metadata.territoryNumber}) que havia sido excluída.`);
            toast({ title: "Casa Restaurada!" });
        } 
        else if (log.action === 'QUADRA_DELETED') {
            const { territoryId, quadraId } = log.metadata;
            const { quadra, casas } = revertData;
            const territoryRef = doc(db, 'congregations', congregationId, 'territories', territoryId);
            const quadraRef = doc(territoryRef, 'quadras', quadraId);
            
            await runTransaction(db, async (transaction) => {
                const terrSnap = await transaction.get(territoryRef);
                const congRef = doc(db, 'congregations', congregationId);
                const congSnap = await transaction.get(congRef);

                transaction.set(quadraRef, quadra);
                for (const c of casas) {
                    const cRef = doc(quadraRef, 'casas', c.id);
                    const { id, ...cData } = c;
                    transaction.set(cRef, cData);
                }

                if (terrSnap.exists()) {
                    const tData = terrSnap.data();
                    const newTotal = (tData.stats?.totalHouses || 0) + (quadra.totalHouses || 0);
                    const newDone = (tData.stats?.housesDone || 0) + (quadra.housesDone || 0);
                    transaction.update(territoryRef, {
                        "stats.totalHouses": newTotal,
                        "stats.housesDone": newDone,
                        progress: newTotal > 0 ? newDone / newTotal : 0,
                        quadraCount: (tData.quadraCount || 0) + 1
                    });
                }

                if (congSnap.exists()) {
                    const cData = congSnap.data();
                    transaction.update(congRef, {
                        totalHouses: (cData.totalHouses || 0) + (quadra.totalHouses || 0),
                        totalHousesDone: (cData.totalHousesDone || 0) + (quadra.housesDone || 0)
                    });
                }
            });

            logEvent(congregationId, user.uid, user.name, 'REVERT_ACTION', `Restaurou a quadra "${quadra.name}" no território ${log.metadata.territoryNumber}.`);
            toast({ title: "Quadra Restaurada!" });
        }
        else if (log.action === 'TERRITORY_DELETED') {
            const { territory, quadras } = revertData;
            const territoryRef = doc(db, 'congregations', congregationId, 'territories', territory.id);
            
            const batch = writeBatch(db);
            batch.set(territoryRef, territory);

            for (const q of quadras) {
                const qRef = doc(territoryRef, 'quadras', q.id);
                const { casas, ...qMeta } = q;
                batch.set(qRef, qMeta);
                for (const c of casas) {
                    const cRef = doc(qRef, 'casas', c.id);
                    batch.set(cRef, c);
                }
            }

            await batch.commit();
            logEvent(congregationId, user.uid, user.name, 'REVERT_ACTION', `Restaurou o território ${territory.number} da lixeira.`);
            toast({ title: "Território Restaurado!" });
        }
        else if (log.action === 'HOUSE_COMPLETED' || log.action === 'HOUSE_UNMARKED') {
            const { territoryId, quadraId, houseId, previousStatus } = log.metadata;
            const houseRef = doc(db, 'congregations', congregationId, 'territories', territoryId, 'quadras', quadraId, 'casas', houseId);
            const quadraRef = doc(db, 'congregations', congregationId, 'territories', territoryId, 'quadras', quadraId);
            
            await runTransaction(db, async (transaction) => {
                const qSnap = await transaction.get(quadraRef);
                transaction.update(houseRef, { status: previousStatus });
                const increment = previousStatus ? 1 : -1;
                if (qSnap.exists()) {
                    transaction.update(quadraRef, { housesDone: Math.max(0, (qSnap.data().housesDone || 0) + increment) });
                }
            });
            toast({ title: "Marcação Revertida!" });
        }

    } catch (e: any) {
        console.error("Erro ao reverter:", e);
        toast({ title: "Erro ao reverter", description: e.message, variant: "destructive" });
    } finally {
        setRevertingIds(prev => {
            const next = new Set(prev);
            next.delete(log.id);
            return next;
        });
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        log.userName?.toLowerCase().includes(term) || 
        log.details?.toLowerCase().includes(term) ||
        log.action?.toLowerCase().includes(term);
      
      const matchesAction = actionFilter === 'all' || 
        (actionFilter === 'deletions' && (log.action.includes('DELETED') || log.action.includes('UNMARKED'))) ||
        log.action === actionFilter;

      return matchesSearch && matchesAction;
    });
  }, [logs, searchTerm, actionFilter]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'HOUSE_COMPLETED': return <Badge className="bg-green-500">Conclusão</Badge>;
      case 'HOUSE_UNMARKED': return <Badge variant="outline" className="text-yellow-500 border-yellow-500">Desmarcado</Badge>;
      case 'HOUSE_CREATED': return <Badge className="bg-blue-400">Novo Número</Badge>;
      case 'HOUSE_DELETED': return <Badge variant="destructive"><Trash2 size={10} className="mr-1"/> Casa Excluída</Badge>;
      case 'QUADRA_DELETED': return <Badge variant="destructive"><Trash2 size={10} className="mr-1"/> Quadra Excluída</Badge>;
      case 'TERRITORY_CREATED': return <Badge className="bg-blue-600">Novo Território</Badge>;
      case 'TERRITORY_DELETED': return <Badge variant="destructive"><Trash2 size={10} className="mr-1"/> Território Excluído</Badge>;
      case 'TERRITORY_DELETED_SUSPECT': return <Badge variant="destructive" className="animate-pulse">Exclusão Detectada</Badge>;
      case 'USER_DELETED': return <Badge variant="destructive">Usuário Excluído</Badge>;
      case 'USER_APPROVED': return <Badge className="bg-green-600">Aprovação</Badge>;
      case 'USER_EDITED': return <Badge variant="outline">Usuário Editado</Badge>;
      case 'TERRITORY_EDITED': return <Badge variant="outline">Território Editado</Badge>;
      case 'HOUSE_EDITED': return <Badge variant="outline">Casa Editada</Badge>;
      case 'REVERT_ACTION': return <Badge className="bg-indigo-500">Ação Revertida</Badge>;
      case 'TERRITORY_ASSIGNED': return <Badge className="bg-blue-500">Designação</Badge>;
      case 'TERRITORY_RETURNED': return <Badge className="bg-emerald-500">Devolução</Badge>;
      default: return <Badge variant="outline">{action.replace(/_/g, ' ')}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="text-primary" />
            Histórico de Alterações
          </h1>
          <p className="text-muted-foreground text-sm">Monitorando atividade em tempo real.</p>
        </div>
        <div className="flex items-center gap-2">
            {isReconstructing && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20">
                    <Loader className="animate-spin h-3 w-3" /> Sincronizando Passado...
                </div>
            )}
            <Button variant="outline" size="sm" onClick={() => fetchLogs(true)} disabled={isRefreshing}>
                <RefreshCw size={14} className={isRefreshing ? "animate-spin mr-2" : "mr-2"} /> Sincronizar
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input placeholder="Buscar por usuário, ação ou detalhe..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <div className="md:col-span-2">
            <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
                <div className="flex items-center gap-2"><Filter size={16} /><SelectValue placeholder="Filtrar por ação" /></div>
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="deletions">Exclusões e Desmarcações</SelectItem>
                <SelectItem value="HOUSE_COMPLETED">Marcação de Casas</SelectItem>
                <SelectItem value="TERRITORY_ASSIGNED">Designações</SelectItem>
                <SelectItem value="TERRITORY_RETURNED">Devoluções</SelectItem>
            </SelectContent>
            </Select>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/40 shadow-md overflow-hidden">
        {loading ? (
           <div className="p-12 text-center"><Loader className="animate-spin text-primary mx-auto" size={32} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground font-semibold uppercase text-xs">
                <tr><th className="px-6 py-4">Data</th><th className="px-6 py-4">Usuário</th><th className="px-6 py-4">Ação</th><th className="px-6 py-4">Detalhes</th></tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className={cn("hover:bg-white/[0.02] transition-colors", log.metadata?.isRecovered && "bg-blue-500/5")}>
                      <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center gap-2 text-muted-foreground"><Clock size={14} />{log.timestamp ? format(log.timestamp.toDate(), "dd/MM HH:mm", { locale: ptBR }) : '...'}</div></td>
                      <td className="px-6 py-4 font-bold"><div className="flex items-center gap-2"><User size={14} className="text-primary" />{log.userName}</div></td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2 items-start">
                            {getActionBadge(log.action)}
                            {log.metadata?.revertData && isAdmin && (
                                <Button variant="info" size="xs" className="h-7 text-[10px] font-bold" disabled={revertingIds.has(log.id)} onClick={() => handleRevertAction(log)}>
                                    {revertingIds.has(log.id) ? <Loader className="animate-spin mr-1 h-3 w-3"/> : <Undo2 size={12} className="mr-1"/>} Reverter
                                </Button>
                            )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-2">
                           <Info size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                           <div className="flex flex-col gap-1">
                               <span className="leading-relaxed text-muted-foreground">
                                 {log.details.replace(/^\[Recuperado\]\s*/i, '')}
                               </span>
                               {log.action === 'TERRITORY_DELETED_SUSPECT' && (
                                   <div className="text-[10px] bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 p-2 rounded border border-yellow-500/20 mt-1">
                                       <strong>Dica de Recuperação:</strong> Como este território foi excluído antes do sistema de lixeira, você pode usar a <strong>Recuperação Pontual (PITR)</strong> no console do Firebase para restaurar o banco para a data acima.
                                   </div>
                               )}
                           </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (<tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground italic">Nenhum registro encontrado.</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default withAuth(HistoricoPage);
