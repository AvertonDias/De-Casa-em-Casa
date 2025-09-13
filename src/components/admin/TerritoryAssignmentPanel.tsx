
"use client";

import { useState, useEffect, Fragment } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db, app } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, Timestamp, deleteField, orderBy, runTransaction, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import Link from 'next/link';
import { Search, MoreVertical, CheckCircle, RotateCw, Map, Trees, LayoutList, BookUser, Bell, History, Loader } from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
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

const functions = getFunctions(app, 'southamerica-east1');

const FilterButton = ({ label, value, currentFilter, setFilter, Icon }: {
  label: string;
  value: string;
  currentFilter: string;
  setFilter: (value: any) => void;
  Icon: React.ElementType;
}) => (
  <button
    onClick={() => setFilter(value)}
    className={`flex items-center justify-center flex-grow sm:flex-grow-0 px-3 py-1.5 text-sm rounded-md transition-colors ${
      currentFilter === value 
      ? 'bg-primary text-primary-foreground font-semibold' 
      : 'bg-input hover:bg-white/5'
    }`}
  >
    <Icon size={16} className="mr-2"/>
    {label}
  </button>
);

export default function TerritoryAssignmentPanel() {
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifyingTerritoryId, setNotifyingTerritoryId] = useState<string | null>(null);
  
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
    const unsub = onSnapshot(query(terRef, orderBy('number')), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory));
      setTerritories(data);
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);
  
  useEffect(() => {
    if (!currentUser?.congregationId) return;
    const usersRef = collection(db, 'users');
    const q = query(
        usersRef, 
        where('congregationId', '==', currentUser.congregationId),
        orderBy('name')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser)));
    }, (error) => {
      console.error("Erro ao buscar usuários:", error);
    });

    return () => unsub();
  }, [currentUser]);

  const handleOpenAssignModal = (territory: Territory) => {
    setSelectedTerritory(territory);
    setIsAssignModalOpen(true);
  };
  
  const handleSaveAssignment = async (territoryId: string, user: { uid: string; name: string }, assignmentDate: string, dueDate: string) => {
    if (!currentUser?.congregationId) return;
    const territoryRef = doc(db, 'congregations', currentUser.congregationId, 'territories', territoryId);
    const assignment = {
      uid: user.uid,
      name: user.name,
      assignedAt: Timestamp.fromDate(new Date(assignmentDate + 'T12:00:00')),
      dueDate: Timestamp.fromDate(new Date(dueDate + 'T12:00:00')),
    };
    await updateDoc(territoryRef, { status: 'designado', assignment });
  };

  const handleOpenReturnModal = (territory: Territory) => {
    setSelectedTerritory(territory);
    setIsReturnModalOpen(true);
  };
  
  const handleConfirmReturn = async (territoryId: string, returnDate: string) => {
    if (!currentUser?.congregationId) return;
    const territoryToReturn = territories.find(t => t.id === territoryId);
    if (!territoryToReturn || !territoryToReturn.assignment) return;
    
    const territoryRef = doc(db, 'congregations', currentUser.congregationId, 'territories', territoryId);
    
    const historyLog = {
      uid: territoryToReturn.assignment.uid,
      name: territoryToReturn.assignment.name,
      assignedAt: territoryToReturn.assignment.assignedAt,
      completedAt: Timestamp.fromDate(new Date(returnDate + 'T12:00:00')),
    };

    await updateDoc(territoryRef, {
      status: 'disponivel',
      assignment: deleteField(),
      assignmentHistory: arrayUnion(historyLog)
    });
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
            if (!territoryDoc.exists()) throw "Território não encontrado";
            
            const currentHistory: AssignmentHistoryLog[] = territoryDoc.data().assignmentHistory || [];
            
            const newHistory = currentHistory.map(log => {
                if (log.name === originalLog.name && log.assignedAt.isEqual(originalLog.assignedAt)) {
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
    } catch (e) {
        console.error("Erro ao salvar histórico:", e);
    }
  };
  
  const handleOpenDeleteLogModal = (territoryId: string, log: AssignmentHistoryLog) => {
    setLogToDelete({ territoryId, log });
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmDeleteLog = async () => {
    if (!logToDelete || !currentUser?.congregationId) return;

    const { territoryId, log: logToDeleteData } = logToDelete;
    const territoryRef = doc(db, 'congregations', currentUser.congregationId, 'territories', territoryId);
    
    try {
        const territoryDoc = await getDoc(territoryRef);
        if (territoryDoc.exists()) {
            const currentHistory: AssignmentHistoryLog[] = territoryDoc.data().assignmentHistory || [];
            
            const logToRemove = currentHistory.find(log => 
                log.name === logToDeleteData.name && 
                log.assignedAt.isEqual(logToDeleteData.assignedAt)
            );
            
            if (logToRemove) {
                await updateDoc(territoryRef, {
                    assignmentHistory: arrayRemove(logToRemove)
                });
            }
        }
    } catch (e) {
        console.error("Erro ao deletar o registro do histórico:", e);
    } finally {
        setIsConfirmDeleteOpen(false);
        setLogToDelete(null);
    }
  };
  
 const handleNotifyOverdue = async (territory: Territory) => {
    if (!territory.assignment) return;
    setNotifyingTerritoryId(territory.id);

    try {
      const sendNotification = httpsCallable(functions, 'sendOverdueNotification');
      const result = await sendNotification({
        territoryId: territory.id,
        userId: territory.assignment.uid,
      });

      const data = result.data as { success: boolean; message: string };
      if (data.success) {
        toast({
          title: "Sucesso!",
          description: data.message || 'Notificação enviada.',
          variant: "default",
        });
      } else {
        throw new Error(data.message || 'Falha ao enviar notificação.');
      }
    } catch (error: any) {
      console.error("Erro ao chamar a função para notificar:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível enviar a notificação.",
        variant: "destructive",
      });
    } finally {
      setNotifyingTerritoryId(null);
    }
  };
  
  const filteredTerritories = territories.filter(t => {
      const type = t.type || 'urban';
      const matchesType = typeFilter === 'all' || type === typeFilter;
      
      let matchesStatus = true;
      let isOverdue: boolean = false;
      
      if (t.status === 'designado' && t.assignment?.dueDate) {
          isOverdue = t.assignment.dueDate.toDate() < new Date();
      }

      if (filterStatus === 'disponivel') {
          matchesStatus = t.status !== 'designado';
      } else if (filterStatus === 'designado') {
          matchesStatus = t.status === 'designado' && !isOverdue;
      } else if (filterStatus === 'atrasado') {
          matchesStatus = isOverdue;
      }

      const matchesSearch = searchTerm === '' || t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.number.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesType && matchesStatus && matchesSearch;
  }).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

  if(loading) return <div className="text-center p-8"><Loader className="animate-spin mx-auto text-primary" /></div>

  return (
    <>
      <div className="bg-card p-4 sm:p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Designar Territórios</h2>

        <div className="flex flex-col sm:flex-row gap-2 mb-4 p-2 bg-input/40 rounded-lg">
          <FilterButton label="Todos" value="all" currentFilter={typeFilter} setFilter={setTypeFilter} Icon={LayoutList} />
          <FilterButton label="Urbanos" value="urban" currentFilter={typeFilter} setFilter={setTypeFilter} Icon={Map} />
          <FilterButton label="Rurais" value="rural" currentFilter={typeFilter} setFilter={setTypeFilter} Icon={Trees} />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <input type="text" placeholder="Buscar por nome ou número..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-input rounded-md p-2 pl-10 border border-border"/>
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="bg-input rounded-md p-2 border border-border">
            <option value="all">Todos os status</option>
            <option value="disponivel">Disponível</option>
            <option value="designado">Designado</option>
            <option value="atrasado">Atrasado</option>
          </select>
        </div>
        
        <div className="border border-border rounded-lg">
          <div className="grid-cols-12 px-4 py-2 font-semibold text-muted-foreground hidden sm:grid border-b border-border">
            <div className="col-span-4 text-left">Território</div>
            <div className="col-span-2 text-left">Status</div>
            <div className="col-span-4 text-left">Designado a</div>
            <div className="col-span-2 text-right">Ações</div>
          </div>
          <Accordion type="multiple" className="w-full">
            {filteredTerritories.map(t => {
                const isDesignado = t.status === 'designado' && t.assignment;
                const isOverdue = isDesignado && t.assignment && t.assignment.dueDate.toDate() < new Date();
                const isNotifying = notifyingTerritoryId === t.id;
                
                return (
                  <AccordionItem value={t.id} key={t.id} className="border-b last:border-b-0">
                    <div className="flex items-center hover:bg-accent/50 transition-colors px-4 py-3">
                       <div className="flex-grow grid grid-cols-1 sm:grid-cols-12 items-center gap-y-2 gap-x-4">
                          <div className="col-span-12 sm:col-span-4 font-semibold text-left">
                              <Link href={t.type === 'rural' ? `/dashboard/rural/${t.id}` : `/dashboard/territorios/${t.id}`} className="hover:text-primary transition-colors">
                                  {t.number} - {t.name}
                              </Link>
                          </div>
                          <div className="col-span-6 sm:col-span-2 text-sm font-semibold text-left">
                              <span className="flex w-full">
                                  {isOverdue ? <span className="text-red-500">Atrasado</span> : (isDesignado ? <span className="text-yellow-400">Designado</span> : <span className="text-green-400">Disponível</span>)}
                              </span>
                          </div>
                          <div className="col-span-12 sm:col-span-4 text-sm text-muted-foreground text-left">
                              {t.assignment ? `${t.assignment.name} (até ${format(t.assignment.dueDate.toDate(), 'dd/MM/yy', { locale: ptBR })})` : 'N/A'}
                          </div>
                       </div>
                       <div className="flex items-center justify-end flex-shrink-0 ml-2 sm:col-span-2">
                           <Menu as="div" className="relative inline-block text-left">
                             <Menu.Button className="p-2 rounded-full hover:bg-white/10">
                                 <MoreVertical size={20} />
                             </Menu.Button>
                             <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                 <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-popover text-popover-foreground rounded-md shadow-lg z-20 ring-1 ring-black ring-opacity-5 focus:outline-none">
                                     <div className="p-1">
                                         {isDesignado ? (
                                             <>
                                                 <Menu.Item><button onClick={() => handleOpenReturnModal(t)} className='group flex rounded-md items-center w-full px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground'> <CheckCircle size={16} className="mr-2"/>Devolver</button></Menu.Item>
                                                 <Menu.Item><button onClick={() => handleOpenAssignModal(t)} className='group flex rounded-md items-center w-full px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground'> <RotateCw size={16} className="mr-2"/>Reatribuir</button></Menu.Item>
                                                 {isOverdue && <Menu.Item><button onClick={() => handleNotifyOverdue(t)} disabled={isNotifying} className='group flex rounded-md items-center w-full px-2 py-2 text-sm text-yellow-500 hover:bg-accent hover:text-accent-foreground disabled:opacity-50'> {isNotifying ? <Loader className="mr-2 animate-spin"/> : <Bell size={16} className="mr-2"/>}Notificar Atraso</button></Menu.Item>}
                                             </>
                                         ) : (
                                              <Menu.Item><button onClick={() => handleOpenAssignModal(t)} className='group flex rounded-md items-center w-full px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground'> <BookUser size={16} className="mr-2"/>Designar</button></Menu.Item>
                                         )}
                                     </div>
                                 </Menu.Items>
                             </Transition>
                           </Menu>
                           <AccordionTrigger className="p-2 hover:bg-white/10 rounded-full [&_svg]:h-4 [&_svg]:w-4">
                              <History />
                            </AccordionTrigger>
                       </div>
                    </div>
                    <AccordionContent>
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
        </div>
      </div>
      
      <AssignTerritoryModal 
        isOpen={isAssignModalOpen} 
        onClose={() => setIsAssignModalOpen(false)} 
        onSave={handleSaveAssignment} 
        territory={selectedTerritory} 
        users={users} 
      />
      <ReturnTerritoryModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        onConfirm={handleConfirmReturn}
        territory={selectedTerritory}
      />
      <AddEditAssignmentLogModal
        isOpen={isEditLogModalOpen}
        onClose={() => setIsEditLogModalOpen(false)}
        onSave={handleSaveHistoryLog}
        logToEdit={logToEdit}
      />
       <ConfirmationModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDeleteLog}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir o registro de ${logToDelete?.log.name}? Esta ação não pode ser desfeita.`}
      />
    </>
  );
}
