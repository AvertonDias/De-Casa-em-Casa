
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BookUser, 
  BarChart3, 
  ClipboardList, 
  FileText, 
  History, 
  ArrowLeft, 
  LayoutGrid,
  Search,
  Undo2,
  Loader,
  X,
  Info,
  MapPin,
  CheckCircle,
  PlusCircle,
  Edit3,
  Trash2,
  RefreshCcw,
  UserPlus,
  Trees,
  DatabaseBackup,
  ArrowDownUp,
  MessageCircle,
  Settings
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import withAuth from '@/components/withAuth';
import { cn } from '@/lib/utils';
import TerritoryAssignmentPanel from '@/components/admin/TerritoryAssignmentPanel';
import TerritoryCoverageStats from '@/components/admin/TerritoryCoverageStats';
import AvailableTerritoriesReport from '@/components/admin/AvailableTerritoriesReport';
import S13Report from '@/components/admin/S13Report';
import CongregationEditForm from '@/components/admin/CongregationEditForm';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, doc, runTransaction, increment, serverTimestamp } from 'firebase/firestore';
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
  const [territoryMap, setTerritoryMap] = useState<Record<string, string>>({}); 
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [revertingIds, setRevertingIds] = useState<Set<string>>(new Set());
  const [searchTermLogs, setSearchTermLogs] = useState('');
  const [actionFilterLogs, setActionFilterLogs] = useState('all');

  const isAdmin = user?.role === 'Administrador';
  const isManager = user?.role === 'Administrador' || user?.role === 'Dirigente' || user?.role === 'Servo de Territórios' || user?.role === 'Ajudante de Servo de Territórios';

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

  const fetchLogs = useCallback(() => {
    if (!user?.congregationId || !isAdmin) return;
    setLoadingLogs(true);

    const logsRef = collection(db, `congregations/${user.congregationId}/auditLogs`);
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(1000));

    return onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
      setLoadingLogs(false);
    }, (error) => {
        console.error("Erro ao carregar histórico:", error);
        setLoadingLogs(false);
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
            
            const territoryRef = doc(db, 'congregations', congregationId, 'territories', territoryId);
            const houseRef = doc(territoryRef, 'quadras', quadraId, 'casas', houseId);
            const quadraRef = doc(territoryRef, 'quadras', quadraId);
            const congRef = doc(db, 'congregations', congregationId);
            
            await runTransaction(db, async (transaction) => {
                const [qSnap, terrSnap, congSnap] = await Promise.all([
                    transaction.get(quadraRef),
                    transaction.get(territoryRef),
                    transaction.get(congRef)
                ]);

                if (!qSnap.exists()) throw new Error("A quadra desta casa não existe mais.");
                
                transaction.set(houseRef, casaData);
                transaction.update(quadraRef, { 
                    totalHouses: (qSnap.data()?.totalHouses || 0) + 1,
                    housesDone: (qSnap.data()?.housesDone || 0) + (casaData.status ? 1 : 0)
                });

                if (terrSnap.exists()) {
                    const tData = terrSnap.data() as Territory;
                    const newTotal = (tData.stats?.totalHouses || 0) + 1;
                    const newDone = (tData.stats?.housesDone || 0) + (casaData.status ? 1 : 0);
                    transaction.update(territoryRef, {
                        "stats.totalHouses": newTotal,
                        "stats.housesDone": newDone,
                        progress: newTotal > 0 ? newDone / newTotal : 0
                    });
                }
                if (congSnap.exists()) {
                    transaction.update(congRef, { 
                        totalHouses: (congSnap.data()?.totalHouses || 0) + 1,
                        totalHousesDone: (congSnap.data()?.totalHousesDone || 0) + (casaData.status ? 1 : 0)
                    });
                }
            });
            logEvent(congregationId, user.uid, user.name, 'REVERT_ACTION', `Restaurou a casa ${casaData.number} no território ${log.metadata.territoryNumber || territoryId}.`);
            toast({ title: "Casa Restaurada!" });
        } else if (log.action === 'QUADRA_DELETED') {
            const { territoryId, quadraId } = log.metadata;
            const { quadra, casas } = revertData;
            
            const territoryRef = doc(db, 'congregations', congregationId, 'territories', territoryId);
            const quadraRef = doc(territoryRef, 'quadras', quadraId);
            const congRef = doc(db, 'congregations', congregationId);
            
            await runTransaction(db, async (transaction) => {
                const [terrSnap, congSnap] = await Promise.all([
                    transaction.get(territoryRef),
                    transaction.get(congRef)
                ]);
                
                transaction.set(quadraRef, quadra);
                casas.forEach((c: any) => {
                    const { id, ...cData } = c;
                    transaction.set(doc(quadraRef, 'casas', id), cData);
                });
                
                if (terrSnap.exists()) {
                    const tData = terrSnap.data() as Territory;
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
                    transaction.update(congRef, {
                        totalHouses: (congSnap.data()?.totalHouses || 0) + (quadra.totalHouses || 0),
                        totalHousesDone: (congSnap.data()?.totalHousesDone || 0) + (quadra.housesDone || 0)
                    });
                }
            });
            logEvent(congregationId, user.uid, user.name, 'REVERT_ACTION', `Restaurou a quadra "${quadra.name}" no território ${log.metadata.territoryNumber || territoryId}.`);
            toast({ title: "Quadra Restaurada!" });
        } else if (log.action === 'TERRITORY_DELETED') {
            const { territory: terrData, quadras: quadrasData } = revertData;
            const territoryRef = doc(db, 'congregations', congregationId, 'territories', terrData.id);
            const congRef = doc(db, 'congregations', congregationId);
            
            await runTransaction(db, async (transaction) => {
                const congSnap = await transaction.get(congRef);
                const { id, ...tFinal } = terrData;
                transaction.set(territoryRef, tFinal);
                quadrasData.forEach((q: any) => {
                    const { casas, id: qId, ...qMeta } = q;
                    const qRef = doc(territoryRef, 'quadras', qId);
                    transaction.set(qRef, qMeta);
                    casas.forEach((c: any) => {
                        const { id: cId, ...cMeta } = c;
                        transaction.set(doc(qRef, 'casas', cId), cMeta);
                    });
                });
                if (congSnap.exists()) {
                    transaction.update(congRef, {
                        territoryCount: (congSnap.data()?.territoryCount || 0) + (terrData.type === 'rural' ? 0 : 1),
                        ruralTerritoryCount: (congSnap.data()?.ruralTerritoryCount || 0) + (terrData.type === 'rural' ? 1 : 0),
                        totalHouses: (congSnap.data()?.totalHouses || 0) + (terrData.stats?.totalHouses || 0),
                        totalHousesDone: (congSnap.data()?.totalHousesDone || 0) + (terrData.stats?.housesDone || 0)
                    });
                }
            });
            logEvent(congregationId, user.uid, user.name, 'REVERT_ACTION', `Restaurou o território ${terrData.number}.`);
            toast({ title: "Território Restaurado!" });
        } else if (log.action === 'RURAL_LOG_DELETED') {
            const { territoryId } = log.metadata;
            const territoryRef = doc(db, 'congregations', congregationId, 'territories', territoryId);
            await runTransaction(db, async (transaction) => {
                const terrSnap = await transaction.get(territoryRef);
                if (!terrSnap.exists()) throw new Error("O território rural não existe mais.");
                const currentLogs = terrSnap.data().workLogs || [];
                transaction.update(territoryRef, { workLogs: [...currentLogs, revertData] });
            });
            logEvent(congregationId, user.uid, user.name, 'REVERT_ACTION', `Restaurou um registro de trabalho no território rural.`);
            toast({ title: "Registro Rural Restaurado!" });
        } else if (log.action === 'TERRITORY_RESET') {
            const { territoryId } = log.metadata;
            const { quadras: quadrasData, history: historyData } = revertData;
            const territoryRef = doc(db, 'congregations', congregationId, 'territories', territoryId);
            const congRef = doc(db, 'congregations', congregationId);
            await runTransaction(db, async (transaction) => {
                const [terrSnap, congSnap] = await Promise.all([
                    transaction.get(territoryRef),
                    transaction.get(congRef)
                ]);
                if (!terrSnap.exists()) throw new Error("O território não existe mais.");
                let totalIncrement = 0;
                for (const qData of quadrasData) {
                    const quadraRef = doc(territoryRef, 'quadras', qData.id);
                    const qSnap = await transaction.get(quadraRef);
                    let quadraIncrement = 0;
                    for (const h of qData.houses) {
                        const { id, ...hMeta } = h;
                        transaction.set(doc(quadraRef, 'casas', id), hMeta);
                        quadraIncrement++;
                        totalIncrement++;
                    }
                    if (qSnap.exists()) {
                        transaction.update(quadraRef, { housesDone: (qSnap.data().housesDone || 0) + quadraIncrement });
                    }
                }
                if (historyData) {
                    for (const h of historyData) {
                        const { id, ...hMeta } = h;
                        transaction.set(doc(territoryRef, 'activityHistory', id), hMeta);
                    }
                }
                const tData = terrSnap.data() as Territory;
                const newDone = (tData.stats?.housesDone || 0) + totalIncrement;
                const total = tData.stats?.totalHouses || 1;
                transaction.update(territoryRef, {
                    "stats.housesDone": newDone,
                    progress: newDone / total,
                    lastUpdate: serverTimestamp()
                });
                if (congSnap.exists()) {
                    transaction.update(congRef, { totalHousesDone: (congSnap.data().totalHousesDone || 0) + totalIncrement });
                }
            });
            logEvent(congregationId, user.uid, user.name, 'REVERT_ACTION', `Restaurou o progresso do território ${log.metadata.territoryNumber || territoryId}.`);
            toast({ title: "Progresso Restaurado!" });
        }
    } catch (e: any) {
        console.error("Erro ao reverter:", e);
        toast({ title: "Erro ao reverter", description: e.message, variant: "destructive" });
    } finally {
        setRevertingIds(prev => { const next = new Set(prev); next.delete(log.id); return next; });
    }
  };

  const filteredLogs = useMemo(() => {
    const term = searchTermLogs.toLowerCase();
    const filtered = logs.filter(log => {
      let details = (log.details || '');
      Object.entries(territoryMap).forEach(([id, number]) => {
          if (details.includes(id)) details = details.replace(new RegExp(id, 'g'), number);
      });
      const matchesSearch = log.userName?.toLowerCase().includes(term) || details.toLowerCase().includes(term);
      let matchesAction = true;
      if (actionFilterLogs === 'deletions') matchesAction = log.action.includes('DELETED');
      else if (actionFilterLogs === 'creation') matchesAction = log.action.includes('CREATED');
      else if (actionFilterLogs === 'users') matchesAction = log.action.includes('USER_');
      else if (actionFilterLogs !== 'all') matchesAction = log.action === actionFilterLogs;
      return matchesSearch && matchesAction;
    });

    const uniqueLogs: AuditLog[] = [];
    const seen = new Set<string>();
    filtered.forEach(log => {
        if (!log.timestamp) return;
        const timeKey = Math.floor(log.timestamp.toMillis() / 1000);
        const uniqueKey = `${log.userId}-${log.action}-${(log.details || '').substring(0, 40)}-${timeKey}`;
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

  const getActionBadge = (action: string) => {
    const config: Record<string, { label: string, icon: any, color: string }> = {
      'HOUSE_COMPLETED': { label: 'Conclusão', icon: CheckCircle, color: 'bg-green-500/15 text-green-500 border-green-500/20' },
      'HOUSE_UNMARKED': { label: 'Desmarcado', icon: X, color: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/20' },
      'HOUSE_CREATED': { label: 'Novo Número', icon: PlusCircle, color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
      'HOUSE_EDITED': { label: 'Edição', icon: Edit3, color: 'bg-gray-500/15 text-gray-400 border-gray-500/20' },
      'HOUSE_DELETED': { label: 'Casa Excluída', icon: Trash2, color: 'bg-red-500/15 text-red-500 border-red-500/20' },
      'QUADRA_CREATED': { label: 'Nova Quadra', icon: LayoutGrid, color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
      'QUADRA_EDITED': { label: 'Quadra Editada', icon: Edit3, color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
      'QUADRA_DELETED': { label: 'Quadra Excluída', icon: Trash2, color: 'bg-red-500/15 text-red-500 border-red-500/20' },
      'TERRITORY_CREATED': { label: 'Novo Território', icon: MapPin, color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20' },
      'TERRITORY_EDITED': { label: 'Território Editado', icon: Edit3, color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
      'TERRITORY_DELETED': { label: 'Território Excluído', icon: Trash2, color: 'bg-red-500/15 text-red-500 border-red-500/20' },
      'TERRITORY_RESET': { label: 'Progresso Resetado', icon: RefreshCcw, color: 'bg-orange-500/15 text-orange-500 border-orange-500/20' },
      'REVERT_ACTION': { label: 'Ação Revertida', icon: Undo2, color: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
      'TERRITORY_ASSIGNED': { label: 'Designação', icon: BookUser, color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' },
      'TERRITORY_RETURNED': { label: 'Devolução', icon: CheckCircle, color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
      'USER_APPROVED': { label: 'Usuário Aprovado', icon: UserPlus, color: 'bg-green-600/15 text-green-500 border-green-600/20' },
      'USER_EDITED': { label: 'Perfil Alterado', icon: Edit3, color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
      'USER_DELETED': { label: 'Usuário Removido', icon: Trash2, color: 'bg-red-600/15 text-red-500 border-red-600/20' },
      'RURAL_WORK_LOGGED': { label: 'Trabalho Rural', icon: Trees, color: 'bg-green-500/15 text-green-500 border-green-500/20' },
      'RURAL_LOG_EDITED': { label: 'Log Rural Editado', icon: Edit3, color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
      'RURAL_LOG_DELETED': { label: 'Log Rural Excluído', icon: Trash2, color: 'bg-red-500/15 text-red-500 border-red-500/20' },
      'BACKUP_RESTORED': { label: 'Backup Restaurado', icon: DatabaseBackup, color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
      'CASAS_REORDERED': { label: 'Reordenamento', icon: ArrowDownUp, color: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
      'HISTORY_EDITED': { label: 'Histórico Editado', icon: Edit3, color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
      'HISTORY_DELETED': { label: 'Histórico Excluído', icon: Trash2, color: 'bg-red-500/15 text-red-500 border-red-500/20' },
      'OVERDUE_NOTIFIED': { label: 'Cobrança WhatsApp', icon: MessageCircle, color: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/20' },
    };
    const item = config[action] || { label: action.replace(/_/g, ' '), icon: Info, color: 'bg-muted text-muted-foreground' };
    const Icon = item.icon;
    return (
      <Badge variant="outline" className={cn("flex items-center gap-1.5 px-2 py-0.5 font-bold text-[10px] uppercase tracking-wider rounded-md", item.color)}>
        <Icon size={12} />
        {item.label}
      </Badge>
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
            <MenuCard id="assignment" label="Designar" description="Atribuir territórios aos publicadores." icon={BookUser} colorClass="bg-blue-500/10 text-blue-500" />
            <MenuCard id="overview" label="Estatísticas" description="Estatísticas detalhadas de cobertura." icon={BarChart3} colorClass="bg-purple-500/10 text-purple-500" />
            <MenuCard id="available" label="Disponíveis" description="Territórios prontos para designação." icon={ClipboardList} colorClass="bg-green-500/10 text-green-500" />
            <MenuCard id="s13" label="Relatório S-13" description="Gerar formulário oficial de territórios." icon={FileText} colorClass="bg-orange-500/10 text-orange-500" />
            <MenuCard id="history" label="Histórico" description="Logs de auditoria e reversão de ações." icon={History} colorClass="bg-indigo-500/10 text-indigo-500" adminOnly />
            <MenuCard id="settings" label="Configurações" description="Gerenciar dados da congregação." icon={Settings} colorClass="bg-gray-500/10 text-gray-400" adminOnly />
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => setActiveSection('menu')} className="mb-4 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2" size={18} /> Voltar ao Menu
          </Button>

          {activeSection === 'assignment' && <TerritoryAssignmentPanel />}
          {activeSection === 'overview' && <TerritoryCoverageStats />}
          {activeSection === 'available' && <AvailableTerritoriesReport />}
          {activeSection === 's13' && <S13Report />}
          {activeSection === 'settings' && <div className="max-w-2xl mx-auto"><CongregationEditForm onSaveSuccess={() => {}} /></div>}
          
          {activeSection === 'history' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center px-2">
                    <div>
                        <h2 className="text-3xl font-bold flex items-center gap-2"><History className="text-primary" /> Histórico</h2>
                        <div className="mt-2 p-4 bg-blue-500/10 border-l-4 border-blue-500 rounded-r-lg flex items-start gap-3 max-w-2xl shadow-sm">
                          <Info size={20} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">Capacidade do Histórico</p>
                            <p className="text-sm text-foreground/90 leading-relaxed">
                              O sistema mantém as últimas <strong>1.000 ações</strong> para reversão imediata. Você pode reverter qualquer exclusão ou reset de progresso enquanto a ação estiver visível nesta lista.
                            </p>
                          </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-grow relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <Input placeholder="Buscar por usuário ou território..." value={searchTermLogs} onChange={(e) => setSearchTermLogs(e.target.value)} className="pl-10 h-11 bg-card border-border/40" />
                    </div>
                    <div className="min-w-[220px]">
                        <Select value={actionFilterLogs} onValueChange={setActionFilterLogs}>
                            <SelectTrigger className="bg-card h-11 border-border/40"><SelectValue placeholder="Filtrar por ação" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as ações</SelectItem>
                                <SelectItem value="HOUSE_COMPLETED">Marcação de Casas</SelectItem>
                                <SelectItem value="TERRITORY_ASSIGNED">Designações</SelectItem>
                                <SelectItem value="TERRITORY_RETURNED">Devoluções</SelectItem>
                                <SelectItem value="creation">Criações</SelectItem>
                                <SelectItem value="users">Usuários</SelectItem>
                                <SelectItem value="deletions">Exclusões</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="bg-card/50 rounded-2xl border border-border/40 shadow-xl overflow-hidden">
                    {loadingLogs ? (
                        <div className="p-20 text-center"><Loader className="animate-spin text-primary mx-auto" size={40} /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-muted/40 text-muted-foreground font-bold uppercase text-[10px] tracking-widest border-b border-border/40">
                                    <tr>
                                        <th className="px-6 py-4">Data</th>
                                        <th className="px-6 py-4">Usuário</th>
                                        <th className="px-6 py-4">Ação</th>
                                        <th className="px-6 py-4">Detalhes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/20">
                                    {filteredLogs.length > 0 ? (
                                        filteredLogs.map((log) => {
                                            let displayDetails = log.details || '';
                                            Object.entries(territoryMap).forEach(([id, number]) => {
                                                if (displayDetails.includes(id)) displayDetails = displayDetails.replace(new RegExp(id, 'g'), number);
                                            });

                                            const isReversible = log.action.includes('DELETED') || log.action === 'TERRITORY_RESET';

                                            return (
                                                <tr key={log.id} className="hover:bg-white/[0.03] transition-colors group">
                                                    <td className="px-6 py-5 whitespace-nowrap align-top">
                                                        <p className="text-muted-foreground text-[11px] font-mono">
                                                            {log.timestamp ? format(log.timestamp.toDate(), "dd/MM HH:mm", { locale: ptBR }) : '...'}
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-5 align-top">
                                                        <p className="font-bold text-sm text-foreground/90">{log.userName}</p>
                                                    </td>
                                                    <td className="px-6 py-5 align-top">
                                                        <div className="flex flex-col gap-2 items-start">
                                                            {getActionBadge(log.action)}
                                                            {log.metadata?.revertData && isAdmin && isReversible && (
                                                                <Button 
                                                                    variant="outline" 
                                                                    size="sm" 
                                                                    className="h-7 text-[10px] font-black border-primary/30 text-primary hover:bg-primary/10"
                                                                    disabled={revertingIds.has(log.id)}
                                                                    onClick={() => handleRevertAction(log)}
                                                                >
                                                                    {revertingIds.has(log.id) ? <Loader className="animate-spin mr-1 h-3 w-3"/> : <Undo2 size={12} className="mr-1"/>} REVERTER
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 align-top">
                                                        <p className="text-muted-foreground text-xs leading-relaxed max-w-md">
                                                            {displayDetails}
                                                        </p>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (<tr><td colSpan={4} className="px-6 py-20 text-center text-muted-foreground italic">Nenhum registro encontrado.</td></tr>)}
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

export default withAuth(MaisPage);
