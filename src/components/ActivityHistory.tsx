
"use client";

import { useState } from 'react';
import { Activity } from '@/types/types';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ChevronDown, Plus, Edit, Trash2, History } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AddEditActivityModal from './AddEditActivityModal';
import { ConfirmationModal } from './ConfirmationModal'; 
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


interface ActivityHistoryProps {
  territoryId: string;
  history: Activity[];
}

export default function ActivityHistory({ territoryId, history }: ActivityHistoryProps) {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(true); // Manter aberto por padrão
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState<Activity | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<string | null>(null);

  const canManage = user?.role === 'Administrador' || user?.role === 'Dirigente';
  const historyCollectionRef = user?.congregationId ? collection(db, `congregations/${user.congregationId}/territories/${territoryId}/activityHistory`) : null;
  const territoryDocRef = user?.congregationId ? doc(db, `congregations/${user.congregationId}/territories/${territoryId}`) : null;

  const handleSaveActivity = async (
    activityData: { activityDate: Date, notes: string }, 
    activityId?: string
  ) => {
    if (!user || !historyCollectionRef || !territoryDocRef) return;
    
    const now = serverTimestamp();

    try {
      if (activityId) {
        const activityDocRef = doc(historyCollectionRef, activityId);
        await updateDoc(activityDocRef, {
          activityDate: Timestamp.fromDate(activityData.activityDate),
          notes: activityData.notes,
          description: activityData.notes,
        });
      } else {
        await addDoc(historyCollectionRef, {
          activityDate: Timestamp.fromDate(activityData.activityDate),
          notes: activityData.notes,
          description: activityData.notes,
          userName: user.name,
          userId: user.uid,
          createdAt: now,
          type: 'manual',
        });
      }
      await updateDoc(territoryDocRef, { lastUpdate: now });

    } catch (error) {
      console.error("Erro ao salvar atividade:", error);
    }
  };

  const handleDeleteActivity = async () => {
    if (!activityToDelete || !historyCollectionRef) return;
    try {
      const activityDocRef = doc(historyCollectionRef, activityToDelete);
      await deleteDoc(activityDocRef);
    } catch (error) {
      console.error("Erro ao deletar atividade:", error);
    } finally {
      setIsConfirmModalOpen(false);
      setActivityToDelete(null);
    }
  };

  const openEditModal = (activity: Activity) => {
    setActivityToEdit(activity);
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setActivityToEdit(null);
    setIsModalOpen(true);
  };

  const openConfirmModal = (id: string) => {
    setActivityToDelete(id);
    setIsConfirmModalOpen(true);
  };
  
  // Função para agrupar atividades pelo mesmo dia
  const groupActivitiesByDay = (activities: Activity[]) => {
    return activities.reduce((acc, activity) => {
      const date = format(activity.activityDate.toDate(), 'yyyy-MM-dd');
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(activity);
      return acc;
    }, {} as Record<string, Activity[]>);
  };

  const groupedHistory = groupActivitiesByDay(history);
  const sortedDays = Object.keys(groupedHistory).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());


  return (
    <>
      <div className="bg-card p-4 rounded-lg shadow-md">
        <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center font-semibold text-lg">
          <div className="flex items-center"><History className="mr-3 text-primary" />Histórico de Trabalho ({history.length})</div>
          <ChevronDown className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        
        {isOpen && (
          <div className="mt-4 pt-4 border-t border-border">
            {canManage && (
              <div className="mb-4">
                <button onClick={openAddModal} className="w-full flex items-center justify-center p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                  <Plus className="mr-2 h-4 w-4" /> Adicionar Registro Manual
                </button>
              </div>
            )}
            
            {history.length > 0 ? (
              <Accordion type="multiple" className="w-full space-y-2">
                {sortedDays.map(date => {
                   const activities = groupedHistory[date];
                   const workLogs = activities.filter(a => a.type === 'work');
                   const manualLogs = activities.filter(a => a.type === 'manual');
                   
                   let triggerTitle = "Nenhuma atividade registrada";
                    if (workLogs.length > 0 && manualLogs.length > 0) {
                      triggerTitle = `Trabalho em ${workLogs.length} casa(s) e ${manualLogs.length} registro(s) manual(is)`;
                    } else if (workLogs.length > 0) {
                      triggerTitle = `Trabalho realizado em ${workLogs.length} casa(s)`;
                    } else if (manualLogs.length > 0) {
                      triggerTitle = `${manualLogs.length} registro(s) manual(is)`;
                    }

                  return (
                    <AccordionItem value={date} key={date} className="bg-muted/30 rounded-lg px-4 border-b-0">
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="text-left">
                          <p className="font-semibold text-base">{format(new Date(date + 'T12:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                          <p className="text-sm text-muted-foreground">{triggerTitle}</p>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-2 border-t border-border">
                           {activities.map(activity => (
                             <div key={activity.id} className="text-sm">
                               <div className="flex justify-between items-start">
                                 <p className="italic text-muted-foreground flex-1" style={{ whiteSpace: 'pre-line' }}>
                                    "{activity.description || activity.notes}"
                                 </p>
                                 {canManage && activity.type === 'manual' && (
                                   <div className="flex space-x-2 ml-2">
                                     <button onClick={() => openEditModal(activity)} className="p-1 text-muted-foreground hover:text-white"><Edit size={14}/></button>
                                     <button onClick={() => openConfirmModal(activity.id)} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 size={14}/></button>
                                   </div>
                                 )}
                               </div>
                               <p className="text-xs text-muted-foreground/80 mt-1">
                                 Registrado por: {' '}
                                 {activity.userName || 'Desconhecido'}
                               </p>
                             </div>
                           ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            ) : (
              <p className="text-center text-muted-foreground py-4">Nenhum registro encontrado.</p>
            )}
          </div>
        )}
      </div>

      <AddEditActivityModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveActivity}
        activityToEdit={activityToEdit}
      />
      
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleDeleteActivity}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir esta entrada do histórico? Esta ação não pode ser desfeita."
      />
    </>
  );
}
