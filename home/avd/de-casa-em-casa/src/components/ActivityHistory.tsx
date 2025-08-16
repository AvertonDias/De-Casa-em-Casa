
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

interface ActivityHistoryProps {
  territoryId: string;
  history: Activity[];
}

export default function ActivityHistory({ territoryId, history }: ActivityHistoryProps) {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
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
          description: activityData.notes, // Atualiza description para consistência
        });
      } else {
        await addDoc(historyCollectionRef, {
          type: 'manual', // Indica que é um registro manual
          activityDate: Timestamp.fromDate(activityData.activityDate),
          description: activityData.notes,
          userName: user.name,
          userId: user.uid,
          createdAt: now,
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
  
  const cleanDescription = (description: string) => {
    return description.replace(/\n?Registrado por: Sistema/g, '').trim();
  }

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
                  <Plus className="mr-2 h-4 w-4" /> Adicionar Registro
                </button>
              </div>
            )}
            
            {history.length > 0 ? (
              <ul className="space-y-4">
                {history.map((activity) => (
                  <li key={activity.id} className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-base">
                        {activity.activityDate ? format(activity.activityDate.toDate(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'Data não registrada'}
                      </p>
                      {activity.description && (
                        <p className="text-sm mt-1 text-muted-foreground italic" style={{ whiteSpace: 'pre-line' }}>
                            {cleanDescription(activity.description)}
                        </p>
                      )}
                      
                      <p className="text-xs text-muted-foreground mt-2">
                        Registrado por: {' '}
                        {activity.userId === 'automatic_system_log' ? 'Sistema' : activity.userName || 'Desconhecido'}
                      </p>
                    </div>
                    {canManage && activity.type !== 'work' && ( // Impede a edição do log automático do sistema
                      <div className="flex space-x-2">
                        <button onClick={() => openEditModal(activity)} className="p-1 text-muted-foreground hover:text-white"><Edit size={16}/></button>
                        <button onClick={() => openConfirmModal(activity.id)} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 size={16}/></button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
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
