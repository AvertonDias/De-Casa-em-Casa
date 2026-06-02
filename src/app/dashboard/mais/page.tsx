
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BookUser, 
  BarChart3, 
  ClipboardList, 
  FileText, 
  History, 
  Settings, 
  ArrowLeft, 
  LayoutGrid,
  Search,
  Undo2,
  Loader,
  RefreshCw,
  X,
  Info,
  UserCheck,
  MapPin,
  Users
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import withAuth from '@/components/withAuth';
import { cn } from '@/lib/utils';
import TerritoryAssignmentPanel from '@/components/admin/TerritoryAssignmentPanel';
import TerritoryCoverageStats from '@/components/admin/TerritoryCoverageStats';
import AvailableTerritoriesReport from '@/components/admin/AvailableTerritoriesReport';
import S13ReportPage from '../administracao/relatorio-s13/page';
import CongregationEditForm from '@/components/admin/CongregationEditForm';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, doc, Timestamp, runTransaction, where } from 'firebase/firestore';
import { AuditLog, Territory } from '@/types/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { logEvent } from '@/lib/audit';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Section = 'menu' | 'assignment' | 'overview' | 'available' | 's13' | 'history' | 'settings';

function MaisPage() {
  const { user, congregation } = useUser();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<Section>('menu');
  
  // Estados do Histórico
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [territoryMap, setTerritoryMap] = useState<Record<string, string>>({}); // ID -> Number
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
  const [revertingIds, setRevertingIds] = useState<Set<string>>(new Set());
  const [searchTermLogs, setSearchTermLogs] = useState('');
  const [actionFilterLogs, setActionFilterLogs] = useState('all');

  const isAdmin = user?.role === 'Administrador';
  const isManager = user?.role === 'Administrador' || user?.role === 'Dirigente' || user?.role === 'Servo de Territórios' || user?.role === 'Ajudante de Servo de Territórios';

  // Buscar territórios para mapear IDs para números no histórico
  useEffect(() => {
    if (!user?.congregationId || !isManager) return;
    const terRef = collection(db, 'congregations', user.congregationId, 'territories');
    const unsub = onSnapshot(terRef, (snap) => {
        const mapping: Record<string, string> = {};
        snap.docs.forEach(doc => {
            mapping[doc.id] = doc.data().number;
        });
        setTerritoryMap(mapping);
    });
    return () => unsub();
  }, [user?.congregationId, isManager]);

  // Lógica de busca de logs
  const fetchLogs = useCallback((isManualRefresh = false) => {
    if (!user?.congregationId || !isAdmin) return;
    if (isManualRefresh) setIsRefreshingLogs(true);
    else setLoadingLogs(true);

    const logsRef = collection(db, `congregations/${user.congregationId}/auditLogs`);
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(1000));

    return onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
      setLoadingLogs(false);
      setIsRefreshingLogs(false);
    }, (error) => {
        console.error("Erro ao carregar histórico:", error);
        setLoadingLogs(false);
        setIsRefreshingLogs(false);
    });
  }, [user?.congregationId, isAdmin]);

  useEffect(() => {
    if (activeSection === 'history') {
      const unsub = fetchLogs();
      return () => unsub?.();
    }
  }, [activeSection, fetchLogs]);

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
                if (!qSnap.exists()) throw new Error("Quadra não encontrada.");
                
                transaction.set(houseRef, casaData);
                transaction.update(quadraRef, { 
                    totalHouses: (qSnap.data().totalHouses || 0) + 1,
                    housesDone: (qSnap.data().housesDone || 0) + (casaData.status ? 1 : 0)
                });
            });
            logEvent(congregationId, user.uid, user.name, 'REVERT_ACTION', `Restaurou a casa ${casaData.number} no território ${log.metadata.territoryNumber || territoryId}.`);
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
                casas.forEach((c: any) => transaction.set(doc(quadraRef, 'casas', c.id), c));
                
                if (terrSnap.exists()) {
                    const tData = terrSnap.data();
                    transaction.update(territoryRef, {
                        "stats.totalHouses": (tData.stats?.totalHouses || 0) + (quadra.totalHouses || 0),
                        "stats.housesDone": (tData.stats?.housesDone || 0) + (quadra.housesDone || 0),
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
            logEvent(congregationId, user.uid, user.name, 'REVERT_ACTION', `Restaurou a quadra "${quadra.name}" no território ${log.metadata.territoryNumber || territoryId}.`);
            toast({ title: "Quadra Restaurada!" });
        }
        else if (log.action === 'TERRITORY_DELETED') {
            const { territory: terrData, quadras: quadrasData } = revertData;
            const territoryRef = doc(db, 'congregations', congregationId, 'territories', terrData.id);
            const congRef = doc(db, 'congregations', congregationId);
            
            await runTransaction(db, async (transaction) => {
                const congSnap = await transaction.get(congRef);
                
                transaction.set(territoryRef, terrData);
                quadrasData.forEach((q: any) => {
                    const { casas, id, ...qMeta } = q;
                    const qRef = doc(territoryRef, 'quadras', id);
                    transaction.set(qRef, qMeta);
                    casas.forEach((c: any) => transaction.set(doc(qRef, 'casas', c.id), c));
                });
                
                if (congSnap.exists()) {
                    const cData = congSnap.data();
                    transaction.update(congRef, {
                        territoryCount: (cData.territoryCount || 0) + (terrData.type === 'rural' ? 0 : 1),
                        ruralTerritoryCount: (cData.ruralTerritoryCount || 0) + (terrData.type === 'rural' ? 1 : 0),
                        totalHouses: (cData.totalHouses || 0) + (terrData.stats?.totalHouses || 0),
                        totalHousesDone: (cData.totalHousesDone || 0) + (terrData.stats?.housesDone || 0)
                    });
                }
            });
            logEvent(congregationId, user.uid, user.name, 'REVERT_ACTION', `Restaurou o território ${terrData.number}.`);
            toast({ title: "Território Restaurado!" });
        }
    } catch (e: any) {
        toast({ title: "Erro ao reverter", description: e.message, variant: "destructive" });
    } finally {
        setRevertingIds(prev => { const next = new Set(prev); next.delete(log.id); return next; });
    }
  };

  const filteredLogs = useMemo(() => {
    const term = searchTermLogs.toLowerCase();
    
    // 1. Filtragem e Limpeza de IDs
    const filtered = logs.filter(log => {
      let details = (log.details || '').replace(/^\[Recuperado\]\s*/i, '');
      
      // Tentar substituir IDs técnicos por números de territórios na descrição para a busca
      Object.entries(territoryMap).forEach(([id, number]) => {
          if (details.includes(id)) {
              details = details.replace(new RegExp(id, 'g'), number);
          }
      });

      const matchesSearch = 
          log.userName?.toLowerCase().includes(term) || 
          details.toLowerCase().includes(term) || 
          log.action?.toLowerCase().includes(term);
      
      let matchesAction = true;
      if (actionFilterLogs === 'all') matchesAction = true;
      else if (actionFilterLogs === 'deletions') matchesAction = log.action.includes('DELETED') || log.action.includes('UNMARKED');
      else if (actionFilterLogs === 'creation') matchesAction = log.action.includes('CREATED');
      else if (actionFilterLogs === 'users') matchesAction = log.action.includes('USER_');
      else matchesAction = log.action === actionFilterLogs;

      return matchesSearch && matchesAction;
    });

    // 2. Deduplicação inteligente
    const uniqueLogs: AuditLog[] = [];
    const seen = new Set<string>();
    filtered.forEach(log => {
        const timeKey = Math.floor(log.timestamp.toMillis() / 1000);
        // Chave única baseada em usuário, ação e primeiros 50 caracteres do detalhe (para ignorar pequenas variações de ID)
        const detailsSnippet = (log.details || '').substring(0, 50);
        const uniqueKey = `${log.userId}-${log.action}-${detailsSnippet}-${timeKey}`;
        
        if (!seen.has(uniqueKey)) { 
            uniqueLogs.push(log); 
            seen.add(uniqueKey); 
        }
    });
    return uniqueLogs;
  }, [logs, searchTermLogs, actionFilterLogs, territoryMap]);

  const MenuCard = ({ id, label, description, icon: Icon, colorClass, adminOnly = false }: { id: Section, label: string, description: string, icon: any, colorClass: string, adminOnly?: boolean }) => {
    if (adminOnly && !isAdmin) return null;
    return (
      <button 
        onClick={() => setActiveSection(id)}
        className={cn(
          "flex flex-col items-start p-6 bg-card border border-border/40 rounded-2xl shadow-sm hover:shadow-md hover:border-primary/30 transition-all text-left group",
          "w-full h-full"
        )}
      >
        <div className={cn("p-3 rounded-xl mb-4 transition-transform group-hover:scale-110", colorClass)}>
          <Icon size={28} />
        </div>
        <h3 className="text-xl font-bold mb-1">{label}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </button>
    );
  };

  if (!user || !isManager) return <div className="p-8 text-center"><h1 className="font-bold text-xl">Acesso Negado</h1></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {activeSection === 'menu' ? (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-extrabold flex items-center gap-3">
              <LayoutGrid className="text-primary" size={36} />
              Mais Opções
            </h1>
            <p className="text-muted-foreground text-lg">Painel de ferramentas administrativas e histórico.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MenuCard 
                id="assignment" 
                label="Designar" 
                description="Atribuir territórios aos publicadores e gerenciar prazos."
                icon={BookUser}
                colorClass="bg-blue-500/10 text-blue-500"
            />
            <MenuCard 
                id="overview" 
                label="Estatísticas" 
                description="Estatísticas detalhadas de cobertura e progresso anual."
                icon={BarChart3}
                colorClass="bg-purple-500/10 text-purple-500"
            />
            <MenuCard 
                id="available" 
                label="Disponíveis" 
                description="Relatório de territórios prontos para serem designados."
                icon={ClipboardList}
                colorClass="bg-green-500/10 text-green-500"
            />
            <MenuCard 
                id="s13" 
                label="Relatório S-13" 
                description="Gerar o formulário oficial de designação de territórios."
                icon={FileText}
                colorClass="bg-orange-500/10 text-orange-500"
            />
            <MenuCard 
                id="history" 
                label="Histórico" 
                description="Consultar logs de auditoria e reverter exclusões acidentais."
                icon={History}
                colorClass="bg-indigo-500/10 text-indigo-500"
                adminOnly
            />
            <MenuCard 
                id="settings" 
                label="Configurações" 
                description="Gerenciar dados da congregação e modelos do WhatsApp."
                icon={Settings}
                colorClass="bg-gray-500/10 text-gray-400"
                adminOnly
            />
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => setActiveSection('menu')} className="mb-4 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2" size={18} /> Voltar ao Menu Principal
          </Button>

          {activeSection === 'assignment' && <TerritoryAssignmentPanel />}
          {activeSection === 'overview' && <TerritoryCoverageStats />}
          {activeSection === 'available' && <AvailableTerritoriesReport />}
          {activeSection === 's13' && <S13ReportPage />}
          {activeSection === 'settings' && <div className="max-w-2xl mx-auto"><CongregationEditForm onSaveSuccess={() => {}} /></div>}
          
          {activeSection === 'history' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-bold flex items-center gap-2"><History className="text-primary" /> Histórico</h2>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Info size={12} /> Mostrando os últimos 1000 registros para garantir a velocidade do sistema.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => fetchLogs(true)} disabled={isRefreshingLogs}>
                        <RefreshCw size={14} className={isRefreshingLogs ? "animate-spin mr-2" : "mr-2"} /> Sincronizar
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <Input placeholder="Buscar por usuário ou território..." value={searchTermLogs} onChange={(e) => setSearchTermLogs(e.target.value)} className="pl-10" />
                    </div>
                    <div className="md:col-span-2">
                        <Select value={actionFilterLogs} onValueChange={setActionFilterLogs}>
                            <SelectTrigger className="bg-card"><SelectValue placeholder="Filtrar por ação" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as ações</SelectItem>
                                <SelectItem value="HOUSE_COMPLETED">Marcação de Casas</SelectItem>
                                <SelectItem value="TERRITORY_ASSIGNED">Designações</SelectItem>
                                <SelectItem value="creation">Novos Territórios/Quadras</SelectItem>
                                <SelectItem value="users">Gestão de Usuários</SelectItem>
                                <SelectItem value="deletions">Exclusões e Desmarcações</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="bg-card rounded-xl border border-border/40 shadow-md overflow-hidden">
                    {loadingLogs ? (
                        <div className="p-12 text-center"><Loader className="animate-spin text-primary mx-auto" size={32} /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 text-muted-foreground font-semibold uppercase text-xs">
                                    <tr><th className="px-6 py-4">Data</th><th className="px-6 py-4">Usuário</th><th className="px-6 py-4">Ação</th><th className="px-6 py-4">Detalhes</th></tr>
                                </thead>
                                <tbody className="divide-y divide-border/20">
                                    {filteredLogs.length > 0 ? (
                                        filteredLogs.map((log) => {
                                            // Processar descrição para remover IDs técnicos na exibição
                                            let displayDetails = (log.details || '').replace(/^\[Recuperado\]\s*/i, '');
                                            Object.entries(territoryMap).forEach(([id, number]) => {
                                                if (displayDetails.includes(id)) {
                                                    displayDetails = displayDetails.replace(new RegExp(id, 'g'), number);
                                                }
                                            });

                                            return (
                                                <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground text-[10px]">
                                                        {log.timestamp ? format(log.timestamp.toDate(), "dd/MM HH:mm", { locale: ptBR }) : '...'}
                                                    </td>
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
                                                    <td className="px-6 py-4 text-muted-foreground text-xs leading-relaxed">
                                                        {displayDetails}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (<tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground italic">Nenhum registro encontrado.</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const getActionBadge = (action: string) => {
    switch (action) {
      case 'HOUSE_COMPLETED': return <Badge className="bg-green-500">Conclusão</Badge>;
      case 'HOUSE_UNMARKED': return <Badge variant="outline" className="text-yellow-500 border-yellow-500">Desmarcado</Badge>;
      case 'HOUSE_CREATED': return <Badge className="bg-blue-400"><MapPin size={10} className="mr-1"/>Novo Número</Badge>;
      case 'HOUSE_EDITED': return <Badge variant="outline">Casa Editada</Badge>;
      case 'HOUSE_DELETED': return <Badge variant="destructive">Casa Excluída</Badge>;
      case 'QUADRA_CREATED': return <Badge className="bg-blue-500"><LayoutGrid size={10} className="mr-1"/>Nova Quadra</Badge>;
      case 'QUADRA_EDITED': return <Badge variant="outline">Quadra Editada</Badge>;
      case 'QUADRA_DELETED': return <Badge variant="destructive">Quadra Excluída</Badge>;
      case 'TERRITORY_CREATED': return <Badge className="bg-blue-700">Novo Território</Badge>;
      case 'TERRITORY_EDITED': return <Badge variant="outline">Território Editado</Badge>;
      case 'TERRITORY_DELETED': return <Badge variant="destructive">Território Excluído</Badge>;
      case 'TERRITORY_RESET': return <Badge variant="destructive">Progresso Resetado</Badge>;
      case 'REVERT_ACTION': return <Badge className="bg-indigo-500">Ação Revertida</Badge>;
      case 'TERRITORY_ASSIGNED': return <Badge className="bg-blue-500">Designação</Badge>;
      case 'TERRITORY_RETURNED': return <Badge className="bg-emerald-500">Devolução</Badge>;
      case 'CASAS_REORDERED': return <Badge variant="outline">Ordem Alterada</Badge>;
      case 'USER_APPROVED': return <Badge className="bg-green-600"><Users size={10} className="mr-1"/>Usuário Aprovado</Badge>;
      case 'USER_EDITED': return <Badge variant="outline">Perfil Editado</Badge>;
      case 'USER_DELETED': return <Badge variant="destructive">Usuário Excluído</Badge>;
      case 'RURAL_WORK_LOGGED': return <Badge className="bg-green-500">Trabalho Rural</Badge>;
      case 'RURAL_LOG_EDITED': return <Badge variant="outline">Log Editado</Badge>;
      case 'RURAL_LOG_DELETED': return <Badge variant="destructive">Log Excluído</Badge>;
      case 'OVERDUE_NOTIFIED': return <Badge className="bg-yellow-500 text-black">Cobrança WhatsApp</Badge>;
      default: return <Badge variant="outline">{action.replace(/_/g, ' ')}</Badge>;
    }
};

export default withAuth(MaisPage);
