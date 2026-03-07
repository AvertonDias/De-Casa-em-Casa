
"use client";

import { doc, onSnapshot, collection, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp, runTransaction, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import { useUser } from "@/contexts/UserContext"; 
import { Territory, Activity, Quadra, AssignmentHistoryLog } from "@/types/types"; 
import { ArrowLeft, Edit, Plus, LayoutGrid, Map, FileImage, BarChart, History } from "lucide-react";
import Link from 'next/link';

import ActivityHistory from '@/components/ActivityHistory';
import AssignmentHistory from '@/components/AssignmentHistory';
import QuadraCard from '@/components/QuadraCard';
import EditTerritoryModal from '@/components/EditTerritoryModal';
import AddQuadraModal from '@/components/AddQuadraModal';
import { EditQuadraModal } from '@/components/EditQuadraModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import QuadraListItem from "@/components/QuadraListItem";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import withAuth from "@/components/withAuth";
import AddEditAssignmentLogModal from "@/components/admin/AddEditAssignmentLogModal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { GoogleMapEmbed } from "@/components/GoogleMapEmbed";
import { useToast } from "@/hooks/use-toast";

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
  const [territory, setTerritory] = useState<Territory | null>(null);
  const [activityHistory, setActivityHistory] = useState<Activity[]>([]);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

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
      await updateDoc(doc(db, 'congregations', user!.congregationId!, 'territories', tid), { ...data, lastUpdate: serverTimestamp() });
  };

  const handleAddQuadra = async (data: { name: string, description: string }) => {
    const territoryRef = doc(db, 'congregations', user!.congregationId!, 'territories', territoryId);
    await runTransaction(db, async (transaction) => {
        const terrDoc = await transaction.get(territoryRef);
        const newQuadraRef = doc(collection(territoryRef, 'quadras'));
        transaction.set(newQuadraRef, { ...data, totalHouses: 0, housesDone: 0, createdAt: serverTimestamp() });
        transaction.update(territoryRef, { quadraCount: (terrDoc.data()?.quadraCount || 0) + 1 });
    });
  };

  const handleDeleteTerritory = (tid: string) => {
    setConfirmAction({
      title: "Excluir Território",
      message: "Isso apagará todas as quadras e casas deste território. Esta ação é lenta e irreversível no plano gratuito.",
      action: async () => {
        setIsProcessingAction(true);
        const territoryRef = doc(db, 'congregations', user!.congregationId!, 'territories', tid);
        const quadrasSnap = await getDocs(collection(territoryRef, 'quadras'));
        const batch = writeBatch(db);
        
        for (const qDoc of quadrasSnap.docs) {
            const housesSnap = await getDocs(collection(qDoc.ref, 'casas'));
            housesSnap.forEach(h => batch.delete(h.ref));
            batch.delete(qDoc.ref);
        }
        const histSnap = await getDocs(collection(territoryRef, 'activityHistory'));
        histSnap.forEach(h => batch.delete(h.ref));
        batch.delete(territoryRef);
        
        await batch.commit();
        router.push('/dashboard/territorios');
      }
    });
    setIsEditTerritoryModalOpen(false);
    setIsConfirmModalOpen(true);
  };

  if (loading || userLoading || !territory) return <div className="p-8 text-center"><Loader className="animate-spin mx-auto" /></div>;
  const isManagerView = ['Administrador', 'Dirigente', 'Servo de Territórios'].includes(user!.role);

  return (
    <div className="p-4 space-y-6">
        <Link href="/dashboard/territorios" className="text-sm flex items-center"><ArrowLeft className="mr-2 h-4" /> Voltar</Link>
        <div className="flex justify-between items-start">
            <div><h1 className="text-3xl font-bold">{territory.number} - {territory.name}</h1><p className="text-muted-foreground">{territory.description}</p></div>
            {isManagerView && <Button onClick={() => setIsEditTerritoryModalOpen(true)}><Edit className="mr-2 h-4" /> Editar</Button>}
        </div>
        
        <ProgressSection territory={territory} />
        <ActivityHistory territoryId={territory.id} history={activityHistory} />
        
        <div className="bg-card p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center"><LayoutGrid className="mr-3" />Quadras</h2>
                {isManagerView && <Button onClick={() => setIsAddQuadraModalOpen(true)}><Plus className="mr-2 h-4" /> Nova Quadra</Button>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {quadras.map(q => (
                    <Link key={q.id} href={`/dashboard/territorios/${territoryId}/quadras/${q.id}`} className="block">
                        <QuadraCard quadra={q} isManagerView={isManagerView} onEdit={(e) => { e.preventDefault(); setSelectedQuadra(q); setIsEditQuadraModalOpen(true); }} />
                    </Link>
                ))}
            </div>
        </div>

        <EditTerritoryModal isOpen={isEditTerritoryModalOpen} onClose={() => setIsEditTerritoryModalOpen(false)} territory={territory} onSave={handleSaveTerritory} onDelete={handleDeleteTerritory} onReset={() => {}} />
        <AddQuadraModal isOpen={isAddQuadraModalOpen} onClose={() => setIsAddQuadraModalOpen(false)} onSave={handleAddQuadra} existingQuadrasCount={quadras.length} />
        {confirmAction && <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={confirmAction.action} title={confirmAction.title} message={confirmAction.message} isLoading={isProcessingAction} />}
    </div>
  );
}

export default withAuth(TerritoryDetailPage);
