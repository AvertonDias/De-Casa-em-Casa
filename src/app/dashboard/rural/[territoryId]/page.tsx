"use client";

import { useState, useEffect, useContext } from 'react';
import { doc, onSnapshot, Timestamp, runTransaction, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserContext } from '@/contexts/UserContext';
import { RuralTerritory, RuralWorkLog, AssignmentHistoryLog, Assignment } from '@/types/types';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Link as LinkIcon, Loader, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AddEditWorkLogModal from '@/components/AddEditWorkLogModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Button } from '@/components/ui/button';
import { EditRuralTerritoryModal } from '@/components/EditRuralTerritoryModal';
import AssignmentHistory from '@/components/AssignmentHistory';
import AddEditAssignmentLogModal from '@/components/admin/AddEditAssignmentLogModal';

export default function RuralTerritoryDetailPage() {
  const { user } = useContext(UserContext);
  const params = useParams<{ territoryId: string }>();
  const [territory, setTerritory] = useState<RuralTerritory | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [workNote, setWorkNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Estados para modais de trabalho
  const [isEditTerritoryModalOpen, setIsEditTerritoryModalOpen] = useState(false);
  const [isWorkLogModalOpen, setIsWorkLogModalOpen] = useState(false);
  const [workLogToEdit, setWorkLogToEdit] = useState<RuralWorkLog | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [workLogToDelete, setWorkLogToDelete] = useState<RuralWorkLog | null>(null);
  
  // Estados para modais de histórico de designação
  const [isEditLogModalOpen, setIsEditLogModalOpen] = useState(false);
  const [historyLogToEdit, setHistoryLogToEdit] = useState<AssignmentHistoryLog | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; title: string; message: string; } | null>(null);

  useEffect(() => {
    if (!user?.congregationId || !params.territoryId) {
        if (user) setLoading(false);
        return;
    }
    const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', params.territoryId);
    const unsubscribe = onSnapshot(territoryRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().type === 'rural') {
        setTerritory({ id: docSnap.id, ...docSnap.data() } as RuralTerritory);
      } else {
        setTerritory(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, params.territoryId]);

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
  
  const openEditWorkLogModal = (log: RuralWorkLog) => {
    setWorkLogToEdit(log);
    setIsWorkLogModalOpen(true);
  };

  const openDeleteConfirmModal = (log: RuralWorkLog) => {
    setWorkLogToDelete(log);
    setIsConfirmDeleteOpen(true);
  };
  
  const handleOpenEditLogModal = (log: AssignmentHistoryLog) => {
    setHistoryLogToEdit(log);
    setIsEditLogModalOpen(true);
  };

  const handleSaveHistoryLog = async (logId: string, updatedData: { name: string; assignedAt: string; completedAt: string }) => {
    if (!user?.congregationId || !territory) return;
    const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territory.id);

    try {
      await runTransaction(db, async (transaction) => {
        const territoryDoc = await transaction.get(territoryRef);
        if (!territoryDoc.exists()) throw "Território não encontrado";
        
        const currentHistory: AssignmentHistoryLog[] = territoryDoc.data().assignmentHistory || [];
        const newHistory = currentHistory.map(log => {
          if ((log as any).id === logId) { // Assumindo que log tem 'id'
            return {
              ...log,
              name: updatedData.name,
              assignedAt: Timestamp.fromDate(new Date(updatedData.assignedAt)),
              completedAt: Timestamp.fromDate(new Date(updatedData.completedAt)),
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
  
  const handleDeleteHistoryLog = (logToDelete: AssignmentHistoryLog) => {
    if (!user?.congregationId || !territory) return;
    setConfirmAction({
      action: async () => {
        const territoryRef = doc(db, 'congregations', user!.congregationId!, 'territories', territory.id);
        const currentHistory = territory.assignmentHistory || [];
        const newHistory = currentHistory.filter(log => (log as any).id !== (logToDelete as any).id);
        await updateDoc(territoryRef, { assignmentHistory: newHistory });
        setIsConfirmDeleteOpen(false);
      },
      message: `Tem certeza que deseja EXCLUIR o registro de ${logToDelete.name}?`,
      title: "Confirmar Exclusão de Registro"
    });
    setIsConfirmDeleteOpen(true);
  };

  const sortedWorkLogs = territory?.workLogs?.sort((a, b) => b.date.seconds - a.date.seconds) || [];

  if (loading || !user) return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-primary" size={32} /></div>;
  if (!territory) return <p className="text-center mt-10">Território não encontrado ou não é um território rural.</p>;

  const isAdmin = user.role === 'Administrador';

  return (
    <>
      <div className="p-4 md:p-8 space-y-8">
        <div>
          <Link href="/dashboard/rural" className="flex items-center text-sm text-muted-foreground hover:text-white mb-2">
            <ArrowLeft size={16} className="mr-2" /> Voltar para Territórios Rurais
          </Link>
          <div className="flex justify-between items-start">
              <div>
                  <h1 className="text-3xl font-bold">{territory.number} - {territory.name}</h1>
                  <p className="text-lg text-muted-foreground mt-1">{territory.description}</p>
              </div>
              {isAdmin && user.congregationId && (
                <button onClick={() => setIsEditTerritoryModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md flex items-center">
                  <Edit size={16} className="mr-2"/> Editar
                </button>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                <h2 className="font-semibold text-xl mb-4">Histórico de Trabalho</h2>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {sortedWorkLogs.length > 0 ? (
                    sortedWorkLogs.map(log => {
                        const canManageLog = user.uid === log.userId || isAdmin;

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
        
        {isAdmin && (
          <AssignmentHistory
            currentAssignment={territory.assignment}
            pastAssignments={territory.assignmentHistory || []}
            onEdit={handleOpenEditLogModal}
            onDelete={handleDeleteHistoryLog}
          />
        )}
      </div>

      {isAdmin && user.congregationId && territory && (
        <EditRuralTerritoryModal
          isOpen={isEditTerritoryModalOpen}
          onClose={() => setIsEditTerritoryModalOpen(false)}
          territory={territory} 
          congregationId={user.congregationId} 
          onTerritoryUpdated={() => setIsEditTerritoryModalOpen(false)}
        />
      )}

      <AddEditWorkLogModal
        isOpen={isWorkLogModalOpen}
        onClose={() => setIsWorkLogModalOpen(false)}
        onSave={handleSaveWorkLog}
        workLogToEdit={workLogToEdit}
      />
      
      <AddEditAssignmentLogModal
        isOpen={isEditLogModalOpen}
        onClose={() => setIsEditLogModalOpen(false)}
        onSave={handleSaveHistoryLog}
        logToEdit={historyLogToEdit}
      />

      <ConfirmationModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleDeleteWorkLog}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir o registro: "${workLogToDelete?.notes}"?`}
        confirmText="Sim, Excluir"
      />

      {confirmAction && <ConfirmationModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={confirmAction.action}
        title={confirmAction.title}
        message={confirmAction.message}
        isLoading={false} />}
    </>
  );
}
