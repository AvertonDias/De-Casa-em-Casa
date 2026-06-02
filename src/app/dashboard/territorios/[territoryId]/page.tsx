
"use client";

import { doc, onSnapshot, collection, updateDoc, serverTimestamp, query, orderBy, Timestamp, runTransaction, getDocs, writeBatch, deleteField, getDoc, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import { useUser } from "@/contexts/UserContext"; 
import { Territory, Activity, Quadra, AssignmentHistoryLog } from "@/types/types"; 
import { ArrowLeft, Edit, Plus, LayoutGrid, BarChart, History, Loader } from "lucide-react";
import Link from 'next/link';

import ActivityHistory from '@/components/ActivityHistory';
import AssignmentHistory from '@/components/AssignmentHistory';
import QuadraCard from '@/components/QuadraCard';
import EditTerritoryModal from '@/components/EditTerritoryModal';
import AddQuadraModal from '@/components/AddQuadraModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import ImagePreviewModal from "@/components/ImagePreviewModal";
import withAuth from "@/components/withAuth";
import AddEditAssignmentLogModal from "@/components/admin/AddEditAssignmentLogModal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { logEvent } from "@/lib/audit";
import { EditQuadraModal } from "@/components/EditQuadraModal";

const ProgressSection = ({ territory }: { territory: Territory }) => {
    const totalHouses = territory.stats?.totalHouses || 0;
    const housesDone = territory.stats?.housesDone || 0;
    const progressPercentage = territory.progress ? Math.round(territory.progress * 100) : 0;
    return (
        <div className="bg-card p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4 flex items-center"><BarChart className="mr-3 text-primary" />Progresso Geral</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{totalHouses}</p></div>
                <div><p className="text-sm text-muted-foreground">Feitas</p><p className="font-bold text-2xl text-green-400">{housesDone}</p></div>
                <div><p className="text-sm text-muted-foreground">Pendentes</p><p className="font-bold text-2xl text-yellow-400">{totalHouses - housesDone}</p></div>
                <div><p className="text-sm text-muted-foreground">Progresso</p><p className="font-bold text-2xl text-blue-400">{progressPercentage}%</p></div>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 mt-4"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progressPercentage}%` }}></div></div>
        </div>
    );
};

function TerritoryDetailPage({ params }: { params: { territoryId: string } }) {
  const { territoryId } = params;
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [territory, setTerritory] = useState<Territory | null>(null);
  const [activityHistory, setActivityHistory] = useState<Activity[]>([]);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditTerritoryModalOpen, setIsEditTerritoryModalOpen] = useState(false);
  const [isAddQuadraModalOpen, setIsAddQuadraModalOpen] = useState(false);
  const [isEditQuadraModalOpen, setIsEditQuadraModalOpen] = useState(false);
  const [selectedQuadra, setSelectedQuadra] = useState<Quadra | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ action: () => Promise<void>; title: string; message: string; } | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [isEditLogModalOpen, setIsEditLogModalOpen] = useState(false);
  const [historyLogToEdit, setHistoryLogToEdit] = useState<AssignmentHistoryLog | null>(null);
  
  useEffect(() => {
    if (!user?.congregationId || !territoryId) return;
    const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territoryId);
    
    const unsubTerritory = onSnapshot(territoryRef, (docSnap) => { 
        if (docSnap.exists()) setTerritory({ id: docSnap.id, ...docSnap.data() } as Territory);
        else setTerritory(null);
        setLoading(false);
    });

    const historyQuery = query(collection(territoryRef, 'activityHistory'), orderBy("activityDate", "desc"));
    const unsubHistory = onSnapshot(historyQuery, (snapshot) => setActivityHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity))));

    const quadrasQuery = query(collection(territoryRef, 'quadras'), orderBy('name', 'asc'));
    const unsubQuadras = onSnapshot(quadrasQuery, (snapshot) => setQuadras(snapshot.docs.map(qDoc => ({...qDoc.data(), id: qDoc.id} as Quadra))));

    return () => { unsubTerritory(); unsubHistory(); unsubQuadras(); };
  }, [territoryId, user]);

  const handleSaveTerritory = async (tid: string, data: Partial<Territory>) => {
      if (!user?.congregationId) return;
      await updateDoc(doc(db, 'congregations', user.congregationId, 'territories', tid), { ...data, lastUpdate: serverTimestamp() });
      logEvent(user.congregationId, user.uid, user.name, 'TERRITORY_EDITED', `Editou os dados do território ${territory?.number} - ${territory?.name}.`, { territoryId: tid });
      toast({ title: "Território atualizado" });
  };

  const handleAddQuadra = async (data: { name: string, description: string }) => {
    if (!user?.congregationId) return;
    const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territoryId);
    await runTransaction(db, async (transaction) => {
        const terrDoc = await transaction.get(territoryRef);
        const newQuadraRef = doc(collection(territoryRef, 'quadras'));
        transaction.set(newQuadraRef, { ...data, totalHouses: 0, housesDone: 0, createdAt: serverTimestamp() });
        transaction.update(territoryRef, { quadraCount: (terrDoc.data()?.quadraCount || 0) + 1 });
    }).then(() => {
        logEvent(user.congregationId!, user.uid, user.name, 'QUADRA_CREATED', `Adicionou a quadra "${data.name}" ao território ${territory?.number}.`, { territoryId, quadraName: data.name, territoryNumber: territory?.number });
    });
  };

  const handleEditQuadraClick = (e: React.MouseEvent, quadra: Quadra) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedQuadra(quadra);
    setIsEditQuadraModalOpen(true);
  };

  const handleSaveQuadra = async (quadraId: string, updatedData: { name: string; description: string }) => {
    if (!user?.congregationId || !territoryId) return;
    const quadraRef = doc(db, 'congregations', user.congregationId, 'territories', territoryId, 'quadras', quadraId);
    await updateDoc(quadraRef, updatedData);
    logEvent(user.congregationId, user.uid, user.name, 'QUADRA_EDITED', `Editou a quadra "${updatedData.name}" no território ${territory?.number}.`, { territoryId, quadraId, territoryNumber: territory?.number });
    toast({ title: "Quadra atualizada" });
  };

  const handleDeleteQuadra = async (quadraId: string) => {
    setConfirmAction({
      title: "Excluir Quadra",
      message: "Isso apagará todas as casas desta quadra. Esta ação é irreversível.",
      action: async () => {
        setIsProcessingAction(true);
        try {
          if (!user?.congregationId || !territoryId) return;
          const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', territoryId);
          const quadraRef = doc(territoryRef, 'quadras', quadraId);
          
          const quadraDoc = await getDoc(quadraRef);
          if (quadraDoc.exists()) {
            const qData = quadraDoc.data();
            const housesDoneInQuadra = qData.housesDone || 0;
            const totalHousesInQuadra = qData.totalHouses || 0;
            
            const housesSnap = await getDocs(collection(quadraRef, 'casas'));
            const housesData: any[] = [];
            housesSnap.forEach(h => housesData.push({ id: h.id, ...h.data() }));

            const terrDoc = await getDoc(territoryRef);
            if (terrDoc.exists()) {
              const tData = terrDoc.data();
              const newTotalHouses = Math.max(0, (tData.stats?.totalHouses || 0) - totalHousesInQuadra);
              const newHousesDone = Math.max(0, (tData.stats?.housesDone || 0) - housesDoneInQuadra);
              const newProgress = newTotalHouses > 0 ? newHousesDone / newTotalHouses : 0;

              await updateDoc(territoryRef, {
                "stats.totalHouses": newTotalHouses,
                "stats.housesDone": newHousesDone,
                progress: newProgress,
                quadraCount: Math.max(0, (tData.quadraCount || 0) - 1)
              });

              const congRef = doc(db, 'congregations', user.congregationId);
              const congDoc = await getDoc(congRef);
              if (congDoc.exists()) {
                const cData = congDoc.data();
                await updateDoc(congRef, {
                    totalHouses: Math.max(0, (cData.totalHouses || 0) - totalHousesInQuadra),
                    totalHousesDone: Math.max(0, (cData.totalHousesDone || 0) - housesDoneInQuadra)
                });
              }
            }

            const batch = writeBatch(db);
            housesSnap.forEach(h => batch.delete(h.ref));
            batch.delete(quadraRef);
            await batch.commit();

            logEvent(user.congregationId, user.uid, user.name, 'QUADRA_DELETED', `Excluiu a quadra "${qData.name}" do território ${territory?.number}.`, { 
                territoryId, 
                quadraId, 
                territoryNumber: territory?.number,
                revertData: { quadra: qData, casas: housesData }
            });
            toast({ title: "Quadra excluída" });
          }
        } catch (error) {
          console.error("Erro ao deletar quadra:", error);
          toast({ title: "Erro ao deletar", variant: "destructive" });
        } finally {
          setIsProcessingAction(false);
          setIsConfirmModalOpen(false);
          setIsEditQuadraModalOpen(false);
        }
      }
    });
    setIsConfirmModalOpen(true);
  };

  const handleDeleteTerritory = (tid: string) => {
    setConfirmAction({
      title: "Excluir Território",
      message: "Isso apagará todas as quadras e casas deste território. Esta ação é irreversível.",
      action: async () => {
        setIsProcessingAction(true);
        try {
          const congregationId = user!.congregationId!;
          const territoryRef = doc(db, 'congregations', congregationId, 'territories', tid);
          const quadrasSnap = await getDocs(collection(territoryRef, 'quadras'));
          
          const revertData: any = {
            territory: { ...territory, id: tid },
            quadras: []
          };

          const batch = writeBatch(db);

          for (const qDoc of quadrasSnap.docs) {
              const housesSnap = await getDocs(collection(qDoc.ref, 'casas'));
              const housesData: any[] = [];
              housesSnap.forEach(h => {
                housesData.push({ id: h.id, ...h.data() });
                batch.delete(h.ref);
              });
              revertData.quadras.push({ id: qDoc.id, ...qDoc.data(), casas: housesData });
              batch.delete(qDoc.ref);
          }
          
          const histSnap = await getDocs(collection(territoryRef, 'activityHistory'));
          histSnap.forEach(h => batch.delete(h.ref));
          batch.delete(territoryRef);

          const congRef = doc(db, 'congregations', congregationId);
          const congSnap = await getDoc(congRef);
          if (congSnap.exists()) {
              const cData = congSnap.data();
              const housesToRemove = territory?.stats?.totalHouses || 0;
              const housesDoneToRemove = territory?.stats?.housesDone || 0;
              batch.update(congRef, {
                  territoryCount: Math.max(0, (cData.territoryCount || 0) - (territory?.type === 'rural' ? 0 : 1)),
                  ruralTerritoryCount: Math.max(0, (cData.ruralTerritoryCount || 0) - (territory?.type === 'rural' ? 1 : 0)),
                  totalHouses: Math.max(0, (cData.totalHouses || 0) - housesToRemove),
                  totalHousesDone: Math.max(0, (cData.totalHousesDone || 0) - housesDoneToRemove)
              });
          }
          
          await batch.commit();

          logEvent(congregationId, user!.uid, user!.name, 'TERRITORY_DELETED', `Excluiu o território ${territory?.number}.`, { territoryId: tid, territoryNumber: territory?.number, revertData });
          toast({ title: "Território Excluído" });
          router.push('/dashboard/territorios');
        } catch (error: any) {
          toast({ title: "Erro ao deletar", variant: "destructive" });
        } finally {
          setIsProcessingAction(false);
          setIsConfirmModalOpen(false);
        }
      }
    });
    setIsEditTerritoryModalOpen(false);
    setIsConfirmModalOpen(true);
  };

  const handleResetTerritory = async (tid: string) => {
    setConfirmAction({
      title: "Limpar Tudo",
      message: "Esta ação irá marcar todas as casas como 'não trabalhadas' e APAGAR todo o histórico deste território. Deseja continuar?",
      action: async () => {
        setIsProcessingAction(true);
        try {
          if (!user?.congregationId) return;
          const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', tid);
          const quadrasSnap = await getDocs(collection(territoryRef, 'quadras'));
          const historySnap = await getDocs(collection(territoryRef, 'activityHistory'));
          const batch = writeBatch(db);
          let totalDecrement = 0;

          for (const qDoc of quadrasSnap.docs) {
            const housesSnap = await getDocs(collection(qDoc.ref, 'casas'));
            housesSnap.forEach(hDoc => {
              if (hDoc.data().status === true) {
                batch.update(hDoc.ref, { status: false, lastWorkedBy: deleteField(), activityLogId: deleteField() });
                totalDecrement++;
              }
            });
            batch.update(qDoc.ref, { housesDone: 0 });
          }

          historySnap.forEach(hDoc => batch.delete(hDoc.ref));
          batch.update(territoryRef, { "stats.housesDone": 0, progress: 0, lastUpdate: serverTimestamp() });

          if (totalDecrement > 0) {
            const congRef = doc(db, 'congregations', user.congregationId);
            const congSnap = await getDoc(congRef);
            if (congSnap.exists()) {
              batch.update(congRef, { totalHousesDone: Math.max(0, (congSnap.data().totalHousesDone || 0) - totalDecrement) });
            }
          }

          await batch.commit();
          logEvent(user.congregationId, user.uid, user.name, 'TERRITORY_RESET', `Limpou o progresso e o histórico do território ${territory?.number} - ${territory?.name}.`, { territoryId: tid, territoryNumber: territory?.number });
          toast({ title: "Território Resetado" });
        } catch (error: any) {
          toast({ title: "Erro ao resetar", variant: "destructive" });
        } finally {
          setIsProcessingAction(false);
          setIsConfirmModalOpen(false);
        }
      }
    });
    setIsEditTerritoryModalOpen(false);
    setIsConfirmModalOpen(true);
  };

  if (loading || userLoading || !territory) return <div className="p-8 text-center"><Loader className="animate-spin mx-auto" /></div>;
  
  const isManagerView = ['Administrador', 'Dirigente', 'Servo de Territórios', 'Ajudante de Servo de Territórios'].includes(user!.role);

  return (
    <div className="p-4 space-y-6">
        <div className="space-y-6">
            <Link href="/dashboard/territorios" className="text-sm flex items-center"><ArrowLeft className="mr-2 h-4" /> Voltar</Link>
            <div className="flex justify-between items-start">
                <div><h1 className="text-3xl font-bold">{territory.number} - {territory.name}</h1><p className="text-muted-foreground">{territory.description}</p></div>
                {isManagerView && <Button onClick={() => setIsEditTerritoryModalOpen(true)}><Edit className="mr-2 h-4" /> Editar</Button>}
            </div>
        </div>
        
        <ProgressSection territory={territory} />
        <ActivityHistory territoryId={territory.id} history={activityHistory} />
        
        <div className="w-full">
            <Accordion type="single" collapsible className="w-full bg-card rounded-lg shadow-md overflow-hidden">
                <AccordionItem value="assignment-history" className="border-b-0">
                    <AccordionTrigger className="px-6 hover:no-underline font-semibold text-lg"><div className="flex items-center gap-3"><History className="text-primary" /><span>Histórico de Designações</span></div></AccordionTrigger>
                    <AccordionContent>
                        <AssignmentHistory 
                            currentAssignment={territory.assignment}
                            pastAssignments={territory.assignmentHistory || []}
                            onEdit={(log) => { setHistoryLogToEdit(log); setIsEditLogModalOpen(true); }}
                            onDelete={(log) => { setConfirmAction({ title: "Excluir Registro", message: `Excluir o registro de ${log.name}?`, action: async () => {
                                if (!user?.congregationId) return;
                                await updateDoc(doc(db, 'congregations', user.congregationId, 'territories', territory.id), { assignmentHistory: arrayRemove(log) });
                            } }); setIsConfirmModalOpen(true); }}
                        />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center"><LayoutGrid className="mr-3 text-primary" />Quadras</h2>
                {isManagerView && <Button onClick={() => setIsAddQuadraModalOpen(true)}><Plus className="mr-2 h-4" /> Nova Quadra</Button>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {quadras.map(q => (
                    <Link key={q.id} href={`/dashboard/territorios/${territoryId}/quadras/${q.id}`} className="block">
                        <QuadraCard quadra={q} isManagerView={isManagerView} onEdit={(e) => handleEditQuadraClick(e, q)} />
                    </Link>
                ))}
            </div>
        </div>

        <EditTerritoryModal isOpen={isEditTerritoryModalOpen} onClose={() => setIsEditTerritoryModalOpen(false)} territory={territory} onSave={handleSaveTerritory} onDelete={handleDeleteTerritory} onReset={handleResetTerritory} />
        <AddQuadraModal isOpen={isAddQuadraModalOpen} onClose={() => setIsAddQuadraModalOpen(false)} onSave={handleAddQuadra} existingQuadrasCount={quadras.length} />
        <EditQuadraModal isOpen={isEditQuadraModalOpen} onClose={() => setIsEditQuadraModalOpen(false)} quadra={selectedQuadra} onSave={handleSaveQuadra} onDelete={handleDeleteQuadra} />
        <AddEditAssignmentLogModal isOpen={isEditLogModalOpen} onClose={() => setIsEditLogModalOpen(false)} onSave={async (original, updated) => {
            if (!user?.congregationId) return;
            const history = (territory.assignmentHistory || []).map(log => 
                (log.uid === original.uid && log.assignedAt.isEqual(original.assignedAt)) 
                ? { ...log, name: updated.name, assignedAt: Timestamp.fromDate(updated.assignedAt), completedAt: Timestamp.fromDate(updated.completedAt) } 
                : log
            );
            await updateDoc(doc(db, 'congregations', user.congregationId, 'territories', territory.id), { assignmentHistory: history });
        }} logToEdit={historyLogToEdit} />
        <ImagePreviewModal isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} imageUrl={selectedImageUrl} />
        {confirmAction && <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={confirmAction.action} title={confirmAction.title} message={confirmAction.message} isLoading={isProcessingAction} />}
    </div>
  );
}

export default withAuth(TerritoryDetailPage);
