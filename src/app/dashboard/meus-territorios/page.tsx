
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteField, arrayUnion, Timestamp } from 'firebase/firestore';
import { Territory } from '@/types/types';
import { Map, Clock, CheckCircle, Loader, AlertTriangle, ArrowDownUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import withAuth from '@/components/withAuth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

function MyTerritoriesPage() {
  const { user } = useUser();
  const [assignedTerritories, setAssignedTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [territoryToReturn, setTerritoryToReturn] = useState<Territory | null>(null);

  const [sortBy, setSortBy] = useState<'dueDate' | 'number'>('dueDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (!user?.congregationId || !user?.uid) {
      if(user) setLoading(false);
      return;
    }
    const territoriesRef = collection(db, 'congregations', user.congregationId, 'territories');
    const q = query(territoriesRef, where("assignment.uid", "==", user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Territory));
      setAssignedTerritories(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const sortedTerritories = useMemo(() => {
    return [...assignedTerritories].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'number') {
        comparison = a.number.localeCompare(b.number, undefined, { numeric: true });
      } else { // Default to 'dueDate'
        const dateA = a.assignment?.dueDate?.toMillis() || 0;
        const dateB = b.assignment?.dueDate?.toMillis() || 0;
        comparison = dateA - dateB;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [assignedTerritories, sortBy, sortDirection]);

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
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Meus Territórios Designados</h1>
            <p className="text-muted-foreground">Aqui estão os territórios que estão sob sua responsabilidade.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'dueDate' | 'number')}
                className="bg-input rounded-md p-2 border border-border"
            >
                <option value="dueDate">Data de Devolução</option>
                <option value="number">Número</option>
            </select>
             <Button 
              variant="outline" 
              size="icon"
              onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
              title={`Ordenar ${sortDirection === 'asc' ? 'descendente' : 'ascendente'}`}
            >
                <ArrowDownUp size={16} className="text-muted-foreground" />
            </Button>
          </div>
        </div>

        {sortedTerritories.length > 0 ? (
          <div className="space-y-4">
            {sortedTerritories.map(t => {
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
