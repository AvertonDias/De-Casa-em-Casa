
"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteField, arrayUnion, Timestamp, writeBatch, getDocs } from 'firebase/firestore';
import { Territory, Notification } from '@/types/types';
import { Map, Clock, CheckCircle, Loader, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import withAuth from '@/components/withAuth';
import Link from 'next/link';

function MyTerritoriesPage() {
  const { user } = useUser();
  const [assignedTerritories, setAssignedTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [territoryToReturn, setTerritoryToReturn] = useState<Territory | null>(null);

  useEffect(() => {
    if (!user?.congregationId || !user?.uid) {
      if(user) setLoading(false);
      return;
    }
    const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
    const q = query(territoriesRef, where("assignment.uid", "==", user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const territoriesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory));
      setAssignedTerritories(territoriesData);
      setLoading(false);

      // Sincronização automática
      if (territoriesData.length > 0) {
        syncOldNotifications(territoriesData, user.uid);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const syncOldNotifications = async (territories: Territory[], userId: string) => {
    try {
      const notificationsRef = collection(db, 'users', userId, 'notifications');
      const q = query(notificationsRef, where('type', '==', 'territory_assigned'));
      const existingNotifsSnapshot = await getDocs(q);
      const existingNotifLinks = new Set(existingNotifsSnapshot.docs.map(doc => doc.data().link));

      const batch = writeBatch(db);
      let notificationsAdded = 0;

      territories.forEach(territory => {
        const territoryLink = `/dashboard/territorios/${territory.id}`;
        if (!existingNotifLinks.has(territoryLink)) {
          const notification: Omit<Notification, 'id'> = {
            title: "Território Designado",
            body: `O território "${territory.name}" foi designado para você.`,
            link: territoryLink,
            type: 'territory_assigned',
            isRead: false, // <-- ALTERAÇÃO PRINCIPAL AQUI
            createdAt: territory.assignment?.assignedAt || Timestamp.now(),
          };
          const newNotifRef = doc(collection(db, `users/${userId}/notifications`));
          batch.set(newNotifRef, notification);
          notificationsAdded++;
        }
      });
      
      if (notificationsAdded > 0) {
        await batch.commit();
      }
    } catch (error) {
      console.error("Erro ao sincronizar notificações automaticamente:", error);
    }
  };

  const handleOpenReturnModal = (territory: Territory) => {
    setTerritoryToReturn(territory);
    setIsConfirmModalOpen(true);
  };
  
  const handleReturnTerritory = async () => {
    if (!territoryToReturn || !user?.congregationId || !territoryToReturn.assignment) return;
    
    const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territoryToReturn.id);
    
    const historyLog = {
      uid: territoryToReturn.assignment.uid,
      name: territoryToReturn.assignment.name,
      assignedAt: territoryToReturn.assignment.assignedAt,
      completedAt: Timestamp.now(), 
    };

    try {
      await updateDoc(territoryRef, {
        status: 'disponivel',
        assignment: deleteField(),
        assignmentHistory: arrayUnion(historyLog)
      });
    } catch(error) {
      console.error("Erro ao devolver o território:", error);
    } finally {
      setIsConfirmModalOpen(false);
      setTerritoryToReturn(null);
    }
  };

  if (loading) {
      return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-primary"/></div>
  }

  return (
    <>
      <div className="p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Meus Territórios Designados</h1>
          <p className="text-muted-foreground">Aqui estão os territórios que estão sob sua responsabilidade.</p>
        </div>

        {assignedTerritories.length > 0 ? (
          <div className="space-y-4">
            {assignedTerritories.map(t => {
              const isOverdue = t.assignment && t.assignment.dueDate.toDate() < new Date();
              return (
                <div key={t.id} className={`bg-card p-4 rounded-lg shadow-md ${isOverdue ? 'border-l-4 border-red-500' : ''}`}>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                    <div className="mb-4 sm:mb-0">
                      <Link href={t.type === 'rural' ? `/dashboard/rural/${t.id}` : `/dashboard/territorios/${t.id}`}>
                          <h2 className="font-bold text-xl hover:text-primary transition-colors">{t.number} - {t.name}</h2>
                      </Link>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <Clock size={14} />
                        <span>Devolver até: {t.assignment?.dueDate ? format(t.assignment.dueDate.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}</span>
                      </div>
                       {isOverdue && (
                        <div className="text-sm text-red-500 font-semibold flex items-center gap-2 mt-1">
                            <AlertTriangle size={14} />
                            <span>ATRASADO! Por favor, devolva o quanto antes.</span>
                        </div>
                       )}
                    </div>
                    <button onClick={() => handleOpenReturnModal(t)} className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold py-2 px-4 rounded-md flex items-center justify-center">
                      <CheckCircle size={16} className="mr-2"/> Devolver Território
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center p-8 bg-card rounded-lg">
            <p className="text-muted-foreground">Você não tem nenhum território designado no momento.</p>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleReturnTerritory}
        title="Confirmar Devolução"
        message={`Você tem certeza que deseja devolver o território "${territoryToReturn?.name}"?`}
        confirmText="Sim, Devolver"
        cancelText="Cancelar"
      />
    </>
  );
}

export default withAuth(MyTerritoriesPage);
