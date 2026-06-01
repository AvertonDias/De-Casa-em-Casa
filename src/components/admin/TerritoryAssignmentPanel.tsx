
"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, Timestamp, deleteField, orderBy, runTransaction, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';
import { Search, MoreVertical, CheckCircle, RotateCw, Map, Trees, BookUser, MessageCircle, History, Loader, X, Filter } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AssignTerritoryModal from './AssignTerritoryModal';
import ReturnTerritoryModal from './ReturnTerritoryModal';
import AddEditAssignmentLogModal from './AddEditAssignmentLogModal';
import { ConfirmationModal } from '../ConfirmationModal';
import type { Territory, AppUser, AssignmentHistoryLog } from '@/types/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import AssignmentHistory from '../AssignmentHistory';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { logEvent } from '@/lib/audit';

const FilterButton = ({ label, value, currentFilter, setFilter, Icon }: {
  label: string;
  value: string;
  currentFilter: string;
  setFilter: (value: any) => void;
  Icon?: React.ElementType;
}) => (
  <button
    onClick={() => setFilter(value)}
    className={`flex items-center justify-center flex-grow sm:flex-grow-0 px-3 py-1.5 text-sm rounded-md transition-colors ${
      currentFilter === value 
      ? 'bg-primary text-primary-foreground font-semibold' 
      : 'bg-input hover:bg-white/5'
    }`}
  >
    {Icon && <Icon size={16} className="mr-2"/>}
    {label}
  </button>
);

