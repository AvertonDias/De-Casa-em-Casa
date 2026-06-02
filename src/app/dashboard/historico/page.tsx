
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, getDocs, doc, Timestamp, writeBatch, runTransaction, where, getDoc } from 'firebase/firestore';
import { AuditLog, Territory, Quadra, Casa } from '@/types/types';
import { Loader, History, Search, Filter, Clock, User, Info, RefreshCw, Undo2, Trash2, X } from 'lucide-react';
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
  const [revertingIds, setRevertingIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const isAdmin = user?.role === 'Administrador';

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

            logEvent(congregationId, user.uid, user.name, 'REVERT_ACTION', `Restaurou a casa ${casaData.number} no território ${log.metadata.territoryNumber}.`);
            toast({ title: "Casa Restaurada!" });
        } 
        else if (log.action === 'QUADRA_DELETED') {
            const { territoryId, quadraId } = log.metadata;
            const { quadra, casas } = revertData;
            const territoryRef = doc(db, 'congregations', congregationId, 'territories', territoryId);
            const quadraRef = doc(territoryRef, 'quadras', quadraId);
            const congRef = doc(db, 'congregations', congregationId);
            
            await runTransaction(db, async (transaction) => {
                const terrSnap = await transaction.get(territoryRef);
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
            const congRef = doc(db, 'congregations', congregationId);

            await runTransaction(db, async (transaction) => {
                const congSnap = await transaction.get(congRef);
                
                transaction.set(territoryRef, territory);

                for (const q of quadras) {
                    const qRef = doc(territoryRef, 'quadras', q.id);
                    const { casas, ...qMeta } = q;
                    transaction.set(qRef, qMeta);
                    for (const c of casas) {
                        const cRef = doc(qRef, 'casas', c.id);
                        const { id, ...cData } = c;
                        transaction.set(cRef, cData);
                    }
                }

                if (congSnap.exists()) {
                    const cData = congSnap.data();
                    const housesToAdd = territory.stats?.totalHouses || 0;
                    const housesDoneToAdd = territory.stats?.housesDone || 0;
                    
                    transaction.update(congRef, {
                        territoryCount: (cData.territoryCount || 0) + (territory.type === 'rural' ? 0 : 1),
                        ruralTerritoryCount: (cData.ruralTerritoryCount || 0) + (territory.type === 'rural' ? 1 : 0),
                        totalHouses: (cData.totalHouses || 0) + housesToAdd,
                        totalHousesDone: (cData.totalHousesDone || 0) + housesDoneToAdd
                    });
                }
            });

            logEvent(congregationId, user.uid, user.name, 'REVERT_ACTION', `Restaurou o território ${territory.number}.`);
            toast({ title: "Território Restaurado!" });
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

  const formatDetails = (log: AuditLog) => {
    let details = (log.details || '').replace(/^\[Recuperado\]\s*/i, '');
    if (log.metadata?.territoryNumber) {
      const id = log.metadata.territoryId;
      if (id && details.includes(id)) {
        details = details.split(id).join(log.metadata.territoryNumber);
      }
    }
    return details;
  };

  const filteredLogs = useMemo(() => {
    const filtered = logs.filter(log => {
      const term = searchTerm.toLowerCase();
      const details = formatDetails(log);
      const matchesSearch = 
        log.userName?.toLowerCase().includes(term) || 
        details?.toLowerCase().includes(term) ||
        log.action?.toLowerCase().includes(term);
      
      const matchesAction = actionFilter === 'all' || 
        (actionFilter === 'deletions' && (log.action.includes('DELETED') || log.action.includes('UNMARKED'))) ||
        log.action === actionFilter;

      return matchesSearch && matchesAction;
    });

    const uniqueLogs: AuditLog[] = [];
    const seen = new Set<string>();

    filtered.forEach(log => {
        const timeKey = Math.floor(log.timestamp.toMillis() / 1000);
        const uniqueKey = `${log.userId}-${log.action}-${log.details}-${timeKey}`;
        
        if (!seen.has(uniqueKey)) {
            uniqueLogs.push(log);
            seen.add(uniqueKey);
        }
    });

    return uniqueLogs;
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
      case 'USER_APPROVED': return <Badge className="bg-green-600">Aprovação</Badge>;
      case 'USER_EDITED': return <Badge variant="outline">Usuário Editado</Badge>;
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
          <p className="text-muted-foreground text-sm">Consultando registros em tempo real.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchLogs(true)} disabled={isRefreshing}>
            <RefreshCw size={14} className={isRefreshing ? "animate-spin mr-2" : "mr-2"} /> Sincronizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <div className="md:col-span-2">
            <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
                <SelectValue placeholder="Filtrar por ação" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="deletions">Exclusões</SelectItem>
                <SelectItem value="HOUSE_COMPLETED">Marcação de Casas</SelectItem>
                <SelectItem value="TERRITORY_ASSIGNED">Designações</SelectItem>
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
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">{log.timestamp ? format(log.timestamp.toDate(), "dd/MM HH:mm", { locale: ptBR }) : '...'}</td>
                      <td className="px-6 py-4 font-bold">{log.userName}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2 items-start">
                            {getActionBadge(log.action)}
                            {log.metadata?.revertData && isAdmin && (
                                <Button variant="info" size="sm" className="h-7 text-[10px] font-bold" disabled={revertingIds.has(log.id)} onClick={() => handleRevertAction(log)}>
                                    {revertingIds.has(log.id) ? <Loader className="animate-spin mr-1 h-3 w-3"/> : <Undo2 size={12} className="mr-1"/>} Reverter
                                </Button>
                            )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{formatDetails(log)}</td>
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
