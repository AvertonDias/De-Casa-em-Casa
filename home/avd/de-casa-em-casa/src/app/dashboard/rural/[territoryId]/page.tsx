
"use client";

import { useState, useEffect, use } from 'react';
import { doc, onSnapshot, Timestamp, runTransaction, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';
import { RuralTerritory, RuralWorkLog } from '@/types/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Link as LinkIcon, Loader, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AddEditWorkLogModal from '@/components/AddEditWorkLogModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Button } from '@/components/ui/button';
import { EditRuralTerritoryModal } from '@/components/EditRuralTerritoryModal';
import withAuth from "@/components/withAuth";
import React from 'react';

interface RuralTerritoryDetailPageProps {
  params: Promise<{
    territoryId: string;
  }>;
}

function RuralTerritoryDetailPage({ params }: RuralTerritoryDetailPageProps) {
  const { user, loading: userLoading } = useUser();
  const resolvedParams = React.use(params);
  const { territoryId } = resolvedParams;
  const router = useRouter();

  const [territory, setTerritory] = useState<RuralTerritory | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [workNote, setWorkNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Estados para modais
  const [isEditTerritoryModalOpen, setIsEditTerritoryModalOpen] = useState(false);
  const [isWorkLogModalOpen, setIsWorkLogModalOpen] = useState(false);
  const [workLogToEdit, setWorkLogToEdit] = useState<RuralWorkLog | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [workLogToDelete, setWorkLogToDelete] = useState<RuralWorkLog | null>(null);
  const [isTerritoryDeleteConfirmOpen, setIsTerritoryDeleteConfirmOpen] = useState(false);


  useEffect(() => {
    if (userLoading) return;

    if (!territoryId || !user?.congregationId) {
        setLoading(false);
        return;
    }
    
    const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territoryId);
    
    const unsubscribe = onSnapshot(territoryRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().type === 'rural') {
        setTerritory({ id: docSnap.id, ...docSnap.data() } as RuralTerritory);
      } else {
        setTerritory(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [territoryId, user, userLoading]);

  const handleAddWorkLog = async () => {
    if (!workNote.trim() || !user || !territory) return;
    setIsSaving(true);
    
    const territoryRef = doc(db, 'congregations', user.congregationId!, 'territories', territory.id);
    
    try {
      await runTransaction(db, async (transaction) => {
        const territoryDoc = await transaction.get(territoryRef);
        if (!territoryDoc.exists()) { throw "Território não encontrado!"; }

        const currentLogs = territoryDoc.data().workLogs || [];
        const newLog: RuralWorkLog = {
          id: crypto.randomUUID(),
          date: Timestamp.now(),
          notes: workNote.trim(),
          userName: user.name,
          userId: user.uid,
        };
        const newLogsArray = [...currentLogs, newLog];
        transaction.update(territoryRef, { workLogs: newLogsArray, lastUpdate: Timestamp.now() });
      });
      setWorkNote('');
    } catch (error) {
      console.error("Erro na transação de adicionar registro:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWorkLog = async (logData: { notes: string }, logId?: string) => {
    if (!logId || !user?.congregationId || !territory) return;
    const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territory.id);
    
    try {
        await runTransaction(db, async (transaction) => {
            const territoryDoc = await transaction.get(territoryRef);
            if (!territoryDoc.exists()) { throw "Território não encontrado!"; }

            const currentLogs: RuralWorkLog[] = territoryDoc.data().workLogs || [];
            const newLogsArray = currentLogs.map(log => 
                log.id === logId ? { ...log, notes: logData.notes } : log
            );
            transaction.update(territoryRef, { workLogs: newLogsArray });
        });
    } catch (error) {
        console.error("Erro na transação de editar registro:", error);
    }
  };

  const handleDeleteWorkLog = async () => {
    if (!workLogToDelete || !user?.congregationId || !territory) return;
    const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territory.id);

    try {
        await runTransaction(db, async (transaction) => {
            const territoryDoc = await transaction.get(territoryRef);
            if (!territoryDoc.exists()) { throw "Território não encontrado!"; }
            
            const currentLogs: RuralWorkLog[] = territoryDoc.data().workLogs || [];
            const newLogsArray = currentLogs.filter(log => log.id !== workLogToDelete.id);
            transaction.update(territoryRef, { workLogs: newLogsArray });
        });
    } catch (error) {
      console.error("Erro na transação de excluir registro:", error);
    } finally {
        setIsConfirmDeleteOpen(false);
        setWorkLogToDelete(null);
    }
  };
  
   const handleDeleteTerritory = async () => {
    if (!user?.congregationId || !territory) return;

    try {
      const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territory.id);
      await deleteDoc(territoryRef);
      router.push('/dashboard/rural');
    } catch (error) {
      console.error("Erro ao excluir território:", error);
    } finally {
      setIsTerritoryDeleteConfirmOpen(false);
    }
  };


  const openEditWorkLogModal = (log: RuralWorkLog) => {
    setWorkLogToEdit(log);
    setIsWorkLogModalOpen(true);
  };

  const openDeleteConfirmModal = (log: RuralWorkLog) => {
    setWorkLogToDelete(log);
    setIsConfirmDeleteOpen(true);
  };

  const sortedWorkLogs = territory?.workLogs?.sort((a, b) => b.date.seconds - a.date.seconds) || [];

  if (userLoading || loading || !territoryId) return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-primary" size={32} /></div>;
  if (!territory) return <p className="text-center mt-10">Território não encontrado ou não é um território rural.</p>;

  const isAdmin = user?.role === 'Administrador';

  return (
    <>
      <div className="p-4 md:p-8 space-y-8">
        <div>
          <Link href="/dashboard/rural" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft size={16} className="mr-2" /> Voltar para Territórios Rurais
          </Link>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
              <div className="flex-grow">
                  <h1 className="text-3xl font-bold">{territory.number} - {territory.name}</h1>
                  <p className="text-lg text-muted-foreground mt-1">{territory.description}</p>
              </div>
              {isAdmin && user.congregationId && (
                <Button onClick={() => setIsEditTerritoryModalOpen(true)} className="w-full sm:w-auto">
                  <Edit size={16} className="mr-2"/> Editar Território
                </Button>
              )}
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg">
          <h2 className="font-semibold text-xl mb-4 flex items-center"><LinkIcon size={20} className="mr-3 text-primary" />Links Específicos</h2>
          <div className="space-y-3">
          {territory.links && territory.links.length > 0 ? (
              territory.links.map(link => (
              <a href={link.url} key={link.id} target="_blank" rel="noopener noreferrer" className="block text-blue-400 hover:underline">
                  {link.description}
              </a>
              ))
          ) : (
              <p className="text-muted-foreground italic text-sm">Nenhum link específico para este território.</p>
          )}
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg">
          <h2 className="font-semibold text-xl mb-4 flex items-center"><Calendar size={20} className="mr-3 text-primary" />Registrar Trabalho</h2>
          <textarea 
            value={workNote}
            onChange={(e) => setWorkNote(e.target.value)}
            placeholder="Digite uma observação sobre o trabalho de hoje... (Ex: Visitamos o setor leste, muitos não estavam em casa.)"
            rows={3}
            className="w-full bg-input p-2 rounded-md mb-3"
          />
          <Button onClick={handleAddWorkLog} disabled={isSaving || !workNote.trim()} className="w-full">
            {isSaving ? "Salvando..." : "Salvar Registro de Hoje"}
          </Button>
        </div>

        <div className="space-y-8">
          <div className="bg-card p-6 rounded-lg">
            <h2 className="font-semibold text-xl mb-4">Histórico de Trabalho</h2>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {sortedWorkLogs.length > 0 ? (
                  sortedWorkLogs.map(log => {
                      const canManageLog = user?.uid === log.userId || isAdmin;

                      return (
                      <div key={log.id} className="border-l-2 border-primary/50 pl-4">
                        <div className="flex justify-between items-start">
                           <div>
                              <p className="font-semibold text-sm">{format(log.date.toDate(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                              <p className="text-muted-foreground text-sm my-1">"{log.notes}"</p>
                              <p className="text-xs text-muted-foreground/80">por: {log.userName}</p>
                           </div>
                           {canManageLog && (
                             <div className="flex items-center gap-2">
                                <button onClick={() => openEditWorkLogModal(log)} className="text-muted-foreground hover:text-white"><Edit size={14} /></button>
                                <button onClick={() => openDeleteConfirmModal(log)} className="text-muted-foreground hover:text-red-500"><Trash2 size={14} /></button>
                             </div>
                           )}
                        </div>
                      </div>
                    );
                  })
              ) : (
                <p className="text-muted-foreground italic text-sm">Nenhum registro de trabalho encontrado.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {isAdmin && user.congregationId && territory && (
        <EditRuralTerritoryModal
          isOpen={isEditTerritoryModalOpen}
          onClose={() => setIsEditTerritoryModalOpen(false)}
          territory={territory} 
          congregationId={user.congregationId} 
          onTerritoryUpdated={() => setIsEditTerritoryModalOpen(false)}
          onDeleteRequest={() => setIsTerritoryDeleteConfirmOpen(true)}
        />
      )}

      <AddEditWorkLogModal
        isOpen={isWorkLogModalOpen}
        onClose={() => setIsWorkLogModalOpen(false)}
        onSave={handleSaveWorkLog}
        workLogToEdit={workLogToEdit}
      />

      <ConfirmationModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleDeleteWorkLog}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir o registro: "${workLogToDelete?.notes}"?`}
        confirmText="Sim, Excluir"
      />
      
       <ConfirmationModal
        isOpen={isTerritoryDeleteConfirmOpen}
        onClose={() => setIsTerritoryDeleteConfirmOpen(false)}
        onConfirm={handleDeleteTerritory}
        title="Excluir Território Rural"
        message={`Tem certeza que deseja excluir permanentemente o território "${territory?.name}"? Esta ação não pode ser desfeita.`}
      />
    </>
  );
}

export default withAuth(RuralTerritoryDetailPage);

    