export default function TerritoryAssignmentPanel() {
  const { user: currentUser, congregation } = useUser();
  const { toast } = useToast();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'disponivel' | 'designado' | 'atrasado'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'urban' | 'rural'>('all');
  
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false); 
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);

  const [isEditLogModalOpen, setIsEditLogModalOpen] = useState(false);
  const [logToEdit, setLogToEdit] = useState<AssignmentHistoryLog | null>(null);
  
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [logToDelete, setLogToDelete] = useState<{territoryId: string, log: AssignmentHistoryLog} | null>(null);


  useEffect(() => {
    if (!currentUser?.congregationId) return;
    const terRef = collection(db, 'congregations', currentUser.congregationId, 'territories');
    const unsub = onSnapshot(query(terRef, orderBy('number', 'asc')), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory));
      setTerritories(data);
      setLoading(false);
    }, (error) => {
        console.error("Erro ao buscar territórios:", error);
    });
    return () => unsub();
  }, [currentUser]);
  
  useEffect(() => {
    if (!currentUser?.congregationId) return;
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('congregationId', '==', currentUser.congregationId));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
      usersData.sort((a, b) => a.name.localeCompare(b.name));
      setUsers(usersData);
    });

    return () => unsub();
  }, [currentUser]);

  const handleSaveAssignment = async (territoryId: string, assignedUser: { uid: string; name: string }, assignmentDate: string, dueDate: string) => {
    if (!currentUser?.congregationId) return;
    
    const territoryRef = doc(db, 'congregations', currentUser.congregationId, 'territories', territoryId);
    const assignedAt = Timestamp.fromDate(new Date(assignmentDate + 'T12:00:00'));
    const dueDateObj = Timestamp.fromDate(new Date(dueDate + 'T12:00:00'));
    const currentTerritory = territories.find(t => t.id === territoryId);

    setIsAssignModalOpen(false);

    try {
        await runTransaction(db, async (transaction) => {
            const territoryDoc = await transaction.get(territoryRef);
            if (!territoryDoc.exists()) throw new Error("Território não encontrado.");

            const data = territoryDoc.data() as Territory;
            const isReassignment = data.status === 'designado' && !!data.assignment;

            const updates: any = {
                status: 'designado',
                assignment: {
                    uid: assignedUser.uid,
                    name: assignedUser.name,
                    assignedAt: assignedAt,
                    dueDate: dueDateObj,
                    isReassigned: isReassignment,
                    transferredAt: isReassignment ? Timestamp.now() : null
                },
                lastUpdate: serverTimestamp()
            };

            if (isReassignment) {
                const historyLog: AssignmentHistoryLog = {
                    uid: data.assignment!.uid,
                    name: data.assignment!.name,
                    assignedAt: data.assignment!.assignedAt,
                    completedAt: Timestamp.now(),
                    isCompletion: false
                };
                const currentHistory = data.assignmentHistory || [];
                updates.assignmentHistory = [...currentHistory, historyLog];
            }

            transaction.update(territoryRef, updates);
        });
        
        // Registrar no Histórico de Auditoria
        logEvent(
            currentUser.congregationId,
            currentUser.uid,
            currentUser.name,
            'TERRITORY_ASSIGNED',
            `Designou o território ${currentTerritory?.number} para ${assignedUser.name}.`,
            { territoryId, assignedTo: assignedUser.name }
        );

        const assignedUserId = assignedUser.uid;
        if (!assignedUserId.startsWith('custom_')) {
            const notificationRef = collection(db, `users/${assignedUserId}/notifications`);
            const territoryLink = currentTerritory?.type === 'rural' ? `/dashboard/rural/${territoryId}` : `/dashboard/territorios/${territoryId}`;
            
            await addDoc(notificationRef, {
                title: "Você recebeu um novo território!",
                body: `O território "${currentTerritory?.number} - ${currentTerritory?.name}" foi designado para você.`,
                link: territoryLink,
                type: 'territory_assigned',
                isRead: false,
                createdAt: serverTimestamp()
            });
        }
        
        const userForWhatsapp = users.find(u => u.uid === assignedUser.uid);
        if (congregation?.whatsappEnabled !== false && userForWhatsapp?.whatsapp && !assignedUser.uid.startsWith('custom_')) {
            const formattedDueDate = format(dueDateObj.toDate(), 'dd/MM/yyyy');
            const link = `${window.location.origin}/dashboard/meus-territorios`;
            const defaultTemplate = "Olá, o território *[Território]* foi designado para você! Devolva até [Data de Devolução]. Acesse o app para ver os detalhes: [Link]";
            const template = congregation?.whatsappTemplates?.assignment || defaultTemplate;
            const message = template
                .replace(/\[Território\]/g, `${currentTerritory?.number} - ${currentTerritory?.name}`)
                .replace(/\[Data de Devolução\]/g, formattedDueDate)
                .replace(/\[Link\]/g, link);

            const whatsappNumber = userForWhatsapp.whatsapp.replace(/\D/g, '');
            const whatsappUrl = `https://wa.me/55${whatsappNumber}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        }

        toast({ title: "Sucesso!", description: "Atribuição salva." });

    } catch (error: any) {
      console.error("Erro ao salvar atribuição:", error);
      toast({ title: "Erro", description: "Falha ao salvar atribuição.", variant: "destructive" });
    }
};

  const handleConfirmReturn = async (territoryId: string, returnDate: string) => {
    if (!currentUser?.congregationId) return;
    const territoryToReturn = territories.find(t => t.id === territoryId);
    if (!territoryToReturn || !territoryToReturn.assignment) return;
    
    const territoryRef = doc(db, 'congregations', currentUser.congregationId, 'territories', territoryId);
    const returnDateObj = new Date(returnDate + 'T12:00:00');
    
    const historyLog = {
      uid: territoryToReturn.assignment.uid,
      name: territoryToReturn.assignment.name,
      assignedAt: territoryToReturn.assignment.assignedAt,
      completedAt: Timestamp.fromDate(returnDateObj),
      isCompletion: true
    };

    try {
        await updateDoc(territoryRef, {
            status: 'disponivel',
            assignment: deleteField(),
            assignmentHistory: arrayUnion(historyLog)
        });

        // Registrar Auditoria
        logEvent(
            currentUser.congregationId,
            currentUser.uid,
            currentUser.name,
            'TERRITORY_RETURNED',
            `Recebeu a devolução do território ${territoryToReturn.number} de ${territoryToReturn.assignment.name}.`,
            { territoryId, returnedBy: territoryToReturn.assignment.name }
        );

        toast({ title: "Sucesso!", description: "Território devolvido." });
        setIsReturnModalOpen(false);
    } catch (error: any) {
        console.error("Erro ao devolver território:", error);
        toast({ title: "Erro", description: "Falha ao devolver território.", variant: "destructive" });
    }
  };

  const handleOpenEditLogModal = (log: AssignmentHistoryLog) => {
    setLogToEdit(log);
    setIsEditLogModalOpen(true);
  };

  const handleSaveHistoryLog = async (originalLog: AssignmentHistoryLog, updatedData: { name: string; assignedAt: Date; completedAt: Date; }) => {
    if (!currentUser?.congregationId || !selectedTerritory) return;
    const territoryRef = doc(db, 'congregations', currentUser.congregationId, 'territories', selectedTerritory.id);

    try {
        await runTransaction(db, async (transaction) => {
            const territoryDoc = await transaction.get(territoryRef);
            if (!territoryDoc.exists()) throw new Error("Território não encontrado.");
            
            const currentHistory: AssignmentHistoryLog[] = territoryDoc.data().assignmentHistory || [];
            const newHistory = currentHistory.map(log => {
                if (log.uid === originalLog.uid && log.assignedAt.isEqual(originalLog.assignedAt)) {
                    return {
                        ...log,
                        name: updatedData.name,
                        assignedAt: Timestamp.fromDate(updatedData.assignedAt),
                        completedAt: Timestamp.fromDate(updatedData.completedAt),
                    };
                }
                return log;
            });
            transaction.update(territoryRef, { assignmentHistory: newHistory });
        });

        logEvent(
            currentUser.congregationId,
            currentUser.uid,
            currentUser.name,
            'HISTORY_EDITED',
            `Editou um registro de histórico do território ${selectedTerritory.number}.`,
            { territoryId: selectedTerritory.id }
        );

        toast({ title: "Sucesso!", description: "Histórico atualizado." });
        setIsEditLogModalOpen(false);
    } catch (e: any) {
        toast({ title: "Erro", description: "Falha ao salvar histórico.", variant: "destructive" });
    }
  };
  
  const handleOpenDeleteLogModal = (territoryId: string, log: AssignmentHistoryLog) => {
    setLogToDelete({ territoryId, log });
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmDeleteLog = async () => {
    if (!logToDelete || !currentUser?.congregationId) return;

    const { territoryId, log: logToRemoveData } = logToDelete;
    const territoryRef = doc(db, 'congregations', currentUser.congregationId, 'territories', territoryId);
    
    try {
        const territoryDoc = await getDoc(territoryRef);
        if (territoryDoc.exists()) {
            const currentHistory: AssignmentHistoryLog[] = territoryDoc.data().assignmentHistory || [];
            const logToRemove = currentHistory.find(log => 
                log.uid === logToRemoveData.uid && 
                log.assignedAt.isEqual(logToRemoveData.assignedAt)
            );
            
            if (logToRemove) {
                await updateDoc(territoryRef, { assignmentHistory: arrayRemove(logToRemove) });
                
                logEvent(
                    currentUser.congregationId,
                    currentUser.uid,
                    currentUser.name,
                    'HISTORY_DELETED',
                    `Excluiu um registro de histórico do território ${territoryDoc.data().number}.`,
                    { territoryId }
                );

                toast({ title: "Sucesso!", description: "Registro removido." });
            }
        }
    } catch (e: any) {
        toast({ title: "Erro", description: "Falha ao deletar registro.", variant: "destructive" });
    } finally {
        setIsConfirmDeleteOpen(false);
        setLogToDelete(null);
    }
  };
  
  const handleNotifyOverdue = async (territory: Territory) => {
    if (!territory.assignment) return;
    if (congregation?.whatsappEnabled === false) {
        toast({ title: "WhatsApp Desativado", variant: "destructive" });
        return;
    }
    const assignedUser = users.find(u => u.uid === territory.assignment!.uid);
    if (!assignedUser || !assignedUser.whatsapp) {
      toast({ title: "Usuário sem WhatsApp", variant: "destructive" });
      return;
    }

    const link = `${window.location.origin}/dashboard/meus-territorios`;
    const defaultTemplate = "Olá, este é um lembrete de que o território *[Território]* está com a devolução atrasada. Por favor, atualize o quanto antes. Acesse o app: [Link]";
    const template = congregation?.whatsappTemplates?.overdueReminder || defaultTemplate;
    const message = template.replace(/\[Território\]/g, territory.name).replace(/\[Nome do Publicador\]/g, assignedUser.name).replace(/\[Link\]/g, link);

    const whatsappNumber = assignedUser.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/55${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
    
    logEvent(
        currentUser!.congregationId!,
        currentUser!.uid,
        currentUser!.name,
        'OVERDUE_NOTIFIED',
        `Cobrou a devolução do território ${territory.number} de ${assignedUser.name} via WhatsApp.`
    );
  };
  
  const filteredTerritories = territories.filter(t => {
      const type = t.type || 'urban';
      const matchesType = typeFilter === 'all' || type === typeFilter;
      let matchesStatus = true;
      let isOverdue = false;
      if (t.status === 'designado' && t.assignment?.dueDate) isOverdue = t.assignment.dueDate.toDate() < new Date();

      if (filterStatus === 'disponivel') matchesStatus = t.status !== 'designado';
      else if (filterStatus === 'designado') matchesStatus = t.status === 'designado' && !isOverdue;
      else if (filterStatus === 'atrasado') matchesStatus = isOverdue;

      const matchesSearch = searchTerm === '' || t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.number.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesStatus && matchesSearch;
  });

  const canManageAssignments = currentUser?.role === 'Administrador' || currentUser?.role === 'Servo de Territórios' || currentUser?.role === 'Ajudante de Servo de Territórios';

  if(loading) return <div className="text-center p-8"><Loader className="animate-spin mx-auto text-primary" /></div>

  return (
    <>
      <div className="bg-card p-4 sm:p-6 rounded-lg shadow-md border border-border/40">
        <h2 className="text-2xl font-bold mb-6">Designar Territórios</h2>

        <div className="flex flex-col gap-6 mb-8">
            <div className="flex flex-wrap items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border/20">
                <FilterButton label="Todos" value="all" currentFilter={typeFilter} setFilter={setTypeFilter} />
                <FilterButton label="Urbanos" value="urban" currentFilter={typeFilter} setFilter={setTypeFilter} />
                <FilterButton label="Rurais" value="rural" currentFilter={typeFilter} setFilter={setTypeFilter} />
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <input 
                  type="text" 
                  placeholder="Buscar por nome ou número..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="w-full bg-input/50 rounded-md p-2.5 pl-10 pr-10 border border-border focus:ring-2 focus:ring-primary/50 outline-none"
                />
                {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={20} /></button>}
              </div>
              
              <div className="min-w-[200px]">
                <Select value={filterStatus} onValueChange={(val: any) => setFilterStatus(val)}>
                  <SelectTrigger className="w-full bg-input/50 border-border h-[42px]">
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-muted-foreground" />
                        <SelectValue placeholder="Filtrar por status" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="disponivel">Disponível</SelectItem>
                    <SelectItem value="designado">Designado</SelectItem>
                    <SelectItem value="atrasado">Atrasado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
        </div>
        
        <div className="border border-border/40 rounded-xl overflow-hidden shadow-sm">
          <Accordion type="single" collapsible className="w-full">
            {filteredTerritories.map(t => {
                const isDesignado = t.status === 'designado' && t.assignment;
                const isOverdue = isDesignado && t.assignment && t.assignment.dueDate.toDate() < new Date();
                return (
                  <AccordionItem value={t.id} key={t.id} className="border-b border-border/40 last:border-b-0">
                    <div className="flex items-center hover:bg-white/[0.02] transition-colors px-4 py-4">
                       <div className="flex-grow grid grid-cols-1 sm:grid-cols-12 items-center gap-y-2 gap-x-4">
                          <div className="col-span-12 sm:col-span-4 font-bold">
                              <Link href={t.type === 'rural' ? `/dashboard/rural/${t.id}` : `/dashboard/territorios/${t.id}`} className="hover:text-primary transition-colors text-base">
                                  {t.number} - {t.name}
                              </Link>
                          </div>
                          <div className="col-span-6 sm:col-span-2 text-xs font-bold uppercase tracking-wider">
                               {isOverdue ? <span className="text-red-500">Atrasado</span> : (isDesignado ? <span className="text-yellow-500">Designado</span> : <span className="text-green-500">Disponível</span>)}
                          </div>
                          <div className="col-span-12 sm:col-span-4 text-sm text-muted-foreground italic">
                              {t.assignment ? `${t.assignment.name} (até ${format(t.assignment.dueDate.toDate(), 'dd/MM/yyyy', { locale: ptBR })})` : ''}
                          </div>
                       </div>
                       <div className="flex items-center justify-end gap-1 ml-2">
                           {canManageAssignments && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><button className="p-2 rounded-full hover:bg-white/10"><MoreVertical size={20} /></button></DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56" align="end">
                                {isDesignado ? (
                                    <>
                                        <DropdownMenuItem onClick={() => { setSelectedTerritory(t); setIsReturnModalOpen(true); }}> <CheckCircle size={16} className="mr-2"/>Devolver</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => { setSelectedTerritory(t); setIsAssignModalOpen(true); }}> <RotateCw size={16} className="mr-2"/>Reatribuir</DropdownMenuItem>
                                        {isOverdue && <DropdownMenuItem onClick={() => handleNotifyOverdue(t)} className="text-yellow-500 font-bold"> <MessageCircle size={16} className="mr-2"/>Notificar atraso</DropdownMenuItem>}
                                    </>
                                ) : (
                                    <DropdownMenuItem onClick={() => { setSelectedTerritory(t); setIsAssignModalOpen(true); }}> <BookUser size={16} className="mr-2"/>Designar</DropdownMenuItem>
                                )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                           )}
                           <AccordionTrigger className="p-2 hover:bg-white/10 rounded-full transition-colors [&_svg]:h-4 [&_svg]:w-4"><History /></AccordionTrigger>
                       </div>
                    </div>
                    <AccordionContent className="bg-muted/10">
                      <AssignmentHistory 
                          currentAssignment={t.assignment} 
                          pastAssignments={t.assignmentHistory || []} 
                          onEdit={(log) => { setSelectedTerritory(t); handleOpenEditLogModal(log); }}
                          onDelete={(log) => handleOpenDeleteLogModal(t.id, log)}
                      />
                    </AccordionContent>
                  </AccordionItem>
                )
            })}
          </Accordion>
          {filteredTerritories.length === 0 && <div className="p-12 text-center text-muted-foreground bg-muted/20"><X className="mx-auto h-12 w-12 opacity-20 mb-4" /><p className="text-lg">Nenhum território encontrado.</p></div>}
        </div>
      </div>
      
      <AssignTerritoryModal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} onSave={handleSaveAssignment} territory={selectedTerritory} users={users} />
      <ReturnTerritoryModal isOpen={isReturnModalOpen} onClose={() => setIsReturnModalOpen(false)} onConfirm={handleConfirmReturn} territory={selectedTerritory} />
      <AddEditAssignmentLogModal isOpen={isEditLogModalOpen} onClose={() => setIsEditLogModalOpen(false)} onSave={handleSaveHistoryLog} logToEdit={logToEdit} />
      <ConfirmationModal isOpen={isConfirmDeleteOpen} onClose={() => setIsConfirmDeleteOpen(false)} onConfirm={handleConfirmDeleteLog} title="Confirmar Exclusão" message={`Tem certeza que deseja excluir o registro de ${logToDelete?.log.name}?`} />
    </>
  );
}
