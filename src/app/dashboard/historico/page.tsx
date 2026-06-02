
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, getDocs, doc, Timestamp, writeBatch, setDoc, updateDoc, getDoc, deleteField, runTransaction, where } from 'firebase/firestore';
import { AuditLog, Territory, Activity, Quadra, Casa } from '@/types/types';
import { Loader, History, Search, Filter, Clock, User, Info, RefreshCw, Trash2, Undo2, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import withAuth from '@/components/withAuth';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { logEvent } from '@/lib/audit';

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

  // --- FUNÇÃO DE RECONSTRUÇÃO AUTOMÁTICA ---
  // Esta função vasculha o banco de dados em busca de atividades que ocorreram
  // antes da criação do sistema de log centralizado e as traz para cá.
  useEffect(() => {
    const runReconstruction = async () => {
        if (!user?.congregationId || !isAdmin || hasReconstructed) return;
        
        setIsReconstructing(true);
        try {
            const congregationId = user.congregationId;
            const territoriesRef = collection(db, 'congregations', congregationId, 'territories');
            const territoriesSnap = await getDocs(territoriesRef);
            
            // Buscar o que já existe no log para não duplicar
            const existingLogsQuery = query(
                collection(db, 'congregations', congregationId, 'auditLogs'), 
                where('action', '==', 'HOUSE_COMPLETED')
            );
            const existingLogsSnap = await getDocs(existingLogsQuery);
            const existingDetails = new Set(existingLogsSnap.docs.map(d => d.data().details));

            const batch = writeBatch(db);
            let addedCount = 0;

            for (const tDoc of territoriesSnap.docs) {
                const historyRef = collection(tDoc.ref, 'activityHistory');
                const historySnap = await getDocs(historyRef);
                
                historySnap.forEach(hDoc => {
                    const hData = hDoc.data();
                    // Se for um registro de trabalho que não está no log central, recuperamos ele
                    if (hData.type === 'work' && !existingDetails.has(hData.description)) {
                        const logRef = doc(collection(db, 'congregations', congregationId, 'auditLogs'));
                        batch.set(logRef, {
                            userId: hData.userId || 'system',
                            userName: hData.userName || 'Sistema',
                            action: 'HOUSE_COMPLETED',
                            details: `[Recuperado] ${hData.description}`,
                            timestamp: hData.activityDate,
                            metadata: { 
                                territoryId: tDoc.id, 
                                isRecovered: true,
                                originalActivityId: hDoc.id 
                            }
                        });
                        addedCount++;
                        
                        // Limitamos o lote para evitar erros de transação muito grande
                        if (addedCount >= 400) return; 
                    }
                });
                if (addedCount >= 400) break;
            }

            if (addedCount > 0) {
                await batch.commit();
            }
        } catch (error: any) {
            console.error("Erro na reconstrução automática:", error);
        } finally {
            setIsReconstructing(false);
            setHasReconstructed(true);
        }
    };

    runReconstruction();
  }, [user?.congregationId, isAdmin, hasReconstructed]);


  // Função para buscar os logs principais do Firestore
  const fetchLogs = useCallback((isManualRefresh = false) => {
    if (!user?.congregationId || !isAdmin) return;

    if (isManualRefresh) setIsRefreshing(true);
    else setLoading(true);

    const logsPath = `congregations/${user.congregationId}/auditLogs`;
    const logsRef = collection(db, logsPath);
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(1000));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AuditLog));
      setLogs(logsData);
      setLoading(false);
      setIsRefreshing(false);
    }, async (error) => {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: logsPath,
                operation: 'list',
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        }
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
            const { territoryId, quadraId, ...casaData } = revertData;
            const houseRef = doc(db, 'congregations', congregationId, 'territories', territoryId, 'quadras', quadraId, 'casas', log.metadata.houseId);
            const quadraRef = doc(db, 'congregations', congregationId, 'territories', territoryId, 'quadras', quadraId);
            const territoryRef = doc(db, 'congregations', congregationId, 'territories', territoryId);
            const congRef = doc(db, 'congregations', congregationId);

            await runTransaction(db, async (transaction) => {
                const [qDoc, tDoc, cDoc] = await Promise.all([
                    transaction.get(quadraRef),
                    transaction.get(territoryRef),
                    transaction.get(congRef)
                ]);

                if (!qDoc.exists() || !tDoc.exists() || !cDoc.exists()) throw new Error("Dependência não encontrada.");

                transaction.set(houseRef, casaData);
                
                const increment = 1;
                const wasDone = casaData.status === true;

                transaction.update(quadraRef, {
                    totalHouses: (qDoc.data().totalHouses || 0) + increment,
                    housesDone: (qDoc.data().housesDone || 0) + (wasDone ? 1 : 0)
                });

                const newTTotal = (tDoc.data().stats.totalHouses || 0) + increment;
                const newTDone = (tDoc.data().stats.housesDone || 0) + (wasDone ? 1 : 0);
                transaction.update(territoryRef, {
                    "stats.totalHouses": newTTotal,
                    "stats.housesDone": newTDone,
                    progress: newTTotal > 0 ? newTDone / newTTotal : 0
                });

                transaction.update(congRef, {
                    totalHouses: (cDoc.data().totalHouses || 0) + increment,
                    totalHousesDone: (cDoc.data().totalHousesDone || 0) + (wasDone ? 1 : 0)
                });
            });

            logEvent(congregationId, user.uid, user.name, 'REVERT_ACTION', `Reverteu a exclusão da casa ${casaData.number} no território ${log.metadata.territoryId}.`);
            toast({ title: "Ação Revertida!", description: `A casa ${casaData.number} foi restaurada.` });
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
            logEvent(congregationId, user.uid, user.name, 'REVERT_ACTION', `Restaurou o território ${territory.number} - ${territory.name} da lixeira.`);
            toast({ title: "Território Restaurado!", description: `O mapa ${territory.number} está de volta.` });
        }

    } catch (e: any) {
        console.error("Erro na reversão:", e);
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
        (actionFilter === 'creations' && log.action.includes('CREATED')) ||
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
      case 'TERRITORY_CREATED': return <Badge className="bg-blue-600">Novo Território</Badge>;
      case 'TERRITORY_DELETED': return <Badge variant="destructive"><Trash2 size={10} className="mr-1"/> Território Excluído</Badge>;
      case 'TERRITORY_RESET': return <Badge className="bg-orange-500">Limpeza</Badge>;
      case 'TERRITORY_ASSIGNED': return <Badge className="bg-blue-500">Designação</Badge>;
      case 'TERRITORY_RETURNED': return <Badge className="bg-teal-500">Devolução</Badge>;
      case 'USER_DELETED': return <Badge variant="destructive"><Trash2 size={10} className="mr-1"/> Usuário Excluído</Badge>;
      case 'USER_APPROVED': return <Badge className="bg-green-600">Aprovação</Badge>;
      case 'USER_EDITED': return <Badge variant="outline">Usuário Editado</Badge>;
      case 'TERRITORY_EDITED': return <Badge variant="outline">Território Editado</Badge>;
      case 'HOUSE_EDITED': return <Badge variant="outline">Casa Editada</Badge>;
      case 'CASAS_REORDERED': return <Badge className="bg-purple-500">Reordenação</Badge>;
      case 'REVERT_ACTION': return <Badge className="bg-indigo-500">Ação Revertida</Badge>;
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
          <p className="text-muted-foreground text-sm">Consultando registros diretamente do banco de dados em tempo real.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {isReconstructing ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20">
                    <Loader className="animate-spin h-3 w-3" />
                    Sincronizando Histórico Antigo...
                </div>
            ) : hasReconstructed && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-500 text-xs font-bold border border-green-500/20">
                    <CheckCircle2 className="h-3 w-3" />
                    Histórico antigo sincronizado
                </div>
            )}
            <Button variant="outline" size="sm" onClick={() => fetchLogs(true)} disabled={isRefreshing}>
                <RefreshCw size={14} className={isRefreshing ? "animate-spin mr-2" : "mr-2"} />
                Sincronizar
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="Buscar por usuário, ação ou detalhe..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="md:col-span-2">
            <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
                <div className="flex items-center gap-2">
                <Filter size={16} />
                <SelectValue placeholder="Filtrar por tipo de alteração" />
                </div>
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Todas as alterações</SelectItem>
                <SelectItem value="deletions">Apenas Exclusões</SelectItem>
                <SelectItem value="creations">Apenas Criações</SelectItem>
                <SelectItem value="HOUSE_COMPLETED">Marcação de Casas</SelectItem>
                <SelectItem value="TERRITORY_ASSIGNED">Designações</SelectItem>
                <SelectItem value="TERRITORY_RETURNED">Devoluções</SelectItem>
                <SelectItem value="USER_APPROVED">Aprovação de Usuários</SelectItem>
            </SelectContent>
            </Select>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/40 shadow-md overflow-hidden">
        {loading ? (
           <div className="p-12 text-center">
              <Loader className="animate-spin text-primary mx-auto" size={32} />
              <p className="text-muted-foreground mt-4">Consultando banco de dados...</p>
           </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Data e Hora</th>
                  <th className="px-6 py-4">Usuário</th>
                  <th className="px-6 py-4">Ação</th>
                  <th className="px-6 py-4">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className={cn("hover:bg-white/[0.02] transition-colors", log.metadata?.isRecovered && "bg-blue-500/5")}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock size={14} />
                          {log.timestamp ? format(log.timestamp.toDate(), "dd/yy HH:mm", { locale: ptBR }) : '...'}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-primary" />
                          {log.userName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2 items-start">
                            {getActionBadge(log.action)}
                            {log.metadata?.revertData && isAdmin && (
                                <Button 
                                    variant="secondary" 
                                    size="xs" 
                                    className="h-7 text-[10px] font-bold"
                                    disabled={revertingIds.has(log.id)}
                                    onClick={() => handleRevertAction(log)}
                                >
                                    {revertingIds.has(log.id) ? <Loader className="animate-spin mr-1 h-3 w-3"/> : <Undo2 size={12} className="mr-1"/>}
                                    Reverter
                                </Button>
                            )}
                            {log.metadata?.isRecovered && (
                                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-tighter flex items-center gap-1">
                                    <AlertCircle size={8} /> Registro Recuperado
                                </span>
                            )}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs sm:max-w-md">
                        <div className="flex items-start gap-2">
                          <Info size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                          <span className="leading-relaxed text-muted-foreground">{log.details}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground italic">
                      Nenhum registro encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default withAuth(HistoricoPage);
