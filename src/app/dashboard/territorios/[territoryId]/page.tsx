
"use client";

import { doc, onSnapshot, collection, updateDoc, addDoc, deleteDoc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "@/lib/firebase";
import { useEffect, useState, useContext } from "react";
import { useRouter } from 'next/navigation';
import { UserContext } from "@/contexts/UserContext"; 
import { Territory, Activity, Quadra } from "@/types/types"; 
import { ArrowLeft, Edit, Plus, LayoutGrid, Map, FileImage, BarChart } from "lucide-react";
import Link from 'next/link';

import ActivityHistory from '@/components/ActivityHistory';
import QuadraCard from '@/components/QuadraCard';
import EditTerritoryModal from '@/components/EditTerritoryModal';
import AddQuadraModal from '@/components/AddQuadraModal';
import { EditQuadraModal } from '@/components/EditQuadraModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import QuadraListItem from "@/components/QuadraListItem";
import ImagePreviewModal from "@/components/ImagePreviewModal";

const functions = getFunctions();
const resetTerritoryFunction = httpsCallable(functions, 'resetTerritoryProgress');

// ========================================================================
//   Componentes Modulares
// ========================================================================

const ProgressSection = ({ territory }: { territory: Territory }) => {
    const totalHouses = territory.stats?.totalHouses || 0;
    const housesDone = territory.stats?.housesDone || 0;
    const progress = territory.progress || 0;

    return (
        <div className="bg-card p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4 flex items-center"><BarChart className="mr-3 text-primary" />Progresso Geral</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div><p className="text-sm text-muted-foreground">Total de Casas</p><p className="text-2xl font-bold">{totalHouses}</p></div>
                <div><p className="text-sm text-muted-foreground">Casas Feitas</p><p className="text-2xl font-bold text-green-400">{housesDone}</p></div>
                <div><p className="text-sm text-muted-foreground">Pendentes</p><p className="text-2xl font-bold text-yellow-400">{totalHouses - housesDone}</p></div>
                <div><p className="text-sm text-muted-foreground">Progresso</p><p className="text-2xl font-bold text-blue-400">{Math.round(progress * 100)}%</p></div>
            </div>
        </div>
    );
};

const HistorySection = ({ territoryId, history }: { territoryId: string, history: Activity[] }) => (
  <ActivityHistory territoryId={territoryId} history={history} />
);

const MapAndCardSection = ({ territory, onImageClick }: { territory: Territory, onImageClick: (url: string) => void }) => {
    const cardUrl = territory.cardUrl;
    
    const getMapEmbedUrl = (originalUrl?: string) => {
        if (!originalUrl) return '';
        try {
            const url = new URL(originalUrl);
            const mid = url.searchParams.get('mid');
            return mid ? `https://www.google.com/maps/d/embed?mid=${mid}` : '';
        } catch (e) { return ''; }
    };
    const mapEmbedUrl = getMapEmbedUrl(territory.mapLink);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card p-6 rounded-lg shadow-md flex flex-col">
          <h2 className="text-xl font-bold mb-4 flex items-center"><FileImage className="mr-3 text-primary" />Cartão do Território</h2>
          <div className="flex-grow flex items-center justify-center">
            {cardUrl ? (
              <img 
                src={cardUrl} 
                alt="Cartão do Território" 
                className="w-full h-auto max-h-96 rounded-md object-contain cursor-pointer transition-transform hover:scale-105"
                onClick={() => onImageClick(cardUrl)}
              /> 
            ) : (
              <p className="text-muted-foreground">Nenhum cartão.</p>
            )}
          </div>
        </div>
        <div className="bg-card p-6 rounded-lg shadow-md flex flex-col"><h2 className="text-xl font-bold mb-4 flex items-center"><Map className="mr-3 text-primary" />Mapa do Território</h2><div className="flex-grow">{mapEmbedUrl ? <iframe src={mapEmbedUrl} width="100%" height="100%" style={{ border: 0, minHeight: '350px' }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"></iframe> : <p className="text-muted-foreground">Nenhum mapa.</p>}</div></div>
      </div>
    );
};


const QuadrasSection = ({ territoryId, quadras, isManagerView, onAddQuadra, onEditQuadra }: { territoryId: string, quadras: Quadra[], isManagerView: boolean, onAddQuadra: () => void, onEditQuadra: (quadra: Quadra) => void }) => (
  <div className="bg-card p-6 rounded-lg shadow-md">
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-2xl font-bold flex items-center"><LayoutGrid className="mr-3 text-primary" />Quadras</h2>
      {isManagerView && (<button onClick={onAddQuadra} className="bg-primary hover:bg-primary/80 text-white font-semibold py-2 px-4 rounded-md flex items-center"><Plus className="mr-2 h-4 w-4" /> Adicionar Quadra</button>)}
    </div>
    {quadras.length === 0 ? (<p className="text-center text-muted-foreground py-8">Nenhuma quadra adicionada.</p>) : (
      isManagerView ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {quadras.map((quadra) => (
            <Link key={quadra.id} href={`/dashboard/territorios/${territoryId}/quadras/${quadra.id}`} className="block">
              <QuadraCard quadra={quadra} isManagerView={isManagerView} onEdit={(e) => { e.preventDefault(); e.stopPropagation(); onEditQuadra(quadra); }} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-border -mx-6 px-6">
           {quadras.map((quadra) => (
             <Link key={quadra.id} href={`/dashboard/territorios/${territoryId}/quadras/${quadra.id}`}>
                <QuadraListItem quadra={quadra} />
             </Link>
           ))}
         </div>
      )
    )}
  </div>
);


export default function TerritoryDetailPage({ params }: { params: { territoryId: string } }) {
  const [territory, setTerritory] = useState<Territory | null>(null);
  const [activityHistory, setActivityHistory] = useState<Activity[]>([]);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(UserContext);
  const router = useRouter();

  // Controles de Modais
  const [isEditTerritoryModalOpen, setIsEditTerritoryModalOpen] = useState(false);
  const [isAddQuadraModalOpen, setIsAddQuadraModalOpen] = useState(false);
  const [isEditQuadraModalOpen, setIsEditQuadraModalOpen] = useState(false);
  const [selectedQuadra, setSelectedQuadra] = useState<Quadra | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; title: string; message: string; } | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (!user?.congregationId) { if (!user) setLoading(true); else setLoading(false); return; }
    
    const territoryRef = doc(db, 'congregations', user.congregationId, 'territories', params.territoryId);
    
    const unsubTerritory = onSnapshot(territoryRef, (docSnap) => { 
        setTerritory(docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Territory : null);
        setLoading(false); 
    });

    const historyQuery = query(collection(territoryRef, 'activityHistory'), orderBy("activityDate", "desc"));
    const unsubHistory = onSnapshot(historyQuery, (snapshot) => { 
        setActivityHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity)));
    });
    
    const quadrasQuery = query(collection(territoryRef, 'quadras'), orderBy('name', 'asc'));
    const unsubQuadras = onSnapshot(quadrasQuery, (snapshot) => { 
        setQuadras(snapshot.docs.map(qDoc => ({...qDoc.data(), id: qDoc.id} as Quadra)));
    });
    
    return () => { unsubTerritory(); unsubHistory(); unsubQuadras(); };
  }, [params.territoryId, user]);
  
  const handleOpenEditQuadraModal = (quadra: Quadra) => { setSelectedQuadra(quadra); setIsEditQuadraModalOpen(true); };

  const handleCloseAllModals = () => {
    setIsEditTerritoryModalOpen(false);
    setIsAddQuadraModalOpen(false);
    setIsEditQuadraModalOpen(false);
    setIsConfirmModalOpen(false);
    setSelectedQuadra(null);
    setIsPreviewModalOpen(false);
  };

  const handleSaveTerritory = async (territoryId: string, updatedData: Partial<Territory>) => {
      if(!user?.congregationId) return;
      const territoryDocRef = doc(db, 'congregations', user.congregationId, 'territories', territoryId);
      await updateDoc(territoryDocRef, { ...updatedData, lastUpdate: serverTimestamp() });
  };

  const handleAddQuadra = async (data: { name: string, description: string }) => {
    if(!user?.congregationId) return;
    const quadrasRef = collection(db, 'congregations', user.congregationId, 'territories', params.territoryId, 'quadras');
    await addDoc(quadrasRef, { ...data, totalHouses: 0, housesDone: 0, createdAt: serverTimestamp() });
  };
  
  const handleEditQuadra = async (quadraId: string, data: { name: string, description: string }) => {
    if(!user?.congregationId) return;
    const quadraRef = doc(db, 'congregations', user.congregationId, 'territories', params.territoryId, 'quadras', quadraId);
    await updateDoc(quadraRef, data);
  };
  
  const handleResetTerritory = (territoryId: string) => {
    setConfirmAction({
      action: async () => {
        if (!user?.congregationId) return;
        await resetTerritoryFunction({ congregationId: user.congregationId, territoryId });
        handleCloseAllModals();
      },
      title: "Confirmar Limpeza",
      message: "Tem certeza que deseja limpar todo o progresso deste território? As casas voltarão a ficar pendentes e o histórico será apagado."
    });
    setIsEditTerritoryModalOpen(false);
    setIsConfirmModalOpen(true);
  };
  
  const handleDeleteTerritory = (territoryId: string) => {
    setConfirmAction({
      action: async () => {
        if(!user?.congregationId) return;
        const territoryDocRef = doc(db, 'congregations', user.congregationId, 'territories', territoryId);
        await deleteDoc(territoryDocRef);
        handleCloseAllModals();
        router.push('/dashboard/territorios');
      },
      title: "Confirmar Exclusão de Território",
      message: "Tem certeza que deseja EXCLUIR este território? Todas as suas quadras e casas serão apagadas permanentemente. Esta ação não pode ser desfeita."
    });
    setIsEditTerritoryModalOpen(false);
    setIsConfirmModalOpen(true);
  };

  const handleDeleteQuadra = (quadraId: string) => {
    setConfirmAction({
      action: async () => {
        if (!user?.congregationId || !territory?.id) {
          console.error("Erro crítico: IDs desapareceram antes da exclusão.");
          return;
        }
        const quadraDocRef = doc(db, 'congregations', user.congregationId, 'territories', territory.id, 'quadras', quadraId);
        await deleteDoc(quadraDocRef);
        handleCloseAllModals();
      },
      title: "Confirmar Exclusão de Quadra",
      message: "Tem certeza que deseja EXCLUIR esta quadra? Todas as casas e o progresso associado serão apagados permanentemente."
    });
    setIsEditQuadraModalOpen(false);
    setIsConfirmModalOpen(true);
  };
  
  const handleImageClick = (url: string) => {
    setSelectedImageUrl(url);
    setIsPreviewModalOpen(true);
  };

  if (loading || !territory || !user) return <div className="p-8 text-center">Carregando...</div>;
  
  const isManagerView = user.role === 'Administrador' || user.role === 'Dirigente';
  const isUrban = territory.type !== 'rural';

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex justify-between items-start">
            <div>
              <Link href={isUrban ? "/dashboard/territorios" : "/dashboard/rural"} className="text-sm text-muted-foreground hover:text-white flex items-center mb-2"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link>
              <h1 className="text-3xl font-bold">{territory.number} - {territory.name}</h1>
              <p className="text-muted-foreground mt-1">{territory.description || "Sem descrição"}</p>
            </div>
            {isManagerView && (<button onClick={() => setIsEditTerritoryModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md flex items-center"><Edit className="mr-2 h-4 w-4"/> Editar Território</button>)}
        </div>
        
        <div className="space-y-6">
          {isManagerView ? (
            <>
              {isUrban && <ProgressSection territory={territory} />}
              <HistorySection territoryId={territory.id} history={activityHistory} />
              <MapAndCardSection territory={territory} onImageClick={handleImageClick} />
              {isUrban && 
                <QuadrasSection 
                  territoryId={params.territoryId}
                  quadras={quadras} 
                  isManagerView={isManagerView} 
                  onAddQuadra={() => setIsAddQuadraModalOpen(true)} 
                  onEditQuadra={handleOpenEditQuadraModal}
                />
              }
            </>
          ) : (
            <>
              {isUrban && 
                <QuadrasSection
                  territoryId={params.territoryId} 
                  quadras={quadras} 
                  isManagerView={isManagerView} 
                  onAddQuadra={() => setIsAddQuadraModalOpen(true)} 
                  onEditQuadra={handleOpenEditQuadraModal}
                />
              }
              <MapAndCardSection territory={territory} onImageClick={handleImageClick} />
              <HistorySection territoryId={territory.id} history={activityHistory} />
            </>
          )}
        </div>
      </div>
      
      {territory && (<EditTerritoryModal isOpen={isEditTerritoryModalOpen} onClose={handleCloseAllModals} territory={territory} onSave={handleSaveTerritory} onReset={handleResetTerritory} onDelete={handleDeleteTerritory} />)}
      
      <AddQuadraModal
        isOpen={isAddQuadraModalOpen}
        onClose={handleCloseAllModals}
        onSave={handleAddQuadra}
        existingQuadrasCount={quadras.length}
      />
      
      {selectedQuadra && (
        <EditQuadraModal
            isOpen={isEditQuadraModalOpen}
            onClose={handleCloseAllModals}
            quadra={selectedQuadra}
            onSave={handleEditQuadra}
            onDelete={handleDeleteQuadra}
        />
      )}

      {confirmAction && <ConfirmationModal isOpen={isConfirmModalOpen} onClose={handleCloseAllModals} onConfirm={confirmAction.action} title={confirmAction.title} message={confirmAction.message} />}
      <ImagePreviewModal isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} imageUrl={selectedImageUrl} />
    </>
  );
}
