
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, getDocs, doc, Timestamp, writeBatch } from 'firebase/firestore';
import { AuditLog, Territory, Activity } from '@/types/types';
import { Loader, History, Search, Filter, X, Clock, User, Info, FileText, RefreshCw, Download, Sparkles, Trash2, CheckCircle2 } from 'lucide-react';
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

function HistoricoPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReconstructing, setIsReconstructing] = useState(false);
  const [hasReconstructed, setHasReconstructed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const isAdmin = user?.role === 'Administrador';

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

  // Função para reconstruir histórico antigo automaticamente
  const handleReconstructHistory = useCallback(async () => {
    if (!user?.congregationId || !isAdmin || isReconstructing || hasReconstructed) return;
    
    setIsReconstructing(true);

    try {
        const congregationId = user.congregationId;
        const territoriesRef = collection(db, 'congregations', congregationId, 'territories');
        const territoriesSnap = await getDocs(territoriesRef);
        
        const reconstructedLogs: AuditLog[] = [];
        
        for (const tDoc of territoriesSnap.docs) {
            const territory = { id: tDoc.id, ...tDoc.data() } as Territory;
            
            // 1. Recuperar do assignmentHistory (Designações)
            if (territory.assignmentHistory && territory.assignmentHistory.length > 0) {
                territory.assignmentHistory.forEach(history => {
                    const ts = history.completedAt instanceof Timestamp ? history.completedAt : Timestamp.now();
                    reconstructedLogs.push({
                        id: `rec_ret_${territory.id}_${history.assignedAt.toMillis()}`,
                        userId: history.uid,
                        userName: history.name,
                        action: 'TERRITORY_RETURNED',
                        details: `Devolveu o território ${territory.number} - ${territory.name}.`,
                        timestamp: ts,
                        metadata: { reconstructed: true, territoryId: territory.id }
                    });
                    
                    reconstructedLogs.push({
                        id: `rec_ass_${territory.id}_${history.assignedAt.toMillis()}`,
                        userId: 'system_reconstruction',
                        userName: 'Sistema (Histórico)',
                        action: 'TERRITORY_ASSIGNED',
                        details: `O território ${territory.number} foi designado para ${history.name}.`,
                        timestamp: history.assignedAt,
                        metadata: { reconstructed: true, territoryId: territory.id }
                    });
                });
            }

            // 2. Recuperar do activityHistory (Marcação de Casas)
            const activityRef = collection(db, 'congregations', congregationId, 'territories', territory.id, 'activityHistory');
            const activitySnap = await getDocs(activityRef);
            
            activitySnap.forEach(aDoc => {
                const activity = aDoc.data() as Activity;
                reconstructedLogs.push({
                    id: `rec_act_${aDoc.id}`,
                    userId: activity.userId,
                    userName: activity.userName,
                    action: activity.type === 'work' ? 'HOUSE_COMPLETED' : 'MANUAL_LOG',
                    details: `${activity.description || activity.notes}`,
                    timestamp: activity.activityDate,
                    metadata: { reconstructed: true, territoryId: territory.id }
                });
            });
        }

        if (reconstructedLogs.length > 0) {
            setLogs(prev => {
                const combined = [...prev, ...reconstructedLogs];
                const unique = combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
                return unique.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
            });
        }

        setHasReconstructed(true);
    } catch (error: any) {
        console.error("Erro na reconstrução automática:", error);
    } finally {
        setIsReconstructing(false);
    }
  }, [user?.congregationId, isAdmin, isReconstructing, hasReconstructed]);

  // Efeito para carregar os logs iniciais
  useEffect(() => {
    const unsubscribe = fetchLogs();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [fetchLogs]);

  // Gatilho automático para a sincronização de histórico antigo
  useEffect(() => {
    if (!loading && isAdmin && !hasReconstructed && !isReconstructing) {
      handleReconstructHistory();
    }
  }, [loading, isAdmin, hasReconstructed, isReconstructing, handleReconstructHistory]);

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

  const handleExport = () => {
    const data = filteredLogs.map(log => ({
      data: log.timestamp ? format(log.timestamp.toDate(), "dd/MM/yyyy HH:mm") : '',
      usuario: log.userName,
      acao: log.action,
      detalhes: log.details
    }));
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
    const link = document.createElement("a");
    link.setAttribute("href", jsonString);
    link.setAttribute("download", `audit_${format(new Date(), 'yyyy-MM-dd')}.json`);
    link.click();
  };

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
      case 'CASAS_REORDERED': return <Badge className="bg-purple-500">Reordenação</Badge>;
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
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold animate-pulse border border-blue-500/20">
                <Loader className="animate-spin" size={14} />
                Sincronizando histórico antigo...
              </div>
            ) : hasReconstructed ? (
               <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-500 text-xs font-bold border border-green-500/20">
                <CheckCircle2 size={14} />
                Histórico antigo sincronizado
              </div>
            ) : null}
            
            <Button variant="outline" size="sm" onClick={() => fetchLogs(true)} disabled={isRefreshing}>
                <RefreshCw size={14} className={isRefreshing ? "animate-spin mr-2" : "mr-2"} />
                Sincronizar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredLogs.length === 0}>
                <Download size={14} className="mr-2" />
                Exportar
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
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock size={14} />
                          {log.timestamp ? format(log.timestamp.toDate(), "dd/MM/yy HH:mm", { locale: ptBR }) : '...'}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-primary" />
                          {log.userName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getActionBadge(log.action)}
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
