"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteField, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { Territory } from '@/types/types';
import { Map, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import Link from 'next/link'; // Importando o Link

export default function MyTerritoriesPage() {
  const { user } = useUser();
  const [assignedTerritories, setAssignedTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para o modal de confirmação
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [territoryToReturn, setTerritoryToReturn] = useState<Territory | null>(null);

  useEffect(() => {
    if (!user?.congregationId || !user?.uid) {
      setLoading(false);
      return;
    }
    const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
    // Busca territórios onde 'assignment.uid' seja igual ao UID do usuário logado
    const q = query(territoriesRef, where("assignment.uid", "==", user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory));
      setAssignedTerritories(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

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
      completedAt: serverTimestamp(),
    };
    await updateDoc(territoryRef, {
      status: 'disponivel',
      assignment: deleteField(),
      assignmentHistory: arrayUnion(historyLog)
    });
    setIsConfirmModalOpen(false);
  };

  return (
    <>
      <div className="p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Meus Territórios Designados</h1>
          <p className="text-muted-foreground">Aqui estão os territórios que estão sob sua responsabilidade.</p>
        </div>

        {loading ? <p>Carregando...</p> : assignedTerritories.length > 0 ? (
          <div className="space-y-4">
            {assignedTerritories.map(t => (
              <div key={t.id} className="bg-card p-4 rounded-lg shadow-md">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                  <div className="mb-4 sm:mb-0">
                    <Link href={t.type === 'rural' ? `/dashboard/rural/${t.id}` : `/dashboard/territorios/${t.id}`}>
                      <h2 className="font-bold text-xl hover:text-primary transition-colors">{t.number} - {t.name}</h2>
                    </Link>
                    <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                      <Clock size={14} />
                      <span>Devolver até: {format(t.assignment!.dueDate.toDate(), 'dd/MM/yyyy', { locale: ptBR })}</span>
                    </div>
                  </div>
                  <button onClick={() => handleOpenReturnModal(t)} className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold py-2 px-4 rounded-md flex items-center justify-center">
                    <CheckCircle size={16} className="mr-2"/> Devolver Território
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-8 text-muted-foreground">Você não tem nenhum território designado no momento.</p>
        )}
      </div>

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleReturnTerritory}
        title="Confirmar Devolução"
        message={`Você tem certeza que deseja devolver o território "${territoryToReturn?.name}"?`}
      />
    </>
  );
}
